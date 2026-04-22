import type { AIRequest, AIResponse, AIProvider, AITask } from "@/types";
import { buildPrompt } from "./prompts.store";

// ── Provider configuration ────────────────────────────────────────────
const PROVIDER_CONFIG: Record<
  AIProvider,
  { baseURL: string; apiKeyEnv: string; defaultModel: string }
> = {
  openrouter: {
    baseURL: "https://openrouter.ai/api/v1",
    apiKeyEnv: "OPENROUTER_API_KEY",
    // Best free model for long-form writing on OpenRouter
    defaultModel: "google/gemma-4-26b-a4b-it:free",
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
  google: {
    baseURL: "https://generativelanguage.googleapis.com/v1beta/openai",
    apiKeyEnv: "GOOGLE_AI_API_KEY",
    defaultModel: "gemini-2.0-flash",
  },
};

// ── Per-task model overrides ──────────────────────────────────────────
// Free tier strategy:
//   - JSON tasks (clarification, financial): use Gemini Flash — it reliably
//     returns clean JSON without markdown wrapping
//   - Long-form writing (report sections): use Gemini Flash or Llama 3.1 70B
//     both have high context windows and good instruction following
//   - Simple tasks: same free model is fine
//
// Paid tier (set AI_PROVIDER=anthropic or change models below):
//   - JSON tasks: claude-haiku-4-5 (fast + cheap)
//   - Report drafting: claude-sonnet-4-5 (best quality)
const TASK_MODEL_OVERRIDES: Partial<Record<AITask, string>> = {
  // If using Google AI, we use their fast and capable models
  clarification_check: "gemini-1.5-flash",
  followup_questions: "gemini-1.5-flash",
  financial_projection: "gemini-2.0-flash",
  call_brief_summary: "gemini-1.5-flash",

  // Analysis tasks
  climate_analysis: "gemini-2.0-flash",
  technical_analysis: "gemini-2.0-flash",
  market_research: "gemini-2.0-flash",

  // Report sections — gemini-2.0-flash is excellent for high-volume drafting
  report_executive_summary: "gemini-2.0-flash",
  report_market_analysis: "gemini-2.0-flash",
  report_business_model: "gemini-2.0-flash",
  report_financial_projection: "gemini-2.0-flash",
  report_risk_mitigation: "gemini-2.0-flash",
  report_conclusion: "gemini-2.0-flash",
};

// ── Main AI call function ─────────────────────────────────────────────
export async function callAI(request: AIRequest): Promise<AIResponse> {
  const providerName = (process.env.AI_PROVIDER || "openrouter") as AIProvider;
  const config = PROVIDER_CONFIG[providerName];

  if (!config) throw new Error(`Unknown AI provider: ${providerName}`);

  const apiKey = process.env[config.apiKeyEnv];
  if (!apiKey)
    throw new Error(
      `Missing API key for provider: ${providerName} — check your .env.local`,
    );

  const model = TASK_MODEL_OVERRIDES[request.task] || config.defaultModel;
  const prompt = buildPrompt(request.task, request.variables);
  const startMs = Date.now();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  };

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

  // Retry with exponential backoff — important for free tier rate limits
  const maxRetries = 3;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    if (attempt > 0) {
      // Wait 2s, 4s before retries — gives rate limiter time to reset
      await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 1000));
      console.warn(
        `[AI] Retry ${attempt}/${maxRetries - 1} for task: ${request.task}`,
      );
    }

    const response = await fetch(`${config.baseURL}/chat/completions`, {
      method: "POST",
      headers,
      body,
    });

    if (response.status === 429) {
      lastError = new Error(`Rate limited (429) on attempt ${attempt + 1}`);
      continue; // retry
    }

    if (response.status === 503 || response.status === 502) {
      lastError = new Error(
        `Model unavailable (${response.status}) — may be overloaded`,
      );
      continue; // retry
    }

    if (!response.ok) {
      const errorStr = await response.text();
      // Don't retry on 400/401/403 — these are config errors
      throw new Error(`AI API error ${response.status}: ${errorStr}`);
    }

    const data = await response.json();

    // Some free models return an error inside a 200 response
    if (data.error) {
      throw new Error(`AI model error: ${JSON.stringify(data.error)}`);
    }

    const content = data.choices?.[0]?.message?.content || "";
    const tokensUsed = data.usage?.total_tokens || 0;

    if (!content) {
      lastError = new Error("AI returned empty content");
      continue; // retry
    }

    return {
      content,
      tokensUsed,
      model: data.model || model,
      provider: providerName,
      durationMs: Date.now() - startMs,
    };
  }

  throw (
    lastError ||
    new Error(
      `AI call failed after ${maxRetries} attempts for task: ${request.task}`,
    )
  );
}

// ── JSON-safe AI call ─────────────────────────────────────────────────
// Robust extraction: handles markdown fences, preamble text, and arrays
export async function callAIJSON<T = unknown>(request: AIRequest): Promise<T> {
  const response = await callAI({
    ...request,
    maxTokens: request.maxTokens || 2000,
  });

  const content = response.content.trim();

  if (process.env.NODE_ENV === "development") {
    console.log(`[AI-JSON] Task: ${request.task} | Model: ${response.model}`);
    console.log(`[AI-JSON] Raw (first 200): ${content.substring(0, 200)}`);
  }

  // Strategy 1: strip markdown fences and parse directly
  const stripped = content
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  try {
    return JSON.parse(stripped) as T;
  } catch {
    // Strategy 2: find the outermost JSON object or array
    const objStart = content.indexOf("{");
    const arrStart = content.indexOf("[");
    const objEnd = content.lastIndexOf("}");
    const arrEnd = content.lastIndexOf("]");

    // Pick whichever valid structure appears first
    let jsonStr: string | null = null;

    if (
      objStart !== -1 &&
      objEnd > objStart &&
      (arrStart === -1 || objStart <= arrStart)
    ) {
      jsonStr = content.substring(objStart, objEnd + 1);
    } else if (arrStart !== -1 && arrEnd > arrStart) {
      jsonStr = content.substring(arrStart, arrEnd + 1);
    }

    if (jsonStr) {
      try {
        return JSON.parse(jsonStr) as T;
      } catch (e) {
        console.error(
          "[AI-JSON] Isolated JSON parse failed:",
          jsonStr.substring(0, 300),
        );
        throw new Error(
          `AI returned malformed JSON for task "${request.task}": ${e instanceof Error ? e.message : "parse error"}`,
        );
      }
    }

    console.error("[AI-JSON] No JSON structure found in:", content);
    throw new Error(
      `AI response for task "${request.task}" contained no JSON. Raw: ${content.substring(0, 200)}`,
    );
  }
}

// ── Log AI usage ──────────────────────────────────────────────────────
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
  }
}
