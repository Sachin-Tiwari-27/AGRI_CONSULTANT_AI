import type { Redis } from "ioredis";
import type { AIProvider } from "./types";

// ── Per-provider rate limit configuration ─────────────────────────────────────
//
// These are conservative defaults derived from known free-tier limits.
// Override via environment variables: RATE_LIMIT_OPENROUTER=20 etc.
// The window is always 60 seconds (1 RPM rolling window).

interface ProviderLimit {
  /** Max requests per windowSecs across all instances. */
  maxRequests: number;
  windowSecs: number;
}

const DEFAULT_LIMITS: Record<AIProvider, ProviderLimit> = {
  openrouter: { maxRequests: Number(process.env.RATE_LIMIT_OPENROUTER ?? 30), windowSecs: 60 },
  anthropic:  { maxRequests: Number(process.env.RATE_LIMIT_ANTHROPIC  ?? 50), windowSecs: 60 },
  openai:     { maxRequests: Number(process.env.RATE_LIMIT_OPENAI     ?? 50), windowSecs: 60 },
  google:     { maxRequests: Number(process.env.RATE_LIMIT_GOOGLE     ?? 50), windowSecs: 60 },
  nvidia:     { maxRequests: Number(process.env.RATE_LIMIT_NVIDIA     ?? 20), windowSecs: 60 },
};

const rlKey = (provider: AIProvider) => `rl:${provider}`;

// ── In-process fallback queue ─────────────────────────────────────────────────
// Used when Redis is unavailable. Serialises requests per provider with a
// minimum delay between them. Not shared across instances — best-effort only.

const MIN_DELAY_MS = Number(process.env.AI_REQUEST_DELAY_MS ?? 1500);
const providerQueues = new Map<string, Promise<void>>();

function enqueueLocal(provider: AIProvider): Promise<void> {
  const current = providerQueues.get(provider) ?? Promise.resolve();
  const next = current.then(
    () => new Promise<void>((r) => setTimeout(r, MIN_DELAY_MS)),
  );
  providerQueues.set(provider, next);
  return current; // caller waits for their turn, then proceeds
}

// ── Rate limiter ──────────────────────────────────────────────────────────────

export class RateLimiter {
  constructor(
    private redis: Redis | null,
    private limits: Record<AIProvider, ProviderLimit> = DEFAULT_LIMITS,
  ) {}

  /**
   * Acquires a slot for the given provider.
   * - With Redis: uses a sliding window counter. Throws if the window is full.
   * - Without Redis: serialises requests via an in-process delay queue.
   *
   * The gateway calls this before firing each request. If it throws,
   * the executor should treat it as a transient RateLimitError and try
   * the next model in the chain.
   */
  async acquire(provider: AIProvider): Promise<void> {
    if (this.redis) {
      await this.acquireRedis(provider);
    } else {
      await enqueueLocal(provider);
    }
  }

  private async acquireRedis(provider: AIProvider): Promise<void> {
    const limit = this.limits[provider];
    const key = rlKey(provider);

    try {
      // Lua script: atomically increment and check within a sliding window.
      // Returns the count after increment, or -1 if the limit is exceeded.
      const script = `
        local key     = KEYS[1]
        local limit   = tonumber(ARGV[1])
        local window  = tonumber(ARGV[2])
        local current = redis.call('INCR', key)
        if current == 1 then
          redis.call('EXPIRE', key, window)
        end
        if current > limit then
          return -1
        end
        return current
      `;

      const result = await this.redis!.eval(
        script,
        1,
        key,
        String(limit.maxRequests),
        String(limit.windowSecs),
      ) as number;

      if (result === -1) {
        // Window is full — get the TTL so caller knows when to retry
        const ttl = await this.redis!.ttl(key);
        const retryAfterMs = Math.max(ttl * 1000, 1000);
        throw Object.assign(
          new Error(`Rate limit exceeded for provider ${provider}`),
          { code: "RATE_LIMIT_LOCAL", retryAfterMs },
        );
      }
    } catch (err) {
      // If the error is our own rate limit signal, re-throw it
      if (
        err instanceof Error &&
        (err as NodeJS.ErrnoException).code === "RATE_LIMIT_LOCAL"
      ) {
        throw err;
      }
      // Redis error — degrade gracefully to local queue
      console.warn("[Gateway] Rate limiter Redis error, degrading:", (err as Error).message);
      await enqueueLocal(provider);
    }
  }
}
