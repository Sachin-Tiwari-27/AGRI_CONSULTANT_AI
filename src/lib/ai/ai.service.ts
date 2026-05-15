import type { AIRequest, AIResponse, AIProvider, AITask } from "@/types";
import { buildPrompt } from "./prompts.store";
import { serialiseAnswersForPrompt } from "@/lib/utils";
import { SECTION_TASK_TOKENS } from "@/lib/report-section-config";

// ── Provider configuration ────────────────────────────────────────────
const PROVIDER_CONFIG: Record<
  AIProvider,
  { baseURL: string; apiKeyEnv: string; defaultModel: string }
> = {
  openrouter: {
    baseURL: "https://openrouter.ai/api/v1",
    apiKeyEnv: "OPENROUTER_API_KEY",
    defaultModel: "openrouter/owl-alpha",
  },
  anthropic: {
    baseURL: "https://api.anthropic.com/v1",
    apiKeyEnv: "ANTHROPIC_API_KEY",
    defaultModel: "claude-3-5-haiku-latest",
  },
  openai: {
    baseURL: "https://api.openai.com/v1",
    apiKeyEnv: "OPENAI_API_KEY",
    defaultModel: "gpt-4o-mini",
  },
  google: {
    baseURL: "https://generativelanguage.googleapis.com/v1beta/openai",
    apiKeyEnv: "GOOGLE_AI_API_KEY",
    defaultModel: "gemini-2.0-flash",
  },
};

// ── Per-task model overrides ──────────────────────────────────────────
const TASK_MODEL_OVERRIDES: Partial<Record<AITask, string>> = {
  clarification_check: "nvidia/nemotron-3-super-120b-a12b:free",
  followup_questions: "openrouter/owl-alpha",
  financial_projection: "openai/gpt-oss-120b:free",
  call_brief_summary: "openai/gpt-oss-120b:free",
  climate_analysis: "minimax/minimax-m2.5:free",
  technical_analysis: "nvidia/nemotron-3-super-120b-a12b:free",
  market_research: "minimax/minimax-m2.5:free",
  report_introduction: "openrouter/owl-alpha",
  report_project_overview: "inclusionai/ring-2.6-1t:free",
  report_target_market: "openrouter/owl-alpha",
  report_competitive_analysis: "openai/gpt-oss-120b:free",
  report_revenue_streams: "inclusionai/ring-2.6-1t:free",
  report_marketing_sales_plan: "openrouter/owl-alpha",
  report_proposed_machinery: "inclusionai/ring-2.6-1t:free",
  report_proposed_timelines: "openrouter/owl-alpha",
  report_quality_assurance: "openai/gpt-oss-120b:free",
  report_benefits_impact: "inclusionai/ring-2.6-1t:free",
  report_csr: "openai/gpt-oss-120b:free",
  report_executive_summary: "openai/gpt-oss-120b:free",
  report_market_analysis: "nvidia/nemotron-3-super-120b-a12b:free",
  report_business_model: "openai/gpt-oss-120b:free",
  report_financial_projection: "openrouter/owl-alpha",
  report_risk_mitigation: "nvidia/nemotron-3-super-120b-a12b:free",
  report_conclusion: "openai/gpt-oss-120b:free",
};

// ── Token budgets per task ────────────────────────────────────────────
const TASK_MAX_TOKENS: Partial<Record<AITask, number>> = {
  clarification_check: 3500,
  followup_questions: 2800,
  financial_projection: 7000,
  call_brief_summary: 3600,
  technical_analysis: 5000,
  climate_analysis: 4000,
  market_research: 3000,
  personalize_questionnaire: 3500,
  ...SECTION_TASK_TOKENS,
};

// ── Keys relevant per task — used by serialiseAnswersForPrompt ────────
// Maps task names to the questionnaire question IDs that matter for that task.
// Using the raw question IDs here; serialiseAnswersForPrompt will apply labels.
export const RELEVANT_ANSWER_KEYS: Partial<Record<AITask, string[]>> = {
  technical_analysis: [
    "q4",
    "q5",
    "q6",
    "q7",
    "q8",
    "q10",
    "q11",
    "q12",
    "q13",
    "q14",
    "q16",
    "q17",
    "q20",
  ],
  clarification_check: [
    "q4",
    "q5",
    "q6",
    "q7",
    "q8",
    "q10",
    "q11",
    "q12",
    "q13",
    "q14",
    "q16",
    "q17",
    "q18",
    "q19",
    "q20",
    "q22",
  ],
  report_executive_summary: ["q14", "q16", "q17", "q18", "q20", "q22"],
  report_market_analysis: ["q14", "q18", "q19", "q20"],
  report_business_model: ["q14", "q16", "q17", "q18", "q19"],
  report_financial_projection: ["q5", "q14", "q16", "q20"],
  report_risk_mitigation: ["q6", "q7", "q10", "q14", "q16"],
  report_conclusion: ["q14", "q17", "q18", "q20", "q22"],
};

/**
 * Prepares questionnaire answers for injection into an AI prompt.
 * Uses the shared sanitiseAnswers util — strips file objects, applies labels,
 * filters to relevant keys for the task, hard-truncates to maxChars.
 *
 * Previously this was a private trimAnswersForTask() with separate
 * sanitisation logic; now delegates to utils.ts for consistency.
 */
export function trimAnswersForTask(
  answers: Record<string, unknown>,
  task: AITask,
  maxChars = 2000,
): string {
  return serialiseAnswersForPrompt(answers, {
    relevantKeys: RELEVANT_ANSWER_KEYS[task],
    maxChars,
    useLabels: true,
  });
}

export function trimContext(text: string, maxChars = 2000): string {
  if (!text || text.length <= maxChars) return text;
  return text.slice(0, maxChars) + "\n... [truncated]";
}

// ── Rate limiter ──────────────────────────────────────────────────────
const REQUEST_QUEUE: Array<() => Promise<void>> = [];
let isProcessingQueue = false;
const MIN_DELAY_MS = Number(process.env.AI_REQUEST_DELAY_MS ?? 1500);

async function enqueueRequest<T>(fn: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    REQUEST_QUEUE.push(async () => {
      try {
        resolve(await fn());
      } catch (e) {
        reject(e);
      }
    });
    if (!isProcessingQueue) processQueue();
  });
}

async function processQueue() {
  if (isProcessingQueue) return;
  isProcessingQueue = true;
  while (REQUEST_QUEUE.length > 0) {
    const next = REQUEST_QUEUE.shift();
    if (next) {
      await next();
      if (REQUEST_QUEUE.length > 0)
        await new Promise((r) => setTimeout(r, MIN_DELAY_MS));
    }
  }
  isProcessingQueue = false;
}

// ── Main AI call ──────────────────────────────────────────────────────
export async function callAI(request: AIRequest): Promise<AIResponse> {
  return enqueueRequest(() => _callAI(request));
}

async function _callAI(request: AIRequest): Promise<AIResponse> {
  const providerName = (process.env.AI_PROVIDER || "openrouter") as AIProvider;
  const config = PROVIDER_CONFIG[providerName];
  if (!config) throw new Error(`Unknown AI provider: ${providerName}`);

  const apiKey = process.env[config.apiKeyEnv];
  if (!apiKey) throw new Error(`Missing API key for provider: ${providerName}`);

  const model = TASK_MODEL_OVERRIDES[request.task] || config.defaultModel;
  const prompt = buildPrompt(request.task, request.variables);
  const maxTokens = request.maxTokens ?? TASK_MAX_TOKENS[request.task] ?? 1000;
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

  console.log(
    `[AI] Task: ${request.task} | Provider: ${providerName} | Model: ${model} | MaxTokens: ${maxTokens}`,
  );

  const body = JSON.stringify({
    model,
    max_tokens: maxTokens,
    messages: [{ role: "user", content: prompt }],
  });

  const maxRetries = 4;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    if (attempt > 0) {
      const waitMs = Math.pow(2, attempt) * 1000;
      console.warn(
        `[AI] Retry ${attempt}/${maxRetries - 1} for task: ${request.task} — waiting ${waitMs}ms`,
      );
      await new Promise((r) => setTimeout(r, waitMs));
    }

    const response = await fetch(`${config.baseURL}/chat/completions`, {
      method: "POST",
      headers,
      body,
    });

    if (response.status === 429) {
      const retryAfter = response.headers.get("Retry-After");
      const waitMs = retryAfter
        ? parseInt(retryAfter) * 1000
        : Math.pow(2, attempt + 1) * 1000;
      console.warn(`[AI] 429 Rate limited — waiting ${waitMs}ms`);
      await new Promise((r) => setTimeout(r, waitMs));
      lastError = new Error(`Rate limited (429) on attempt ${attempt + 1}`);
      continue;
    }

    if (response.status === 503 || response.status === 502) {
      lastError = new Error(`Model unavailable (${response.status})`);
      continue;
    }

    if (!response.ok) {
      const errorStr = await response.text();
      throw new Error(`AI API error ${response.status}: ${errorStr}`);
    }

    const data = await response.json();
    if (data.error) {
      // Some providers (e.g. OpenRouter) return 200 OK with an error body for
      // transient upstream failures (idle timeout, bad gateway, etc.).
      // Treat those as retryable instead of surfacing them immediately.
      const errCode = data.error?.code ?? data.error?.status;
      const retryableCodes = [502, 503, 504, "502", "503", "504"];
      const errMsg: string = data.error?.message ?? "";
      const isTransient =
        retryableCodes.includes(errCode) ||
        /timeout|upstream|bad gateway|unavailable/i.test(errMsg);

      if (isTransient) {
        lastError = new Error(
          `AI model error (transient): ${JSON.stringify(data.error)}`,
        );
        console.warn(
          `[AI] Transient model error on attempt ${attempt + 1}:`,
          errMsg,
        );
        continue;
      }

      throw new Error(`AI model error: ${JSON.stringify(data.error)}`);
    }

    const content = data.choices?.[0]?.message?.content || "";
    const tokensUsed = data.usage?.total_tokens || 0;
    const finishReason = data.choices?.[0]?.finish_reason;

    if (finishReason === "length") {
      console.warn(
        `[AI] Task ${request.task} hit token limit (${maxTokens}). Content may be truncated.`,
      );
    }

    if (!content) {
      lastError = new Error("AI returned empty content");
      continue;
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
export async function callAIJSON<T = unknown>(request: AIRequest): Promise<T> {
  const response = await callAI({
    ...request,
    maxTokens: request.maxTokens ?? TASK_MAX_TOKENS[request.task] ?? 1000,
  });

  const content = response.content.trim();

  if (process.env.NODE_ENV === "development") {
    console.log(`[AI-JSON] Task: ${request.task} | Model: ${response.model}`);
    console.log(`[AI-JSON] Raw (first 300): ${content.substring(0, 300)}`);
  }

  const stripped = content
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  try {
    return JSON.parse(stripped) as T;
  } catch {
    const objStart = content.indexOf("{");
    const arrStart = content.indexOf("[");
    const objEnd = content.lastIndexOf("}");
    const arrEnd = content.lastIndexOf("]");

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
