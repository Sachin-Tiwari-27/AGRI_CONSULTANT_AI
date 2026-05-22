import { getProviderConfig, getApiKey } from "./providers";
import {
  RateLimitError,
  ModelUnavailableError,
  TimeoutError,
  MalformedResponseError,
  AuthError,
  GatewayError,
} from "./types";
import type { ModelRef } from "./types";

// ── Raw provider response shape (OpenAI-compatible) ───────────────────────────

interface ChatCompletionResponse {
  choices?: Array<{
    message?: { content?: string };
    finish_reason?: string;
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  model?: string;
  error?: {
    message?: string;
    code?: number | string;
    status?: number | string;
  };
}

export interface ExecutorResult {
  content: string;
  tokensUsed: number;
  finishReason: string;
  /** Model string echoed back by the provider (may differ from what was sent). */
  modelEchoed: string;
  durationMs: number;
}

// ── Executor ──────────────────────────────────────────────────────────────────

/**
 * Fires a single chat-completion request to one model on one provider.
 * Returns a clean ExecutorResult on success.
 * Throws a typed GatewayError on any failure — callers should never catch
 * raw Error objects from this function.
 */
export async function executeOne(
  ref: ModelRef,
  prompt: string,
  maxTokens: number,
  timeoutMs: number,
): Promise<ExecutorResult> {
  const config = getProviderConfig(ref.provider);
  let apiKey: string;

  try {
    apiKey = getApiKey(ref.provider);
  } catch {
    throw new AuthError(ref.provider);
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
    ...(config.extraHeaders ?? {}),
  };

  const body = JSON.stringify({
    model: ref.model,
    max_tokens: maxTokens,
    messages: [{ role: "user", content: prompt }],
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const startMs = Date.now();

  let response: Response;
  try {
    response = await fetch(`${config.baseURL}/chat/completions`, {
      method: "POST",
      headers,
      body,
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timer);
    // AbortController fires a DOMException named "AbortError"
    if (err instanceof Error && err.name === "AbortError") {
      throw new TimeoutError(ref.provider, ref.model, timeoutMs);
    }
    // Network-level errors (DNS, connection refused) — treat as unavailable
    throw new ModelUnavailableError(
      ref.provider,
      ref.model,
      err instanceof Error ? err.message : String(err),
    );
  } finally {
    clearTimeout(timer);
  }

  const durationMs = Date.now() - startMs;

  // ── Map HTTP status codes to typed errors ──────────────────────────────────

  if (response.status === 401 || response.status === 403) {
    throw new AuthError(ref.provider);
  }

  if (response.status === 429) {
    const retryAfterHeader = response.headers.get("Retry-After");
    const retryAfterMs = retryAfterHeader
      ? parseInt(retryAfterHeader, 10) * 1000
      : 5000;
    throw new RateLimitError(retryAfterMs, ref.provider, ref.model);
  }

  if (
    response.status === 502 ||
    response.status === 503 ||
    response.status === 504
  ) {
    throw new ModelUnavailableError(
      ref.provider,
      ref.model,
      `HTTP ${response.status}`,
    );
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new GatewayError(
      `HTTP ${response.status} from ${ref.provider}: ${body.slice(0, 200)}`,
      "HTTP_ERROR",
      false,
    );
  }

  // ── Parse response body ────────────────────────────────────────────────────

  let data: ChatCompletionResponse;
  try {
    data = (await response.json()) as ChatCompletionResponse;
  } catch {
    throw new MalformedResponseError(
      ref.provider,
      ref.model,
      "Response body is not valid JSON",
    );
  }

  // Some providers (OpenRouter) return HTTP 200 with an error body for
  // transient upstream failures.
  if (data.error) {
    const errCode = data.error.code ?? data.error.status;
    const errMsg = data.error.message ?? "";
    const isTransient =
      [502, 503, 504, "502", "503", "504"].includes(errCode as string) ||
      /timeout|upstream|bad gateway|unavailable/i.test(errMsg);

    if (isTransient) {
      throw new ModelUnavailableError(ref.provider, ref.model, errMsg);
    }

    // Rate limit surfaced in body
    if (errCode === 429 || errCode === "429") {
      throw new RateLimitError(5000, ref.provider, ref.model);
    }

    throw new GatewayError(
      `Provider error: ${errMsg}`,
      "PROVIDER_ERROR",
      false,
    );
  }

  const content = data.choices?.[0]?.message?.content ?? "";
  const finishReason = data.choices?.[0]?.finish_reason ?? "unknown";

  if (!content) {
    throw new MalformedResponseError(
      ref.provider,
      ref.model,
      `Empty content. finish_reason=${finishReason}`,
    );
  }

  if (finishReason === "length") {
    // Don't throw — caller can still use the truncated content.
    // The gateway logs this; callers decide whether truncation is acceptable.
    console.warn(
      `[Gateway] Model ${ref.model} hit token limit (max_tokens=${maxTokens}). Content may be truncated.`,
    );
  }

  return {
    content,
    tokensUsed: data.usage?.total_tokens ?? 0,
    finishReason,
    modelEchoed: data.model ?? ref.model,
    durationMs,
  };
}
