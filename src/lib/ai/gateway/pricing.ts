// ── Model pricing ─────────────────────────────────────────────────────────────
//
// Prices are in USD per 1 000 000 tokens.
// Sources: provider pricing pages as of mid-2025.
// Add new models here as you onboard them — the gateway picks up the entry
// automatically. Unknown models get a zero estimate rather than crashing.

export interface ModelPricing {
  inputPer1M: number;
  outputPer1M: number;
}

export const MODEL_PRICING: Record<string, ModelPricing> = {
  // ── Anthropic ────────────────────────────────────────────────────────────
  "claude-haiku-4-5-20251001":  { inputPer1M: 0.80,  outputPer1M: 4.00  },
  "claude-sonnet-4-6":          { inputPer1M: 3.00,  outputPer1M: 15.00 },
  "claude-opus-4-6":            { inputPer1M: 15.00, outputPer1M: 75.00 },

  // ── OpenAI ───────────────────────────────────────────────────────────────
  "gpt-4o-mini":                { inputPer1M: 0.15,  outputPer1M: 0.60  },
  "gpt-4o":                     { inputPer1M: 5.00,  outputPer1M: 15.00 },

  // ── Google ───────────────────────────────────────────────────────────────
  "gemini-2.0-flash":           { inputPer1M: 0.10,  outputPer1M: 0.40  },
  "gemini-1.5-pro":             { inputPer1M: 3.50,  outputPer1M: 10.50 },

  // ── OpenRouter free tier (all $0) ────────────────────────────────────────
  "openrouter/owl-alpha":                          { inputPer1M: 0, outputPer1M: 0 },
  "nvidia/nemotron-3-super-120b-a12b:free":        { inputPer1M: 0, outputPer1M: 0 },
  "openai/gpt-oss-120b:free":                      { inputPer1M: 0, outputPer1M: 0 },
  "minimax/minimax-m2.5:free":                     { inputPer1M: 0, outputPer1M: 0 },
  "inclusionai/ring-2.6-1t:free":                  { inputPer1M: 0, outputPer1M: 0 },
};

/**
 * Estimate the cost in USD for a completed request.
 *
 * @param model      The model string echoed back by the provider.
 * @param totalTokens Total tokens from usage.total_tokens.
 *                   We estimate a 70/30 input/output split when the provider
 *                   doesn't break it down further.
 */
export function estimateCost(model: string, totalTokens: number): number {
  const pricing = MODEL_PRICING[model];
  if (!pricing || totalTokens === 0) return 0;

  // Conservative 70 / 30 split when we only have total_tokens
  const inputTokens  = Math.round(totalTokens * 0.7);
  const outputTokens = Math.round(totalTokens * 0.3);

  return (
    (inputTokens  / 1_000_000) * pricing.inputPer1M +
    (outputTokens / 1_000_000) * pricing.outputPer1M
  );
}

/**
 * Precise cost estimate when both input and output token counts are available.
 */
export function estimateCostDetailed(
  model: string,
  inputTokens: number,
  outputTokens: number,
): number {
  const pricing = MODEL_PRICING[model];
  if (!pricing) return 0;

  return (
    (inputTokens  / 1_000_000) * pricing.inputPer1M +
    (outputTokens / 1_000_000) * pricing.outputPer1M
  );
}
