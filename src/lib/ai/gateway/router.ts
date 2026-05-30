import type { ModelRef, TaskRoute } from "./types";

// ── Model shorthand helpers ───────────────────────────────────────────────────
// Keep model strings in one place so changing a model is a one-line edit.

const M = {
  // OpenRouter free tier (used as high-volume fallbacks)
  owlAlpha: {
    provider: "openrouter",
    model: "openrouter/owl-alpha",
  } as ModelRef,
  nemotronFree: {
    provider: "openrouter",
    model: "nvidia/nemotron-3-super-120b-a12b:free",
  } as ModelRef,
  gptOssFree: {
    provider: "openrouter",
    model: "openai/gpt-oss-120b:free",
  } as ModelRef,
  minimaxFree: {
    provider: "openrouter",
    model: "minimax/minimax-m2.5:free",
  } as ModelRef,
  inclusionFree: {
    provider: "openrouter",
    model: "inclusionai/ring-2.6-1t:free",
  } as ModelRef,

  // Paid / more reliable
  haiku: {
    provider: "anthropic",
    model: "claude-haiku-4-5-20251001",
  } as ModelRef,
  sonnet: { provider: "anthropic", model: "claude-sonnet-4-6" } as ModelRef,
  gpt4oMini: { provider: "openai", model: "gpt-4o-mini" } as ModelRef,
  geminiFlash: { provider: "google", model: "gemini-2.0-flash" } as ModelRef,
};

// ── Default fallback chain ────────────────────────────────────────────────────
// Used when a task has no explicit route. Starts cheap, escalates to reliable.
const DEFAULT_FALLBACK: ModelRef[] = [M.haiku, M.gpt4oMini, M.geminiFlash];

// ── Task routes ───────────────────────────────────────────────────────────────
//
// Design rules:
//   1. Primary should be the model best suited for the task's complexity/cost.
//   2. Fallback chain must cover provider diversity — if primary is OpenRouter,
//      at least one fallback should be Anthropic/OpenAI/Google so a full
//      OpenRouter outage doesn't kill the chain.
//   3. Token budgets come from your existing SECTION_TASK_TOKENS values.
//   4. timeoutMs is optional; defaults to 60 000 in the executor.

export const TASK_ROUTES: Record<string, TaskRoute> = {
  // ── Stage 1 ────────────────────────────────────────────────────────────────
  call_brief_summary: {
    primary: M.gptOssFree,
    fallback: [M.nemotronFree, M.owlAlpha],
    maxTokens: 3600,
  },

  generate_section_prompt: {
    primary: M.gptOssFree,
    fallback: [M.nemotronFree, M.owlAlpha],
    maxTokens: 2000,
    timeoutMs: 60_000,
  },

  // ── Stage 2 ────────────────────────────────────────────────────────────────
  personalize_questionnaire: {
    primary: M.owlAlpha,
    fallback: [M.nemotronFree, M.gptOssFree],
    maxTokens: 3500,
  },

  // ── Stage 3 ────────────────────────────────────────────────────────────────
  clarification_check: {
    primary: M.nemotronFree,
    fallback: [M.gptOssFree, M.owlAlpha],
    maxTokens: 3500,
  },
  followup_questions: {
    primary: M.owlAlpha,
    fallback: [M.nemotronFree, M.gptOssFree],
    maxTokens: 2800,
  },

  // ── Stage 4: analysis ──────────────────────────────────────────────────────
  financial_projection: {
    primary: M.gptOssFree,
    fallback: [M.nemotronFree, M.owlAlpha],
    maxTokens: 7000,
    timeoutMs: 90_000,
  },
  technical_analysis: {
    primary: M.nemotronFree,
    fallback: [M.gptOssFree, M.owlAlpha],
    maxTokens: 5000,
  },
  climate_analysis: {
    primary: M.minimaxFree,
    fallback: [M.gptOssFree, M.owlAlpha],
    maxTokens: 4000,
  },
  market_research: {
    primary: M.minimaxFree,
    fallback: [M.gptOssFree, M.owlAlpha],
    maxTokens: 3000,
  },

  // ── Stage 5: report sections ───────────────────────────────────────────────
  report_executive_summary: {
    primary: M.gptOssFree,
    fallback: [M.nemotronFree, M.owlAlpha],
    maxTokens: 4000,
    timeoutMs: 90_000,
  },
  report_introduction: {
    primary: M.owlAlpha,
    fallback: [M.nemotronFree, M.gptOssFree],
    maxTokens: 3000,
  },
  report_project_overview: {
    primary: M.inclusionFree,
    fallback: [M.nemotronFree, M.gptOssFree],
    maxTokens: 2000,
  },
  report_market_analysis: {
    primary: M.owlAlpha,
    fallback: [M.nemotronFree, M.gptOssFree],
    maxTokens: 3500,
  },
  report_target_market: {
    primary: M.owlAlpha,
    fallback: [M.nemotronFree, M.gptOssFree],
    maxTokens: 2500,
  },
  report_competitive_analysis: {
    primary: M.gptOssFree,
    fallback: [M.nemotronFree, M.inclusionFree],
    maxTokens: 3000,
  },
  report_business_model: {
    primary: M.gptOssFree,
    fallback: [M.nemotronFree, M.gptOssFree],
    maxTokens: 4000,
    timeoutMs: 90_000,
  },
  report_revenue_streams: {
    primary: M.inclusionFree,
    fallback: [M.nemotronFree, M.gptOssFree],
    maxTokens: 2500,
  },
  report_marketing_sales_plan: {
    primary: M.owlAlpha,
    fallback: [M.nemotronFree, M.gptOssFree],
    maxTokens: 2500,
  },
  report_proposed_machinery: {
    primary: M.inclusionFree,
    fallback: [M.nemotronFree, M.gptOssFree],
    maxTokens: 3000,
  },
  report_proposed_timelines: {
    primary: M.owlAlpha,
    fallback: [M.nemotronFree, M.gptOssFree],
    maxTokens: 2500,
  },
  report_quality_assurance: {
    primary: M.gptOssFree,
    fallback: [M.nemotronFree, M.inclusionFree],
    maxTokens: 2500,
  },
  report_financial_projection: {
    primary: M.owlAlpha,
    fallback: [M.nemotronFree, M.gptOssFree],
    maxTokens: 4000,
    timeoutMs: 90_000,
  },
  report_risk_mitigation: {
    primary: M.nemotronFree,
    fallback: [M.owlAlpha, M.gptOssFree],
    maxTokens: 3000,
  },
  report_benefits_impact: {
    primary: M.inclusionFree,
    fallback: [M.nemotronFree, M.gptOssFree],
    maxTokens: 2500,
  },
  report_csr: {
    primary: M.gptOssFree,
    fallback: [M.nemotronFree, M.inclusionFree],
    maxTokens: 2500,
  },
  report_conclusion: {
    primary: M.gptOssFree,
    fallback: [M.nemotronFree, M.inclusionFree],
    maxTokens: 2500,
  },
};

/**
 * Resolve the full route for a task.
 * Falls back to a safe default if the task has no explicit route entry.
 */
export function resolveRoute(task: string): TaskRoute {
  const route = TASK_ROUTES[task];
  if (route) return route;

  console.warn(
    `[Gateway] No explicit route for task "${task}" — using default chain.`,
  );
  return {
    primary: M.inclusionFree,
    fallback: DEFAULT_FALLBACK,
    maxTokens: 1000,
  };
}

/**
 * Returns the full ordered chain: [primary, ...fallback].
 * The executor iterates this list in order.
 */
export function buildChain(route: TaskRoute): ModelRef[] {
  return [route.primary, ...route.fallback];
}
