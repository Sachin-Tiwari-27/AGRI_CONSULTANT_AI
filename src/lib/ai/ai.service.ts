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
    defaultModel: "minimax/minimax-m2.5:free",
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
  clarification_check: "minimax/minimax-m2.5:free",
  followup_questions: "minimax/minimax-m2.5:free",
  financial_projection: "minimax/minimax-m2.5:free",
  call_brief_summary: "minimax/minimax-m2.5:free",
  climate_analysis: "minimax/minimax-m2.5:free",
  technical_analysis: "minimax/minimax-m2.5:free",
  market_research: "minimax/minimax-m2.5:free",
  report_executive_summary: "google/gemini-2.0-flash-001",
  report_market_analysis: "google/gemini-2.0-flash-001",
  report_business_model: "google/gemini-2.0-flash-001",
  report_financial_projection: "google/gemini-2.0-flash-001",
  report_risk_mitigation: "google/gemini-2.0-flash-001",
  report_conclusion: "google/gemini-2.0-flash-001",
};

// ── Token budget per task (keeps prompts lean) ────────────────────────
// These are OUTPUT token limits. Smaller = faster + less likely to hit rate limits.
const TASK_MAX_TOKENS: Partial<Record<AITask, number>> = {
  clarification_check: 800,
  followup_questions: 600,
  financial_projection: 2000,
  call_brief_summary: 500,
  technical_analysis: 800,
  climate_analysis: 600,
  market_research: 700,
  report_executive_summary: 12000,
  report_market_analysis: 12000,
  report_business_model: 12000,
  report_financial_projection: 12000,
  report_risk_mitigation: 12000,
  report_conclusion: 12000,
};

// ── Context trimming helpers ──────────────────────────────────────────
// Questionnaire answers injected into prompts can be enormous.
// We trim them to the most relevant fields per task to reduce token usage.

const RELEVANT_ANSWER_KEYS: Partial<Record<AITask, string[]>> = {
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
    "water_source",
    "water_ec_tds",
    "power_source",
    "land_size",
    "gps",
    "crop_types",
    "technology_level",
    "budget",
  ],
  clarification_check: [
    "q4",
    "q5",
    "q6",
    "q7",
    "q8",
    "q10",
    "q14",
    "q20",
    "water_source",
    "water_ec_tds",
    "power_source",
    "gps",
  ],
  report_executive_summary: ["q14", "q16", "q17", "q18", "q20", "q22"],
  report_market_analysis: ["q14", "q18", "q19", "q20"],
  report_business_model: ["q14", "q16", "q17", "q18", "q19"],
  report_financial_projection: ["q5", "q14", "q16", "q20"],
  report_risk_mitigation: ["q6", "q7", "q10", "q14", "q16"],
  report_conclusion: ["q14", "q17", "q18", "q20", "q22"],
};

/**
 * Trim questionnaire answers to only relevant fields for a given task.
 * Falls back to all answers if no filter is defined.
 * Also caps the total JSON size to prevent prompt bloat.
 */
export function trimAnswersForTask(
  answers: Record<string, unknown>,
  task: AITask,
  maxChars = 1500,
): string {
  const relevantKeys = RELEVANT_ANSWER_KEYS[task];
  let filtered: Record<string, unknown>;

  if (relevantKeys) {
    filtered = Object.fromEntries(
      Object.entries(answers).filter(([k]) =>
        relevantKeys.some((rk) => k.toLowerCase().includes(rk.toLowerCase())),
      ),
    );
    // If filter was too aggressive and returned nothing, fall back to all
    if (Object.keys(filtered).length === 0) filtered = answers;
  } else {
    filtered = answers;
  }

  const json = JSON.stringify(filtered, null, 2);
  if (json.length <= maxChars) return json;

  // Truncate gracefully — cut to char limit and close the JSON
  return json.slice(0, maxChars) + "\n  ... (truncated for brevity)\n}";
}

/**
 * Trim a long freeform text (market research, climate data) to a safe length.
 */
export function trimContext(text: string, maxChars = 2000): string {
  if (!text || text.length <= maxChars) return text;
  return text.slice(0, maxChars) + "\n... [truncated]";
}

// ── Rate limiter — simple in-process queue ────────────────────────────
// Ensures we never fire more than N requests per second to the AI API,
// which is the primary cause of 429 errors on free/shared keys.

const REQUEST_QUEUE: Array<() => Promise<void>> = [];
let isProcessingQueue = false;

// Minimum milliseconds between AI API calls
// Increase this if you're still hitting 429s (try 3000 for very tight rate limits)
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
      if (REQUEST_QUEUE.length > 0) {
        // Wait between requests to respect rate limits
        await new Promise((r) => setTimeout(r, MIN_DELAY_MS));
      }
    }
  }
  isProcessingQueue = false;
}

// ── Main AI call function ─────────────────────────────────────────────
export async function callAI(request: AIRequest): Promise<AIResponse> {
  return enqueueRequest(() => _callAI(request));
}

async function _callAI(request: AIRequest): Promise<AIResponse> {
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

  const body = JSON.stringify({
    model,
    max_tokens: maxTokens,
    messages: [{ role: "user", content: prompt }],
  });

  // Retry with exponential backoff
  const maxRetries = 4;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    if (attempt > 0) {
      // Exponential backoff: 2s, 4s, 8s
      const waitMs = Math.pow(2, attempt) * 1000;
      console.log(
        `[AI] Provider: ${providerName} | Model: ${model} | Task: ${request.task}`,
      );
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
      // Try to respect Retry-After header if present
      const retryAfter = response.headers.get("Retry-After");
      const waitMs = retryAfter
        ? parseInt(retryAfter) * 1000
        : Math.pow(2, attempt + 1) * 1000;
      console.log(
        `[AI] Provider: ${providerName} | Model: ${model} | Task: ${request.task}`,
      );
      console.warn(`[AI] 429 Rate limited — waiting ${waitMs}ms before retry`);
      await new Promise((r) => setTimeout(r, waitMs));
      lastError = new Error(`Rate limited (429) on attempt ${attempt + 1}`);
      continue;
    }

    if (response.status === 503 || response.status === 502) {
      lastError = new Error(
        `Model unavailable (${response.status}) — may be overloaded`,
      );
      continue;
    }

    if (!response.ok) {
      const errorStr = await response.text();
      throw new Error(`AI API error ${response.status}: ${errorStr}`);
    }

    const data = await response.json();

    if (data.error) {
      throw new Error(`AI model error: ${JSON.stringify(data.error)}`);
    }

    const content = data.choices?.[0]?.message?.content || "";
    const tokensUsed = data.usage?.total_tokens || 0;

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
    console.log(`[AI-JSON] Raw (first 200): ${content.substring(0, 200)}`);
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
