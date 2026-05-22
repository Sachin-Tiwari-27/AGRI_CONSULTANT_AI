import { randomUUID } from "crypto";
import { CircuitBreaker } from "./circuit-breaker";
import { RateLimiter } from "./rate-limiter";
import { executeOne } from "./executor";
import { resolveRoute, buildChain } from "./router";
import { estimateCost } from "./pricing";
import {
  GatewayLogger,
  ConsoleLoggerPlugin,
  SupabaseLoggerPlugin,
} from "./logger";
import { getRedisClient } from "./redis";
import {
  RateLimitError,
  ModelUnavailableError,
  TimeoutError,
  MalformedResponseError,
  AuthError,
  AllModelsExhaustedError,
  GatewayError,
} from "./types";
import type {
  GatewayRequest,
  GatewayResponse,
  GatewayLogEntry,
  ModelRef,
  AIProvider,
} from "./types";

// ── Gateway singleton ─────────────────────────────────────────────────────────
//
// One Gateway instance per server process. All requests share the circuit
// breaker and rate limiter state. Redis is initialised lazily on first use.

export class Gateway {
  private circuitBreaker: CircuitBreaker | null = null;
  private rateLimiter: RateLimiter | null = null;
  private logger: GatewayLogger;
  // Replace `private initialised = false;` with a promise tracker
  private initPromise: Promise<void> | null = null;

  constructor(
    private plugins = [new ConsoleLoggerPlugin(), new SupabaseLoggerPlugin()],
  ) {
    this.logger = new GatewayLogger(plugins);
  }

  private async init(): Promise<void> {
    // If initialization is already in progress or completed, wait for it
    if (!this.initPromise) {
      this.initPromise = (async () => {
        const redis = await getRedisClient();
        this.circuitBreaker = new CircuitBreaker(redis);
        this.rateLimiter = new RateLimiter(redis);
      })();
    }

    return this.initPromise;
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  async execute(request: GatewayRequest): Promise<GatewayResponse> {
    await this.init();

    const requestId = randomUUID();
    const startMs = Date.now();

    const route = resolveRoute(request.task);
    const chain = buildChain(route);
    const maxTokens = request.maxTokens ?? route.maxTokens;
    const timeoutMs = request.timeoutMs ?? route.timeoutMs ?? 60_000;

    const primaryModel = chain[0].model;
    const attemptedChain: ModelRef[] = [];
    let lastError: Error | null = null;
    let degraded = false;

    for (let i = 0; i < chain.length; i++) {
      const ref = chain[i];
      attemptedChain.push(ref);

      // ── Circuit breaker check ─────────────────────────────────────────────
      const state = await this.circuitBreaker!.getState(ref.model);
      if (state === "OPEN") {
        console.warn(
          `[Gateway] Circuit OPEN for ${ref.model} — skipping to next in chain.`,
        );
        lastError = new ModelUnavailableError(
          ref.provider,
          ref.model,
          "circuit open",
        );
        degraded = i > 0 ? true : degraded;
        continue;
      }

      // ── Rate limiter ──────────────────────────────────────────────────────
      try {
        await this.rateLimiter!.acquire(ref.provider);
      } catch {
        // Rate limit on this provider — try next model (possibly different provider)
        lastError = new RateLimitError(1000, ref.provider, ref.model);
        degraded = i > 0 ? true : degraded;
        continue;
      }

      // ── Execute request ───────────────────────────────────────────────────
      if (i > 0) degraded = true; // we're past the primary

      console.info(
        `[Gateway] Task: ${request.task} | Model: ${ref.model} | Attempt ${i + 1}/${chain.length}`,
      );

      try {
        const result = await executeOne(
          ref,
          request.prompt,
          maxTokens,
          timeoutMs,
        );

        // ── Success ───────────────────────────────────────────────────────
        await this.circuitBreaker!.recordSuccess(ref.model);

        const durationMs = Date.now() - startMs;
        const estimatedCost = estimateCost(
          result.modelEchoed,
          result.tokensUsed,
        );

        const response: GatewayResponse = {
          content: result.content,
          modelUsed: result.modelEchoed,
          providerUsed: ref.provider,
          degraded,
          attemptedChain,
          tokensUsed: result.tokensUsed,
          durationMs,
          requestId,
          fromCache: false,
        };

        this.logger.emit({
          requestId,
          task: request.task,
          modelIntended: primaryModel,
          modelUsed: result.modelEchoed,
          providerUsed: ref.provider,
          degraded,
          fallbackChain: attemptedChain.map((m) => m.model),
          tokensUsed: result.tokensUsed,
          estimatedCostUsd: estimatedCost,
          durationMs,
          cacheHit: false,
          projectId: request.meta?.projectId,
          consultantId: request.meta?.consultantId,
          timestamp: new Date(),
        } satisfies GatewayLogEntry);

        return response;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));

        // ── Determine whether to circuit-break this model ─────────────────
        const shouldBreak =
          err instanceof ModelUnavailableError ||
          err instanceof MalformedResponseError;

        if (shouldBreak) {
          const newState = await this.circuitBreaker!.recordFailure(ref.model);
          if (newState === "OPEN") {
            console.warn(`[Gateway] Circuit opened for ${ref.model}`);
          }
        }

        // ── Determine whether to retry same model or move to next ─────────
        const switchNow =
          err instanceof RateLimitError ||
          err instanceof ModelUnavailableError ||
          err instanceof MalformedResponseError ||
          err instanceof AuthError;

        if (switchNow) {
          console.warn(
            `[Gateway] ${(err as GatewayError).code ?? "ERROR"} on ${ref.model} — trying next model.`,
          );
          continue;
        }

        if (err instanceof TimeoutError) {
          // For timeouts: retry the same model once if we haven't already,
          // otherwise fall through to next model.
          const alreadyRetried =
            attemptedChain.filter((m) => m.model === ref.model).length > 1;

          if (!alreadyRetried && i < chain.length - 1) {
            // Insert a retry of the same model before continuing the chain
            chain.splice(i + 1, 0, ref);
            console.warn(`[Gateway] Timeout on ${ref.model} — retrying once.`);
          }
          continue;
        }

        // Unknown error — log and try next
        console.error(
          `[Gateway] Unexpected error on ${ref.model}:`,
          lastError.message,
        );
        continue;
      }
    }

    // ── All models exhausted ──────────────────────────────────────────────────
    const durationMs = Date.now() - startMs;
    const exhaustedErr = new AllModelsExhaustedError(
      request.task,
      attemptedChain,
    );

    this.logger.emit({
      requestId,
      task: request.task,
      modelIntended: primaryModel,
      modelUsed: "none",
      providerUsed: chain[0].provider as AIProvider,
      degraded: true,
      fallbackChain: attemptedChain.map((m) => m.model),
      tokensUsed: 0,
      estimatedCostUsd: 0,
      durationMs,
      cacheHit: false,
      errorType: lastError?.constructor?.name ?? "AllModelsExhausted",
      projectId: request.meta?.projectId,
      consultantId: request.meta?.consultantId,
      timestamp: new Date(),
    } satisfies GatewayLogEntry);

    throw exhaustedErr;
  }
}

// ── Singleton export ──────────────────────────────────────────────────────────
// Import `gateway` anywhere in the app — one instance, shared Redis connection.

export const gateway = new Gateway();
