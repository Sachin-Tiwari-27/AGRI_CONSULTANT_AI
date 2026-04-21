import type { AIRequest, AIResponse, AIProvider, AITask } from "@/types";
import { PROMPTS, buildPrompt } from "./prompts.store";

// ── Provider configuration ────────────────────────────────────────────
const PROVIDER_CONFIG: Record<
  AIProvider,
  { baseURL: string; apiKeyEnv: string; defaultModel: string }
> = {
  openrouter: {
    baseURL: "https://openrouter.ai/api/v1",
    apiKeyEnv: "OPENROUTER_API_KEY",
    defaultModel: "nvidia/nemotron-3-super-120b-a12b:free",
  },
  anthropic: {
    baseURL: "https://api.anthropic.com/v1",
    apiKeyEnv: "ANTHROPIC_API_KEY",
    defaultModel: "claude-sonnet-4-5",
  },
  openai: {
    baseURL: "https://api.openai.com/v1",
    apiKeyEnv: "OPENAI_API_KEY",
    defaultModel: "gpt-4o",
  },
};

// ── Per-task model overrides (use cheap model for simple tasks) ───────
const TASK_MODEL_OVERRIDES: Partial<Record<AITask, string>> = {
  clarification_check: "google/gemma-4-31b-it:free", // fast + cheap for gap detection
  followup_questions: "google/gemma-4-31b-it:free",
  climate_analysis: "google/gemma-4-31b-it:free", // mostly template + data injection
  report_executive_summary: "nvidia/nemotron-3-super-120b-a12b:free",
  report_market_analysis: "nvidia/nemotron-3-super-120b-a12b:free",
  report_business_model: "nvidia/nemotron-3-super-120b-a12b:free",
  report_financial_projection: "nvidia/nemotron-3-super-120b-a12b:free",
  report_risk_mitigation: "nvidia/nemotron-3-super-120b-a12b:free",
  report_conclusion: "nvidia/nemotron-3-super-120b-a12b:free",
  financial_projection: "nvidia/nemotron-3-super-120b-a12b:free",
  market_research: "nvidia/nemotron-3-super-120b-a12b:free",
};

// ── Main AI call function ─────────────────────────────────────────────
export async function callAI(request: AIRequest): Promise<AIResponse> {
  const providerName = (process.env.AI_PROVIDER || "openrouter") as AIProvider;
  const config = PROVIDER_CONFIG[providerName];

  if (!config) throw new Error(`Unknown AI provider: ${providerName}`);

  const apiKey = process.env[config.apiKeyEnv];
  if (!apiKey) throw new Error(`Missing API key for provider: ${providerName}`);

  const model = TASK_MODEL_OVERRIDES[request.task] || config.defaultModel;
  const prompt = buildPrompt(request.task, request.variables);
  const startMs = Date.now();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  };

  // OpenRouter-specific headers
  if (providerName === "openrouter") {
    headers["HTTP-Referer"] =
      process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    headers["X-Title"] = "AgriAI Platform";
  }

  const body = JSON.stringify({
    model,
    max_tokens: request.maxTokens || 2000,
    messages: [{ role: "user", content: prompt }],
  });

  const response = await fetch(`${config.baseURL}/chat/completions`, {
    method: "POST",
    headers,
    body,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`AI API error ${response.status}: ${error}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || "";
  const tokensUsed = data.usage?.total_tokens || 0;

  return {
    content,
    tokensUsed,
    model: data.model || model,
    provider: providerName,
    durationMs: Date.now() - startMs,
  };
}

// ── JSON-safe AI call (for structured outputs) ────────────────────────
export async function callAIJSON<T = unknown>(request: AIRequest): Promise<T> {
  const response = await callAI({
    ...request,
    maxTokens: request.maxTokens || 2000,
  });
  const cleaned = response.content
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  return JSON.parse(cleaned) as T;
}

// ── Log AI usage to Supabase ──────────────────────────────────────────
export async function logAIUsage(
  response: AIResponse,
  task: AITask,
  projectId?: string,
  consultantId?: string,
) {
  try {
    const { createServiceClient } = await import("@/lib/supabase/server");
    const supabase = await createServiceClient();
    await supabase.from("ai_usage_log").insert({
      project_id: projectId,
      consultant_id: consultantId,
      task,
      model: response.model,
      provider: response.provider,
      tokens_used: response.tokensUsed,
      duration_ms: response.durationMs,
    });
  } catch (err) {
    console.error("Failed to log AI usage:", err);
    // Non-fatal — don't break the flow
  }
}
