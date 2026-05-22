// ── Gateway types ─────────────────────────────────────────────────────────────
// All types are framework-agnostic. Nothing in this file imports from Next.js,
// Supabase, or any other app-specific module. This keeps the gateway portable.

// ── Provider + model identity ─────────────────────────────────────────────────

export type AIProvider =
  | "openrouter"
  | "anthropic"
  | "openai"
  | "google"
  | "nvidia";

/**
 * A ModelRef pairs a provider with its model string.
 * The gateway uses this to look up the correct base URL and API key.
 *
 * Examples:
 *   { provider: "openrouter", model: "openai/gpt-4o-mini" }
 *   { provider: "anthropic", model: "claude-3-5-haiku-latest" }
 *   { provider: "nvidia",    model: "nvidia/nemotron-3-super-120b-a12b:free" }
 */
export interface ModelRef {
  provider: AIProvider;
  model: string;
}

// ── Provider configuration ────────────────────────────────────────────────────

export interface ProviderConfig {
  baseURL: string;
  apiKeyEnv: string;
  /** Extra headers required by this provider (e.g. OpenRouter's HTTP-Referer) */
  extraHeaders?: Record<string, string>;
}

// ── Per-task routing ──────────────────────────────────────────────────────────

export interface TaskRoute {
  /** Model tried first */
  primary: ModelRef;
  /**
   * Ordered list of fallback models.
   * The executor tries each in sequence on transient failures.
   */
  fallback: ModelRef[];
  maxTokens: number;
  /** Per-request timeout in ms. Defaults to 60 000. */
  timeoutMs?: number;
}

// ── Request / response ────────────────────────────────────────────────────────

export interface GatewayRequest {
  /** Identifies the prompt template and routing config to use. */
  task: string;
  /** Rendered prompt string — the gateway does not build prompts itself. */
  prompt: string;
  maxTokens?: number;
  timeoutMs?: number;
  /** Caller-supplied metadata attached to the observability log. */
  meta?: {
    projectId?: string;
    consultantId?: string;
    [key: string]: unknown;
  };
}

export interface GatewayResponse {
  content: string;
  /** The model that actually produced the response (may differ from primary). */
  modelUsed: string;
  providerUsed: AIProvider;
  /** true when a fallback model was used instead of the primary. */
  degraded: boolean;
  /** The full ordered chain that was attempted (primary first). */
  attemptedChain: ModelRef[];
  tokensUsed: number;
  durationMs: number;
  requestId: string;
  /** true when the response was served from cache. */
  fromCache: boolean;
}

// ── Observability log entry ───────────────────────────────────────────────────

export interface GatewayLogEntry {
  requestId: string;
  task: string;
  modelIntended: string;
  modelUsed: string;
  providerUsed: AIProvider;
  degraded: boolean;
  fallbackChain: string[];
  tokensUsed: number;
  estimatedCostUsd: number;
  durationMs: number;
  cacheHit: boolean;
  errorType?: string;
  projectId?: string;
  consultantId?: string;
  timestamp: Date;
}

// ── Typed errors ──────────────────────────────────────────────────────────────
//
// Typed errors let the fallback chain make smart decisions:
//   RateLimitError      → skip to next provider immediately (different rate limit)
//   ModelUnavailableError → open circuit, try next model
//   TimeoutError        → retry once with same model, then fall back
//   MalformedResponseError → same model is confused; fall back
//   AuthError           → config issue; do not retry
//   GatewayError        → generic; retry once

export class GatewayError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly retryable: boolean,
    public readonly switchProvider: boolean = false,
  ) {
    super(message);
    this.name = "GatewayError";
  }
}

/** HTTP 429 — provider is rate-limiting us. Switch provider immediately. */
export class RateLimitError extends GatewayError {
  constructor(
    public readonly retryAfterMs: number,
    provider: AIProvider,
    model: string,
  ) {
    super(
      `Rate limited by ${provider} on model ${model}. Retry after ${retryAfterMs}ms.`,
      "RATE_LIMIT",
      true,
      true, // switch provider
    );
    this.name = "RateLimitError";
  }
}

/** HTTP 502/503/504 or provider-level unavailable body — circuit-break this model. */
export class ModelUnavailableError extends GatewayError {
  constructor(provider: AIProvider, model: string, detail?: string) {
    super(
      `Model ${model} on ${provider} is unavailable. ${detail ?? ""}`.trim(),
      "MODEL_UNAVAILABLE",
      true,
      true,
    );
    this.name = "ModelUnavailableError";
  }
}

/** Request took longer than timeoutMs — retry once, then fall back. */
export class TimeoutError extends GatewayError {
  constructor(provider: AIProvider, model: string, timeoutMs: number) {
    super(
      `Request to ${model} on ${provider} timed out after ${timeoutMs}ms.`,
      "TIMEOUT",
      true,
      false, // retry same model once before falling back
    );
    this.name = "TimeoutError";
  }
}

/** Model returned non-parseable or empty content — fall back immediately. */
export class MalformedResponseError extends GatewayError {
  constructor(provider: AIProvider, model: string, detail: string) {
    super(
      `Model ${model} on ${provider} returned malformed response: ${detail}`,
      "MALFORMED_RESPONSE",
      false,
      true,
    );
    this.name = "MalformedResponseError";
  }
}

/** API key missing or rejected — config issue, do not retry. */
export class AuthError extends GatewayError {
  constructor(provider: AIProvider) {
    super(
      `Authentication failed for provider ${provider}. Check API key configuration.`,
      "AUTH_ERROR",
      false,
      false,
    );
    this.name = "AuthError";
  }
}

/** All models in the fallback chain were exhausted. */
export class AllModelsExhaustedError extends GatewayError {
  constructor(task: string, chain: ModelRef[]) {
    super(
      `All models exhausted for task "${task}". Tried: ${chain.map((m) => m.model).join(" → ")}`,
      "ALL_MODELS_EXHAUSTED",
      false,
      false,
    );
    this.name = "AllModelsExhaustedError";
  }
}
