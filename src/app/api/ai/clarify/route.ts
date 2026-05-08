import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { callAI, callAIJSON } from "@/lib/ai/ai.service";
import { logProjectEvent } from "@/lib/events";
import {
  detectCurrencyFromCountry,
  serialiseAnswersForPrompt,
} from "@/lib/utils";
import type { AIFlag } from "@/types";

// Only the fields truly needed for gap-detection. Using human-readable
// label matching so the AI sees "Primary Water Source" not "q6".
const CLARIFY_RELEVANT_KEYS = [
  "q4",
  "GPS",
  "q5",
  "Land Area",
  "q6",
  "Water Source",
  "q7",
  "Water Availability",
  "q8",
  "Water Analysis",
  "q10",
  "Power Source",
  "q11",
  "Power Capacity",
  "q14",
  "Target Crops",
  "q16",
  "Technology Level",
  "q17",
  "Agro-Tourism",
  "q18",
  "Target Market",
  "q19",
  "Cold Storage",
  "q20",
  "Budget",
  "q22",
  "Requirements",
];

type ClarificationFlag = Omit<AIFlag, "id" | "status">;

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const body = await req.json();
  const { projectId, submissionId } = body;

  if (!projectId || !submissionId) {
    return NextResponse.json(
      { error: "projectId and submissionId are required" },
      { status: 400 },
    );
  }

  const { data: project } = await supabase
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .single();

  const { data: submission } = await supabase
    .from("questionnaire_submissions")
    .select("*")
    .eq("id", submissionId)
    .single();

  if (!project || !submission) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (project.consultant_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // ── Resolve currency from project field first, then country fallback ──
  // Previously two separate duplicated functions — now uses unified util.
  const currency =
    (project.currency as string | null) ||
    detectCurrencyFromCountry(project.country);

  // ── Sanitise answers before injecting into prompt ─────────────────────
  // Removes file-upload objects, converts booleans, labels keys, truncates.
  // This prevents context-window overflow and malformed JSON from the model.
  const sanitisedAnswers = serialiseAnswersForPrompt(submission.answers || {}, {
    relevantKeys: CLARIFY_RELEVANT_KEYS,
    maxChars: 2500,
    useLabels: true,
  });

  if (!sanitisedAnswers.trim()) {
    return NextResponse.json({
      flags: [],
      message: "No questionnaire answers found to check.",
    });
  }

  const request = {
    task: "clarification_check" as const,
    variables: {
      project_type: project.project_type || "greenhouse",
      region: project.region || "Unknown",
      country: project.country || "Unknown",
      currency,
      crop_types: (project.crop_types || []).join(", ") || "Not specified",
      questionnaire_answers: sanitisedAnswers,
    },
    maxTokens: 1500,
  };

  let flags: ClarificationFlag[] = [];
  try {
    flags = await callAIJSON<ClarificationFlag[]>(request);
    // Defensive: model sometimes returns an object instead of array
    if (!Array.isArray(flags)) {
      console.warn("[Clarify] AI returned non-array:", typeof flags);
      flags = [];
    }
  } catch (aiErr) {
    console.error("[Clarify] AI call failed:", aiErr);
    return NextResponse.json(
      { error: "AI gap check failed. Please try again." },
      { status: 500 },
    );
  }

  // Filter out malformed flag objects (missing required fields)
  const validFlags = flags.filter(
    (f) =>
      f && typeof f.field_name === "string" && typeof f.reason === "string",
  );

  const requiredCount = validFlags.filter(
    (f) => f.severity === "required",
  ).length;
  const recommendedCount = validFlags.filter(
    (f) => f.severity === "recommended",
  ).length;

  if (validFlags.length > 0) {
    const flagRows = validFlags.map((f) => ({
      project_id: projectId,
      submission_id: submissionId,
      field_name: f.field_name,
      reason: f.reason,
      suggested_question:
        f.suggested_question || `Could you please clarify: ${f.field_name}?`,
      severity: f.severity === "required" ? "required" : "recommended",
      status: "pending",
      is_manual: false,
    }));

    const { data: insertedFlags, error } = await supabase
      .from("ai_flags")
      .insert(flagRows)
      .select("*");

    if (error) {
      console.error("[Clarify] DB insert error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await logProjectEvent(supabase, {
      projectId,
      eventType: "ai_gap_check",
      actor: "ai",
      title: `AI gap check completed — ${validFlags.length} gap${validFlags.length !== 1 ? "s" : ""} found`,
      detail: `${requiredCount} required · ${recommendedCount} recommended`,
      metadata: {
        flags_total: validFlags.length,
        flags_required: requiredCount,
        flags_recommended: recommendedCount,
        submission_id: submissionId,
      },
    });

    return NextResponse.json({ flags: insertedFlags });
  }

  // No gaps found
  await logProjectEvent(supabase, {
    projectId,
    eventType: "ai_gap_check",
    actor: "ai",
    title: "AI gap check completed — no gaps found",
    detail: "All questionnaire answers look complete",
    metadata: { flags_total: 0, submission_id: submissionId },
  });

  return NextResponse.json({ flags: [] });
}
