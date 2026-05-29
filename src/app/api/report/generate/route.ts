// ─────────────────────────────────────────────────────────────────────────────
// Key changes:
//   1. Loads report_format from the project's report_format_id (falls back to
//      the built-in REPORT_SECTIONS config for legacy projects).
//   2. For each section, resolves the prompt:
//        a. Custom section with confirmed ai_generated_prompt → use that prompt
//        b. Built-in section with builtin_ai_task → use prompts.store.ts (existing)
//        c. Custom section without prompt → skip with warning
//   3. Snapshots the format onto the report so the editor always knows what
//      sections to show, even if the format changes later.
//   4. All other logic (financial model, streaming, phases, appendices) unchanged.
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  callAI,
  callAIJSON,
  trimAnswersForTask,
  trimContext,
} from "@/lib/ai/ai.service";
import { researchMarket, fetchClimateData } from "@/lib/ai/search.service";
import {
  parseGPS,
  detectCurrencyFromCountry,
  serialiseAnswersForPrompt,
} from "@/lib/utils";
import { logProjectEvent } from "@/lib/events";
import {
  REPORT_SECTIONS,
  REPORT_APPENDICES,
  getSectionsByPhase,
  CONTEXT_SECTION_KEYS,
} from "@/lib/report-section-config";
import { gateway } from "@/lib/ai/gateway";
import type { ReportSectionKey, FinancialModel, AITask } from "@/types";
import type { ReportFormat, ReportFormatSection } from "@/types/report-format";
import { DEFAULT_FORMAT_SECTIONS } from "@/lib/report-format-defaults";

// ── Helpers (unchanged from original) ────────────────────────────────────────

function resolveCurrency(project: Record<string, unknown>): string {
  return (
    (project.currency as string | null) ||
    detectCurrencyFromCountry(project.country as string | null) ||
    "USD"
  );
}

function buildInstructionsBlock(persistent?: string, oneTime?: string): string {
  const parts: string[] = [];
  if (persistent?.trim()) {
    parts.push("**Consultant's standing instructions for this section:**");
    parts.push(persistent.trim());
  }
  if (oneTime?.trim()) {
    parts.push("**One-time instructions for this regeneration:**");
    parts.push(oneTime.trim());
  }
  if (!parts.length) return "";
  return [
    "---",
    ...parts,
    "Apply the above instructions carefully. They override the structural guidance where they conflict.",
    "---",
  ].join("\n");
}

function createSSEStream() {
  const encoder = new TextEncoder();
  let ctrl: ReadableStreamDefaultController<Uint8Array>;
  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      ctrl = c;
    },
  });
  const send = (data: object) => {
    try {
      ctrl.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
    } catch {}
  };
  const close = () => {
    try {
      ctrl.close();
    } catch {}
  };
  return { stream, send, close };
}

// ── NEW: Resolve prompt for a format section ──────────────────────────────────
// Returns { prompt, taskKey } — taskKey is used for answer trimming.
// Returns null if the section cannot be generated (no prompt available).

function resolvePromptForSection(
  section: ReportFormatSection,
  baseVars: Record<string, string>,
  sectionInstructions: Record<string, string>,
  oneTimeInstructions: Record<string, string>,
): { prompt: string; taskKey: string } | null {
  const consultantInstructions = buildInstructionsBlock(
    sectionInstructions[section.key],
    oneTimeInstructions[section.key],
  );
  const varsWithInstructions = {
    ...baseVars,
    consultant_instructions: consultantInstructions,
  };

  // Case 1: Custom prompt confirmed by consultant
  if (section.ai_generated_prompt && section.prompt_confirmed) {
    let prompt = section.ai_generated_prompt;
    for (const [k, v] of Object.entries(varsWithInstructions)) {
      prompt = prompt.replaceAll(`{{${k}}}`, v || "Not specified");
    }
    // Clean any remaining unfilled tokens
    prompt = prompt.replaceAll(/\{\{[^}]+\}\}/g, "Not specified").trim();
    return { prompt, taskKey: section.key };
  }

  // Case 2: Built-in section — use prompts.store.ts via callAI's task path
  if (section.builtin_ai_task) {
    // Return null here — caller uses callAI({ task: builtin_ai_task }) directly
    return null; // signals "use built-in task"
  }

  // Case 3: Custom section with no prompt
  console.warn(
    `[ReportGen] Section "${section.key}" has no confirmed prompt — skipping.`,
  );
  return null;
}

// ── Appendices builder (unchanged) ───────────────────────────────────────────
async function buildAutoAppendices(
  project: any,
  submissions: any[],
  allAnswers: Record<string, unknown>,
  marketResearch: string,
  climateData: string,
  financialModel: FinancialModel | null,
): Promise<Record<string, unknown>> {
  const appendices: Record<string, unknown> = {};
  const now = new Date().toISOString();

  appendices["appendix_questionnaire"] = {
    key: "appendix_questionnaire",
    title: "Appendix A — Questionnaire Summary",
    content:
      submissions
        .filter((s) => s.submitted_at)
        .map((s) => {
          const lines = [
            `**Round ${s.round}** — Submitted ${new Date(s.submitted_at).toLocaleDateString("en-GB")}\n`,
          ];
          for (const [key, val] of Object.entries(s.answers || {})) {
            if (typeof val === "object" && val !== null && !Array.isArray(val))
              continue;
            const value = Array.isArray(val)
              ? (val as string[]).join(", ")
              : typeof val === "boolean"
                ? val
                  ? "Yes"
                  : "No"
                : String(val ?? "");
            if (value) lines.push(`**${key}:** ${value}`);
          }
          return lines.join("\n");
        })
        .join("\n\n---\n\n") || "No questionnaire submissions found.",
    ai_generated: false,
    is_auto_populated: true,
    last_edited_at: now,
    approved: true,
  };

  appendices["appendix_climate"] = {
    key: "appendix_climate",
    title: "Appendix B — Climate Data",
    content: climateData || "Climate data not available.",
    ai_generated: false,
    is_auto_populated: true,
    last_edited_at: now,
    approved: true,
  };

  const sourceLines = marketResearch
    .split("\n")
    .filter((l) => l.match(/\[Source \d+\]/))
    .map((l) => l.replace(/\[Source \d+\]\s*/, "").trim())
    .filter(Boolean);

  appendices["appendix_market_sources"] = {
    key: "appendix_market_sources",
    title: "Appendix C — Market Research Sources",
    content: sourceLines.length
      ? sourceLines.map((s, i) => `${i + 1}. ${s}`).join("\n")
      : "Market research sources not available.",
    ai_generated: false,
    is_auto_populated: true,
    last_edited_at: now,
    approved: true,
  };

  appendices["appendix_assumptions"] = {
    key: "appendix_assumptions",
    title: "Appendix D — Financial Assumptions Register",
    content: financialModel?.assumptions?.length
      ? financialModel.assumptions.map((a, i) => `${i + 1}. ${a}`).join("\n")
      : "No assumptions recorded.",
    ai_generated: false,
    is_auto_populated: true,
    last_edited_at: now,
    approved: true,
  };

  for (const { key, title, placeholderHint } of [
    {
      key: "appendix_water_quality",
      title: "Appendix E — Water Quality Report",
      placeholderHint: "Upload the laboratory EC/TDS/pH analysis report.",
    },
    {
      key: "appendix_soil_analysis",
      title: "Appendix F — Soil Analysis Report",
      placeholderHint: "Upload soil test results if applicable.",
    },
    {
      key: "appendix_site_survey",
      title: "Appendix G — Site Survey / Map",
      placeholderHint: "Upload land survey or satellite map.",
    },
    {
      key: "appendix_supplier_quotes",
      title: "Appendix H — Equipment Supplier Quotes",
      placeholderHint: "Attach supplier quotes.",
    },
    {
      key: "appendix_company_profile",
      title: "Appendix I — Company / Firm Profile",
      placeholderHint: "Attach consultant firm profile.",
    },
  ]) {
    appendices[key] = {
      key,
      title,
      content: `⬡ PLACEHOLDER: ${title.replace(/^Appendix [A-Z] — /, "")}\n\n${placeholderHint}`,
      ai_generated: false,
      is_placeholder: true,
      is_auto_populated: false,
      last_edited_at: now,
      approved: false,
    };
  }

  return appendices;
}

// ── Main handler ──────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const body = await req.json();
  const {
    projectId,
    sectionsToGenerate,
    stream: useStream = false,
    oneTimeInstructions = {},
  } = body;

  const { data: project } = await supabase
    .from("projects")
    .select(
      "*, financial_model_override, financial_model_notes, section_instructions, report_format_id",
    )
    .eq("id", projectId)
    .single();

  if (!project || project.consultant_id !== user.id)
    return NextResponse.json(
      { error: "Not found or forbidden" },
      { status: 404 },
    );

  const currency = resolveCurrency(project as Record<string, unknown>);

  const { data: submissions } = await supabase
    .from("questionnaire_submissions")
    .select("*")
    .eq("project_id", projectId)
    .not("submitted_at", "is", null)
    .order("created_at");

  const allAnswers: Record<string, unknown> =
    submissions?.reduce((acc, s) => ({ ...acc, ...s.answers }), {}) || {};

  if (!submissions?.length || !Object.keys(allAnswers).length) {
    return NextResponse.json(
      {
        error:
          "No questionnaire submissions found. Please collect questionnaire data first.",
      },
      { status: 400 },
    );
  }

  const { data: existingReport } = await supabase
    .from("reports")
    .select("*")
    .eq("project_id", projectId)
    .maybeSingle();

  // Load report format
  let formatSections: ReportFormatSection[] = DEFAULT_FORMAT_SECTIONS;
  let loadedFormat: ReportFormat | null = null;

  if (project.report_format_id) {
    const { data: fmt } = await supabase
      .from("report_formats")
      .select("*")
      .eq("id", project.report_format_id)
      .single();
    if (fmt) {
      loadedFormat = fmt as ReportFormat;
      formatSections = fmt.sections ?? DEFAULT_FORMAT_SECTIONS;
    }
  }

  const isIncremental = !!(sectionsToGenerate && existingReport);

  if (useStream) {
    const { stream, send, close } = createSSEStream();
    runPipeline({
      project,
      user,
      supabase,
      currency,
      allAnswers,
      submissions,
      existingReport,
      isIncremental,
      sectionsToGenerate,
      projectId,
      formatSections,
      loadedFormat,
      send,
      close,
      oneTimeInstructions,
    }).catch((err) => {
      console.error("[ReportGen] Fatal:", err);
      send({ type: "error", error: err.message });
      close();
    });
    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  }

  const result = await runPipeline({
    project,
    user,
    supabase,
    currency,
    allAnswers,
    submissions,
    existingReport,
    isIncremental,
    sectionsToGenerate,
    projectId,
    formatSections,
    loadedFormat,
    send: () => {},
    close: () => {},
    oneTimeInstructions,
  });
  return NextResponse.json({ success: true, sections: result.generatedKeys });
}

// ── Pipeline ──────────────────────────────────────────────────────────────────

async function runPipeline({
  project,
  user,
  supabase,
  currency,
  allAnswers,
  submissions,
  existingReport,
  isIncremental,
  sectionsToGenerate,
  projectId,
  formatSections,
  loadedFormat,
  send,
  close,
  oneTimeInstructions,
}: any) {
  const { data: consultantNotes } = await supabase
    .from("consultant_notes")
    .select("category, title, content, is_pinned")
    .eq("project_id", projectId)
    .order("is_pinned", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(20);

  const notesForReport = consultantNotes?.length
    ? consultantNotes
        .map(
          (n: any) => `[${n.category.toUpperCase()}] ${n.title}:\n${n.content}`,
        )
        .join("\n\n")
    : "No additional consultant research notes provided.";

  const sectionInstructions: Record<string, string> =
    (project as any).section_instructions || {};

  // Phase 0: context
  send({
    type: "phase",
    phase: 0,
    label: "Gathering market and climate context…",
  });

  let marketResearch: string =
    existingReport?.sections?.context_market_data?.content || "";
  let climateData: string =
    existingReport?.sections?.context_climate_data?.content || "";

  if (!marketResearch)
    marketResearch = await researchMarket(
      project.crop_types || [],
      project.region || "",
      project.country || "",
    );
  if (!climateData) {
    const gps = parseGPS(project.gps_coordinates || "");
    climateData = gps
      ? await fetchClimateData(gps.lat, gps.lon)
      : "GPS coordinates not provided.";
  }

  // Financial model resolution (unchanged logic)
  let financialModel: FinancialModel | null = null;
  let financialModelSource = "ai_generated";
  const override = (project as any)
    .financial_model_override as FinancialModel | null;

  if (override?.capex_total !== undefined) {
    financialModel = override;
    financialModelSource = "consultant_override";
  } else if (isIncremental && existingReport?.financial_model) {
    financialModel = existingReport.financial_model;
    financialModelSource = "existing_report";
  } else {
    send({
      type: "generating",
      section: "financial_projection",
      label: "Generating financial model…",
    });
    const trimmedAnswers = trimAnswersForTask(
      allAnswers,
      "financial_projection",
    );
    financialModel = await callAIJSON<FinancialModel>({
      task: "financial_projection",
      variables: {
        project_title: project.title,
        region: project.region || "Not specified",
        country: project.country || "Not specified",
        currency,
        crop_types: (project.crop_types || []).join(", "),
        project_type: project.project_type || "greenhouse",
        target_markets:
          (project.target_market || []).join(", ") || "Local market",
        agro_tourism: project.project_type === "agro_tourism" ? "Yes" : "No",
        greenhouse_area_sqm: project.land_size_sqm
          ? (project.land_size_sqm * 0.35).toFixed(0)
          : "5000",
        nethouse_area_sqm: project.land_size_sqm
          ? (project.land_size_sqm * 0.15).toFixed(0)
          : "2000",
        budget_range: project.budget_range || "Not specified",
        experience_level: project.experience_level || "Not specified",
        questionnaire_answers: trimmedAnswers,
      },
      maxTokens: 2500,
    });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "full_name, company_name, logo_url, brand_primary_color, brand_secondary_color, brand_footer_text",
    )
    .eq("id", user.id)
    .single();

  const cropList = (project.crop_types || []).join(", ");

  const baseVars: Record<string, string> = {
    project_title: project.title,
    region: project.region || "Not specified",
    country: project.country || "Not specified",
    currency,
    crop_types: cropList,
    project_type: project.project_type || "greenhouse",
    target_markets: (project.target_market || []).join(", ") || "Local market",
    consultant_name: profile?.full_name || user.email || "Consultant",
    company_name: profile?.company_name || "AgriAI Consultancy",
    agro_tourism: project.project_type === "agro_tourism" ? "Yes" : "No",
    gps_coordinates: project.gps_coordinates || "Not provided",
    land_size_sqm: project.land_size_sqm?.toString() || "Not provided",
    greenhouse_area_sqm: project.land_size_sqm
      ? (project.land_size_sqm * 0.35).toFixed(0)
      : "5000",
    nethouse_area_sqm: project.land_size_sqm
      ? (project.land_size_sqm * 0.15).toFixed(0)
      : "2000",
    budget_range: project.budget_range || "Not specified",
    experience_level: project.experience_level || "Not specified",
    client_name: project.client_name || "The Client",
    water_source: String(allAnswers["q6"] ?? "Not specified"),
    water_quality: String(allAnswers["q8"] ?? "Not specified"),
    power_source: String(allAnswers["q10"] ?? "Not specified"),
    market_research: trimContext(marketResearch, 3000),
    climate_data: trimContext(climateData, 1000),
    financial_model_json: JSON.stringify(financialModel, null, 2),
    capex_total: `${currency} ${financialModel?.capex_total?.toLocaleString() || "0"}`,
    total_annual_revenue: `${currency} ${financialModel?.total_annual_revenue?.toLocaleString() || "0"}`,
    ebitda: `${currency} ${financialModel?.ebitda?.toLocaleString() || "0"}`,
    ebitda_margin: financialModel?.ebitda_margin?.toString() || "0",
    payback_years: financialModel?.payback_years?.toString() || "0",
    strategic_highlights: `${cropList} production in ${project.region}, ${project.country}`,
    consultant_research_notes: notesForReport,
    questionnaire_answers: serialiseAnswersForPrompt(allAnswers, {
      maxChars: 1500,
    }),
    introduction_content: "",
    market_analysis_content: "",
  };

  // Determine target sections from format
  const allFormatSectionKeys = formatSections.map(
    (s: ReportFormatSection) => s.key,
  );
  const targetKeys: string[] = sectionsToGenerate
    ? (sectionsToGenerate as string[])
    : allFormatSectionKeys;

  // Separate executive_summary (always last)
  const execSection = formatSections.find(
    (s: ReportFormatSection) => s.key === "executive_summary",
  );
  const phasedKeys = targetKeys.filter((k) => k !== "executive_summary");

  send({
    type: "start",
    sections: targetKeys,
    totalSections: targetKeys.length,
  });

  const sections: Record<string, unknown> = {
    ...(existingReport?.sections || {}),
  };
  const generatedKeys: string[] = [];

  // Technical analysis (same logic as before)
  const skipTechnicalRegen =
    isIncremental &&
    Array.isArray(sectionsToGenerate) &&
    !(sectionsToGenerate as string[]).includes("technical_analysis");

  let technicalAnalysis = skipTechnicalRegen
    ? existingReport?.sections?.technical_analysis?.content || ""
    : "";

  if (!technicalAnalysis) {
    send({
      type: "generating",
      section: "technical_analysis",
      label: "Technical analysis…",
    });
    const resp = await callAI({
      task: "technical_analysis",
      variables: {
        ...baseVars,
        questionnaire_answers: trimAnswersForTask(
          allAnswers,
          "technical_analysis",
        ),
        consultant_instructions: buildInstructionsBlock(
          sectionInstructions["technical_analysis"],
        ),
      },
      maxTokens: 1500,
    });
    technicalAnalysis = resp.content;
    sections["technical_analysis"] = {
      key: "technical_analysis",
      content: technicalAnalysis,
      ai_generated: true,
      last_edited_at: new Date().toISOString(),
      approved: false,
    };
  }
  baseVars.technical_analysis = trimContext(technicalAnalysis, 2500);

  // Group format sections by phase
  const phaseMap = new Map<number, ReportFormatSection[]>();
  for (const fs of formatSections) {
    if (!phasedKeys.includes(fs.key)) continue;
    const phase = fs.generation_phase ?? 3;
    phaseMap.set(phase, [...(phaseMap.get(phase) || []), fs]);
  }

  // Generate phases 1-5
  for (let phase = 1; phase <= 5; phase++) {
    const phaseSections = phaseMap.get(phase) || [];
    if (!phaseSections.length) continue;

    send({ type: "phase", phase, label: `Phase ${phase} sections…` });
    const canParallel = phase !== 1 && phase !== 3;

    const tasks = phaseSections.map((fs: ReportFormatSection) => async () => {
      send({ type: "generating", section: fs.key, label: fs.title });

      const sectionVars = {
        ...baseVars,
        questionnaire_answers: trimAnswersForTask(
          allAnswers,
          (fs.builtin_ai_task || "clarification_check") as AITask,
          1200,
        ),
        consultant_instructions: buildInstructionsBlock(
          sectionInstructions[fs.key],
          oneTimeInstructions?.[fs.key],
        ),
      };

      try {
        let content: string;

        if (fs.ai_generated_prompt && fs.prompt_confirmed) {
          // Custom prompt path — call gateway directly
          let prompt = fs.ai_generated_prompt;
          for (const [k, v] of Object.entries(sectionVars)) {
            prompt = prompt.replaceAll(`{{${k}}}`, v || "Not specified");
          }
          prompt = prompt.replaceAll(/\{\{[^}]+\}\}/g, "Not specified").trim();

          const result = await gateway.execute({
            task: fs.key,
            prompt,
            maxTokens: fs.max_tokens,
          });
          content = result.content;
        } else if (fs.builtin_ai_task) {
          // Built-in task path (prompts.store.ts)
          const resp = await callAI({
            task: fs.builtin_ai_task as AITask,
            variables: sectionVars,
            maxTokens: fs.max_tokens,
          });
          content = resp.content;
        } else {
          // No prompt available
          content = `> **[Section skipped — no confirmed prompt]**\n\nAdd a prompt hint in Report Formats → Edit, then regenerate.`;
        }

        sections[fs.key] = {
          key: fs.key,
          title: fs.title,
          content,
          ai_generated: true,
          last_edited_at: new Date().toISOString(),
          approved: false,
        };
        generatedKeys.push(fs.key);

        await supabase
          .from("reports")
          .upsert(
            {
              project_id: projectId,
              sections: { ...sections },
              financial_model: financialModel,
              status: "draft",
            },
            { onConflict: "project_id" },
          );

        send({ type: "section_complete", section: fs.key, content });

        if (fs.key === "introduction")
          baseVars.introduction_content = trimContext(content, 800);
        if (fs.key === "market_analysis")
          baseVars.market_analysis_content = trimContext(content, 1000);
      } catch (err) {
        console.error(`[ReportGen] Section ${fs.key} failed:`, err);
        sections[fs.key] = {
          key: fs.key,
          title: fs.title,
          content: `> **[Section Generation Failed]**\n\nClick "Regenerate" to retry.`,
          ai_generated: true,
          last_edited_at: new Date().toISOString(),
          approved: false,
        };
        send({
          type: "section_error",
          section: fs.key,
          error: err instanceof Error ? err.message : "Unknown",
        });
      }
    });

    if (canParallel) {
      await Promise.all(tasks.map((t: any) => t()));
    } else {
      for (const task of tasks) await task();
    }
  }

  // Phase 6: Executive Summary
  if (execSection && targetKeys.includes("executive_summary")) {
    send({
      type: "generating",
      section: "executive_summary",
      label: "Executive Summary (synthesising all sections)…",
    });

    try {
      let content: string;
      const execVars = {
        ...baseVars,
        questionnaire_answers: trimAnswersForTask(
          allAnswers,
          "report_executive_summary",
          800,
        ),
        introduction_content:
          baseVars.introduction_content || trimContext(marketResearch, 400),
        market_analysis_content:
          baseVars.market_analysis_content || trimContext(marketResearch, 600),
        consultant_instructions: buildInstructionsBlock(
          sectionInstructions["executive_summary"],
        ),
      };

      if (execSection.ai_generated_prompt && execSection.prompt_confirmed) {
        let prompt = execSection.ai_generated_prompt;
        for (const [k, v] of Object.entries(execVars)) {
          prompt = prompt.replaceAll(`{{${k}}}`, v || "Not specified");
        }
        prompt = prompt.replaceAll(/\{\{[^}]+\}\}/g, "Not specified").trim();
        const result = await gateway.execute({
          task: "executive_summary",
          prompt,
          maxTokens: execSection.max_tokens,
        });
        content = result.content;
      } else {
        const resp = await callAI({
          task: "report_executive_summary",
          variables: execVars,
          maxTokens: execSection.max_tokens,
        });
        content = resp.content;
      }

      sections["executive_summary"] = {
        key: "executive_summary",
        title: execSection.title,
        content,
        ai_generated: true,
        has_placeholders: true,
        last_edited_at: new Date().toISOString(),
        approved: false,
      };
      generatedKeys.push("executive_summary");
      send({ type: "section_complete", section: "executive_summary", content });
    } catch (err) {
      console.error("[ReportGen] Executive summary failed:", err);
      send({
        type: "section_error",
        section: "executive_summary",
        error: err instanceof Error ? err.message : "Unknown",
      });
    }
  }

  // Context + appendices
  sections["context_market_data"] = {
    key: "context_market_data",
    content: marketResearch,
    title: "Live Market Research Context",
    ai_generated: true,
    last_edited_at: new Date().toISOString(),
    approved: false,
  };
  sections["context_climate_data"] = {
    key: "context_climate_data",
    content: climateData,
    title: "Location Climate Context",
    ai_generated: true,
    last_edited_at: new Date().toISOString(),
    approved: false,
  };

  if (!sectionsToGenerate) {
    const appendices = await buildAutoAppendices(
      project,
      submissions || [],
      allAnswers,
      marketResearch,
      climateData,
      financialModel,
    );
    Object.assign(sections, appendices);
  }

  const branding = {
    consultant_name: profile?.full_name || user.email || "Consultant",
    company_name: profile?.company_name || "AgriAI Consultancy",
    logo_url: profile?.logo_url || null,
    primary_color: profile?.brand_primary_color || "#1A5C38",
    secondary_color: profile?.brand_secondary_color || "#2E7D52",
    footer_text: profile?.brand_footer_text || null,
  };

  await supabase.from("reports").upsert(
    {
      project_id: projectId,
      sections,
      financial_model: financialModel,
      branding,
      status: "draft",
      report_format_id: loadedFormat?.id ?? null,
      format_snapshot: loadedFormat ? loadedFormat.sections : null,
    },
    { onConflict: "project_id" },
  );

  await supabase
    .from("projects")
    .update({ status: "report_draft" })
    .eq("id", projectId);

  await logProjectEvent(supabase, {
    projectId,
    eventType: "report_generated",
    actor: "ai",
    title: sectionsToGenerate
      ? `Section regenerated: ${sectionsToGenerate.join(", ")}`
      : `Full report generated (${generatedKeys.length} sections)`,
    detail: `${generatedKeys.length} sections · FM: ${financialModelSource} · ${currency}${loadedFormat ? ` · Format: ${loadedFormat.name}` : ""}`,
    metadata: {
      sections_generated: generatedKeys,
      currency,
      financial_model_source: financialModelSource,
      report_format_id: loadedFormat?.id,
    },
  });

  send({ type: "complete", sections: generatedKeys });
  close();

  return { generatedKeys };
}
