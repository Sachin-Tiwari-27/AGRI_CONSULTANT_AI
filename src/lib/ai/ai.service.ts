// ── ai.service.ts ─────────────────────────────────────────────────────────────
//
// This file is now a thin adapter. All routing, retry, rate limiting, circuit
// breaking, and observability live in the gateway package.
//
// The public API (callAI, callAIJSON, logAIUsage, trimAnswersForTask) is
// unchanged so every existing caller continues to work without modification.

import type { AIRequest, AIResponse, AITask } from "@/types";
import { buildPrompt } from "./prompts.store";
import { serialiseAnswersForPrompt } from "@/lib/utils";
import { SECTION_TASK_TOKENS } from "@/lib/report-section-config";
import { gateway, AllModelsExhaustedError } from "./gateway";

// ── Answer serialisation (unchanged) ─────────────────────────────────────────

export const RELEVANT_ANSWER_KEYS: Partial<Record<AITask, string[]>> = {
  technical_analysis: [
    "q4","q5","q6","q7","q8","q10","q11","q12","q13","q14","q16","q17","q20",
  ],
  clarification_check: [
    "q4","q5","q6","q7","q8","q10","q11","q12","q13","q14","q16","q17","q18",
    "q19","q20","q22",
  ],
  report_executive_summary:   ["q14","q16","q17","q18","q20","q22"],
  report_market_analysis:     ["q14","q18","q19","q20"],
  report_business_model:      ["q14","q16","q17","q18","q19"],
  report_financial_projection:["q5","q14","q16","q20"],
  report_risk_mitigation:     ["q6","q7","q10","q14","q16"],
  report_conclusion:          ["q14","q17","q18","q20","q22"],
};

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

// ── callAI ────────────────────────────────────────────────────────────────────

export async function callAI(request: AIRequest): Promise<AIResponse> {
  const prompt = buildPrompt(request.task, request.variables);

  try {
    const result = await gateway.execute({
      task:      request.task,
      prompt,
      maxTokens: request.maxTokens,
      meta: {
        // Meta is passed through when the caller enriches the request.
        // report/generate routes can attach projectId / consultantId here.
        ...(request.meta ?? {}),
      },
    });

    return {
      content:    result.content,
      tokensUsed: result.tokensUsed,
      model:      result.modelUsed,
      provider:   result.providerUsed,
      durationMs: result.durationMs,
    };
  } catch (err) {
    if (err instanceof AllModelsExhaustedError) {
      throw new Error(
        `AI request failed for task "${request.task}": all models exhausted. ` +
        err.message,
      );
    }
    throw err;
  }
}

// ── callAIJSON ────────────────────────────────────────────────────────────────

export async function callAIJSON<T = unknown>(request: AIRequest): Promise<T> {
  const response = await callAI({
    ...request,
    maxTokens: request.maxTokens ?? SECTION_TASK_TOKENS[request.task as keyof typeof SECTION_TASK_TOKENS] ?? 1000,
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
    const objEnd   = content.lastIndexOf("}");
    const arrEnd   = content.lastIndexOf("]");

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
        throw new Error(
          `AI returned malformed JSON for task "${request.task}": ${e instanceof Error ? e.message : "parse error"}`,
        );
      }
    }

    throw new Error(
      `AI response for task "${request.task}" contained no JSON. Raw: ${content.substring(0, 200)}`,
    );
  }
}

// ── logAIUsage ────────────────────────────────────────────────────────────────
// Kept for backward compatibility. The gateway now logs automatically on every
// request, so this is a no-op unless you need to attach projectId/consultantId
// to an already-completed response (e.g. after a manual override).

export async function logAIUsage(
  response: AIResponse,
  task: AITask,
  projectId?: string,
  consultantId?: string,
) {
  // The gateway already logged this request. This function now exists solely
  // to avoid breaking any callers that still call it explicitly.
  // If you need to attach project context to a log entry, pass it via
  // request.meta in callAI instead.
  if (process.env.NODE_ENV === "development") {
    console.info(
      `[AI] logAIUsage called for task=${task} — gateway already logged this.`,
    );
  }
  void response; void task; void projectId; void consultantId;
}
