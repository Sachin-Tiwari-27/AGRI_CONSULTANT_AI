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
import type { ReportSectionKey, FinancialModel, AITask } from "@/types";

function resolveCurrency(project: Record<string, unknown>): string {
  return (
    (project.currency as string | null) ||
    detectCurrencyFromCountry(project.country as string | null) ||
    "USD"
  );
}

// ── SSE helpers ────────────────────────────────────────────────────────
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

// ── Auto-populate appendices from project data ─────────────────────────
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

  // Appendix A — Questionnaire summary
  const questionnaireContent = submissions
    .filter((s) => s.submitted_at)
    .map((s) => {
      const lines = [
        `**Round ${s.round}** — Submitted ${new Date(s.submitted_at).toLocaleDateString("en-GB")}\n`,
      ];
      for (const [key, val] of Object.entries(s.answers || {})) {
        if (typeof val === "object" && val !== null && !Array.isArray(val))
          continue; // skip file objects
        const label = key;
        const value = Array.isArray(val)
          ? (val as string[]).join(", ")
          : typeof val === "boolean"
            ? val
              ? "Yes"
              : "No"
            : String(val ?? "");
        if (value) lines.push(`**${label}:** ${value}`);
      }
      return lines.join("\n");
    })
    .join("\n\n---\n\n");

  appendices["appendix_questionnaire"] = {
    key: "appendix_questionnaire",
    title: "Appendix A — Questionnaire Summary",
    content: questionnaireContent || "No questionnaire submissions found.",
    ai_generated: false,
    is_auto_populated: true,
    last_edited_at: now,
    approved: true,
  };

  // Appendix B — Climate data
  appendices["appendix_climate"] = {
    key: "appendix_climate",
    title: "Appendix B — Climate Data",
    content:
      climateData || "Climate data not available — GPS coordinates required.",
    ai_generated: false,
    is_auto_populated: true,
    last_edited_at: now,
    approved: true,
  };

  // Appendix C — Market research sources
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

  // Appendix D — Financial assumptions
  const assumptions = financialModel?.assumptions ?? [];
  appendices["appendix_assumptions"] = {
    key: "appendix_assumptions",
    title: "Appendix D — Financial Assumptions Register",
    content: assumptions.length
      ? assumptions.map((a, i) => `${i + 1}. ${a}`).join("\n")
      : "No assumptions recorded.",
    ai_generated: false,
    is_auto_populated: true,
    last_edited_at: now,
    approved: true,
  };

  // Placeholder appendices (E-I) — check if file already uploaded in questionnaire
  const waterFile = Object.values(allAnswers).find(
    (v: any) => v && typeof v === "object" && v.question_id === "q9",
  ) as any;

  appendices["appendix_water_quality"] = {
    key: "appendix_water_quality",
    title: "Appendix E — Water Quality Report",
    content: waterFile
      ? `Water quality report provided by client.\nFile: ${waterFile.filename}\n\n⬡ PLACEHOLDER: Verify and attach the formal laboratory report.`
      : "⬡ PLACEHOLDER: Water Quality Report\n\nUpload the laboratory EC/TDS/pH analysis report for the water source.\nThis is mandatory for hydroponic projects.",
    ai_generated: false,
    is_placeholder: !waterFile,
    is_auto_populated: !!waterFile,
    last_edited_at: now,
    approved: !!waterFile,
  };

  for (const { key, title, placeholderHint } of [
    {
      key: "appendix_soil_analysis",
      title: "Appendix F — Soil Analysis Report",
      placeholderHint: "Upload soil test results if applicable.",
    },
    {
      key: "appendix_site_survey",
      title: "Appendix G — Site Survey / Map",
      placeholderHint:
        "Upload land survey, cadastral document, or satellite map with boundaries marked.",
    },
    {
      key: "appendix_supplier_quotes",
      title: "Appendix H — Equipment Supplier Quotes",
      placeholderHint:
        "Attach supplier quotes for greenhouse structure, cooling system, and irrigation equipment.",
    },
    {
      key: "appendix_company_profile",
      title: "Appendix I — Company / Firm Profile",
      placeholderHint:
        "Attach consultant firm profile, past project portfolio, and certifications.",
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

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const body = await req.json();
  const { projectId, sectionsToGenerate, stream: useStream = false } = body;

  const { data: project } = await supabase
    .from("projects")
    .select("*, financial_model_override, financial_model_notes")
    .eq("id", projectId)
    .single();

  if (!project || project.consultant_id !== user.id) {
    return NextResponse.json(
      { error: "Not found or forbidden" },
      { status: 404 },
    );
  }

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

  const isIncremental = !!(sectionsToGenerate && existingReport);

  if (useStream) {
    const { stream, send, close } = createSSEStream();
    runFullPipeline({
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
      send,
      close,
    }).catch((err) => {
      console.error("[ReportGen-PR6] Fatal:", err);
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

  // Non-streaming
  const result = await runFullPipeline({
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
    send: () => {},
    close: () => {},
  });
  return NextResponse.json({ success: true, sections: result.generatedKeys });
}

// ── Full 6-phase generation pipeline ──────────────────────────────────
async function runFullPipeline({
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
  send,
  close,
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

  // ── Phase 0: Context gathering (parallel) ──────────────────────────
  send({
    type: "phase",
    phase: 0,
    label: "Gathering market and climate context…",
  });

  let marketResearch: string =
    existingReport?.sections?.context_market_data?.content || "";
  let climateData: string =
    existingReport?.sections?.context_climate_data?.content || "";

  if (!marketResearch) {
    marketResearch = await researchMarket(
      project.crop_types || [],
      project.region || "",
      project.country || "",
    );
  }
  if (!climateData) {
    const gps = parseGPS(project.gps_coordinates || "");
    climateData = gps
      ? await fetchClimateData(gps.lat, gps.lon)
      : "GPS coordinates not provided.";
  }

  // ── Financial model: override → existing → AI ──────────────────────
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
    const cropList = (project.crop_types || []).join(", ");
    financialModel = await callAIJSON<FinancialModel>({
      task: "financial_projection",
      variables: {
        project_title: project.title,
        region: project.region || "Not specified",
        country: project.country || "Not specified",
        currency,
        crop_types: cropList,
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

  // ── Build base variables shared across all section prompts ─────────
  const cropList = (project.crop_types || []).join(", ");

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "full_name, company_name, logo_url, brand_primary_color, brand_secondary_color, brand_footer_text",
    )
    .eq("id", user.id)
    .single();

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
    // Placeholders for upstream section content (filled in Phase 6)
    introduction_content: "",
    market_analysis_content: "",
  };

  // ── Determine which sections to generate ──────────────────────────
  const targetSections: ReportSectionKey[] = sectionsToGenerate
    ? (sectionsToGenerate as ReportSectionKey[])
    : REPORT_SECTIONS.map((s) => s.key);

  // Exclude executive_summary from phased generation — it runs in Phase 6
  const phasedSections = targetSections.filter(
    (k) => k !== "executive_summary",
  );
  const phaseMap = getSectionsByPhase();

  send({
    type: "start",
    sections: targetSections,
    totalSections: targetSections.length,
  });

  const sections: Record<string, unknown> = {
    ...(existingReport?.sections || {}),
  };
  const generatedKeys: string[] = [];

  // ── Technical analysis (needed by multiple sections) ───────────────
  let technicalAnalysis =
    existingReport?.sections?.technical_analysis?.content || "";
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

  // ── Phases 1-5: generate sections in phase order ───────────────────
  for (let phase = 1; phase <= 5; phase++) {
    const phaseSections = (phaseMap.get(phase as any) || []).filter(
      (sc) => phasedSections.includes(sc.key) && sc.aiTask !== null,
    );

    if (!phaseSections.length) continue;

    send({ type: "phase", phase, label: `Phase ${phase} sections…` });

    // Within each phase, can run in parallel (Phase 2, 4, 5 have independent sections)
    const canParallel = phase !== 1 && phase !== 3; // Phase 1 & 3 are sequential
    const tasks = phaseSections.map((sc) => async () => {
      send({ type: "generating", section: sc.key, label: sc.title });

      const sectionVars = {
        ...baseVars,
        questionnaire_answers: trimAnswersForTask(
          allAnswers,
          sc.aiTask as AITask,
          1200,
        ),
      };

      try {
        const resp = await callAI({
          task: sc.aiTask as AITask,
          variables: sectionVars,
          maxTokens: sc.maxTokens,
        });

        const sectionData = {
          key: sc.key,
          title: sc.title,
          content: resp.content,
          ai_generated: true,
          has_placeholders: sc.hasPlaceholders,
          last_edited_at: new Date().toISOString(),
          approved: false,
        };

        sections[sc.key] = sectionData;
        generatedKeys.push(sc.key);

        // Persist after each section so user can see it immediately
        await supabase.from("reports").upsert(
          {
            project_id: projectId,
            sections: { ...sections },
            financial_model: financialModel,
            status: "draft",
          },
          { onConflict: "project_id" },
        );

        send({
          type: "section_complete",
          section: sc.key,
          content: resp.content,
        });

        // Capture key upstream sections for Phase 6 executive summary
        if (sc.key === "introduction")
          baseVars.introduction_content = trimContext(resp.content, 800);
        if (sc.key === "market_analysis")
          baseVars.market_analysis_content = trimContext(resp.content, 1000);
      } catch (err) {
        console.error(`[ReportGen-PR6] Section ${sc.key} failed:`, err);
        sections[sc.key] = {
          key: sc.key,
          title: sc.title,
          content: `> **[Section Generation Failed]**\n\nClick "Regenerate" to retry.`,
          ai_generated: true,
          last_edited_at: new Date().toISOString(),
          approved: false,
        };
        send({
          type: "section_error",
          section: sc.key,
          error: err instanceof Error ? err.message : "Unknown",
        });
      }
    });

    if (canParallel) {
      await Promise.all(tasks.map((t) => t()));
    } else {
      for (const task of tasks) await task();
    }
  }

  // ── Phase 6: Executive Summary (LAST — synthesises everything) ─────
  if (targetSections.includes("executive_summary")) {
    const execConfig = REPORT_SECTIONS.find(
      (s) => s.key === "executive_summary",
    )!;
    send({
      type: "generating",
      section: "executive_summary",
      label: "1. Executive Summary (synthesising all sections)…",
    });

    try {
      const resp = await callAI({
        task: "report_executive_summary",
        variables: {
          ...baseVars,
          questionnaire_answers: trimAnswersForTask(
            allAnswers,
            "report_executive_summary",
            800,
          ),
          // Now has real upstream content from phases 1-5
          introduction_content:
            baseVars.introduction_content || trimContext(marketResearch, 400),
          market_analysis_content:
            baseVars.market_analysis_content ||
            trimContext(marketResearch, 600),
        },
        maxTokens: execConfig.maxTokens,
      });

      sections["executive_summary"] = {
        key: "executive_summary",
        title: execConfig.title,
        content: resp.content,
        ai_generated: true,
        has_placeholders: true,
        last_edited_at: new Date().toISOString(),
        approved: false,
      };
      generatedKeys.push("executive_summary");
      send({
        type: "section_complete",
        section: "executive_summary",
        content: resp.content,
      });
    } catch (err) {
      console.error("[ReportGen-PR6] Executive summary failed:", err);
      send({
        type: "section_error",
        section: "executive_summary",
        error: err instanceof Error ? err.message : "Unknown",
      });
    }
  }

  // ── Context sections (always saved) ───────────────────────────────
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

  // ── Auto-populate appendices ───────────────────────────────────────
  if (!sectionsToGenerate) {
    // only on full generation, not section regeneration
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

  // ── Branding ──────────────────────────────────────────────────────
  const branding = {
    consultant_name: profile?.full_name || user.email || "Consultant",
    company_name: profile?.company_name || "AgriAI Consultancy",
    logo_url: profile?.logo_url || null,
    primary_color: profile?.brand_primary_color || "#1A5C38",
    secondary_color: profile?.brand_secondary_color || "#2E7D52",
    footer_text: profile?.brand_footer_text || null,
  };

  // ── Final save ────────────────────────────────────────────────────
  await supabase.from("reports").upsert(
    {
      project_id: projectId,
      sections,
      financial_model: financialModel,
      branding,
      status: "draft",
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
    detail: `${generatedKeys.length} sections · FM: ${financialModelSource} · ${currency}`,
    metadata: {
      sections_generated: generatedKeys,
      currency,
      financial_model_source: financialModelSource,
    },
  });

  send({ type: "complete", sections: generatedKeys });
  close();

  return { generatedKeys };
}
