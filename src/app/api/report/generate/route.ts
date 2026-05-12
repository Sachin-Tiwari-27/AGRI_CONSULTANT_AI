import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  callAI,
  callAIJSON,
  trimAnswersForTask,
  trimContext,
} from "@/lib/ai/ai.service";
import { researchMarket, fetchClimateData } from "@/lib/ai/search.service";
import { parseGPS, detectCurrencyFromCountry } from "@/lib/utils";
import { logProjectEvent } from "@/lib/events";
import type { ReportSectionKey, FinancialModel } from "@/types";

function resolveCurrency(project: Record<string, unknown>): string {
  return (
    (project.currency as string | null) ||
    detectCurrencyFromCountry(project.country as string | null) ||
    "USD"
  );
}

// ── SSE helpers ───────────────────────────────────────────────────────
function createSSEStream() {
  const encoder = new TextEncoder();
  let controller: ReadableStreamDefaultController<Uint8Array>;

  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      controller = c;
    },
  });

  function send(data: object) {
    try {
      controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
    } catch {
      // Stream may have closed
    }
  }

  function close() {
    try {
      controller.close();
    } catch {}
  }

  return { stream, send, close };
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

  if (
    !submissions ||
    submissions.length === 0 ||
    Object.keys(allAnswers).length === 0
  ) {
    return NextResponse.json(
      {
        error:
          "No questionnaire submissions found. Please collect questionnaire data before generating a report.",
      },
      { status: 400 },
    );
  }

  const { data: consultantNotes } = await supabase
    .from("consultant_notes")
    .select("category, title, content, is_pinned")
    .eq("project_id", projectId)
    .order("is_pinned", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(20);

  const financialModelNotes = (project as any).financial_model_notes
    ? `[FINANCIAL MODEL NOTES — CONSULTANT OVERRIDE]\n${(project as any).financial_model_notes}`
    : null;

  const notesForReport =
    [
      consultantNotes?.length
        ? consultantNotes
            .map(
              (n) => `[${n.category.toUpperCase()}] ${n.title}:\n${n.content}`,
            )
            .join("\n\n")
        : null,
      financialModelNotes,
    ]
      .filter(Boolean)
      .join("\n\n") || "No additional consultant research notes provided.";

  const { data: existingReport } = await supabase
    .from("reports")
    .select("*")
    .eq("project_id", projectId)
    .maybeSingle();

  const isIncremental = !!(sectionsToGenerate && existingReport);

  // If streaming, set up SSE and run generation async
  if (useStream) {
    const { stream, send, close } = createSSEStream();

    // Run generation in background — don't await
    runGeneration({
      project,
      user,
      supabase,
      currency,
      allAnswers,
      notesForReport,
      existingReport,
      isIncremental,
      sectionsToGenerate,
      projectId,
      send,
      close,
    }).catch((err) => {
      console.error("[ReportGen-Stream] Fatal error:", err);
      send({ type: "error", error: err.message || "Unknown error" });
      close();
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no", // Disable Nginx buffering
      },
    });
  }

  // Non-streaming path — original behaviour
  const result = await runGeneration({
    project,
    user,
    supabase,
    currency,
    allAnswers,
    notesForReport,
    existingReport,
    isIncremental,
    sectionsToGenerate,
    projectId,
    send: () => {},
    close: () => {},
  });

  return NextResponse.json({ success: true, sections: result.generatedKeys });
}

// ── Core generation logic (shared between streaming and non-streaming) ─
async function runGeneration({
  project,
  user,
  supabase,
  currency,
  allAnswers,
  notesForReport,
  existingReport,
  isIncremental,
  sectionsToGenerate,
  projectId,
  send,
  close,
}: {
  project: any;
  user: any;
  supabase: any;
  currency: string;
  allAnswers: Record<string, unknown>;
  notesForReport: string;
  existingReport: any;
  isIncremental: boolean;
  sectionsToGenerate: string[] | undefined;
  projectId: string;
  send: (data: object) => void;
  close: () => void;
}) {
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
      : "GPS coordinates not provided — enter them in the project details to get climate data.";
  }

  const cropList = (project.crop_types || []).join(", ");
  const baseVars = {
    project_title: project.title,
    region: project.region || "Not specified",
    country: project.country || "Not specified",
    currency,
    crop_types: cropList,
    project_type: project.project_type || "greenhouse",
    target_markets: (project.target_market || []).join(", ") || "Local market",
    consultant_name: user.email || "Consultant",
    company_name: "AgriAI Consultancy",
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
    water_source: String(
      allAnswers["q6"] ?? allAnswers["water_source"] ?? "Not specified",
    ),
    water_quality: String(
      allAnswers["q8"] ?? allAnswers["water_ec_tds"] ?? "Not specified",
    ),
    power_source: String(
      allAnswers["q10"] ?? allAnswers["power_source"] ?? "Not specified",
    ),
  };

  // Technical analysis (always needed)
  let technicalAnalysis: string =
    existingReport?.sections?.technical_analysis?.content || "";
  if (!isIncremental || !technicalAnalysis) {
    const trimmedAnswers = trimAnswersForTask(allAnswers, "technical_analysis");
    const techResp = await callAI({
      task: "technical_analysis",
      variables: { ...baseVars, questionnaire_answers: trimmedAnswers },
      maxTokens: 1500,
    });
    technicalAnalysis = techResp.content;
  }

  // Financial model: override → existing → AI
  let financialModel: FinancialModel | null = null;
  let financialModelSource = "ai_generated";
  const override = (project as any)
    .financial_model_override as FinancialModel | null;

  if (override && override.capex_total !== undefined) {
    financialModel = override;
    financialModelSource = "consultant_override";
  } else if (isIncremental && existingReport?.financial_model) {
    financialModel = existingReport.financial_model as FinancialModel;
    financialModelSource = "existing_report";
  } else {
    const trimmedAnswers = trimAnswersForTask(
      allAnswers,
      "financial_projection",
    );
    financialModel = await callAIJSON<FinancialModel>({
      task: "financial_projection",
      variables: { ...baseVars, questionnaire_answers: trimmedAnswers },
      maxTokens: 2500,
    });
  }

  const trimmedMarket = trimContext(marketResearch, 2500);
  const trimmedClimate = trimContext(climateData, 1000);
  const trimmedTechAnalysis = trimContext(technicalAnalysis, 2500);

  const sectionVars = {
    ...baseVars,
    technical_analysis: trimmedTechAnalysis,
    market_research: trimmedMarket,
    climate_data: trimmedClimate,
    financial_model_json: JSON.stringify(financialModel, null, 2),
    capex_total: `${currency} ${financialModel?.capex_total?.toLocaleString() || "0"}`,
    total_annual_revenue: `${currency} ${financialModel?.total_annual_revenue?.toLocaleString() || "0"}`,
    ebitda: `${currency} ${financialModel?.ebitda?.toLocaleString() || "0"}`,
    ebitda_margin: financialModel?.ebitda_margin?.toString() || "0",
    payback_years: financialModel?.payback_years?.toString() || "0",
    strategic_highlights: `${cropList} production, year-round capability in ${project.country}, ${project.region} location advantage`,
    consultant_research_notes: notesForReport,
  };

  const sectionKeys: ReportSectionKey[] =
    (sectionsToGenerate as ReportSectionKey[]) || [
      "executive_summary",
      "market_analysis",
      "business_model",
      "financial_projection",
      "risk_mitigation",
      "conclusion",
    ];

  const taskMap: Partial<Record<ReportSectionKey, string>> = {
    executive_summary: "report_executive_summary",
    market_analysis: "report_market_analysis",
    business_model: "report_business_model",
    financial_projection: "report_financial_projection",
    risk_mitigation: "report_risk_mitigation",
    conclusion: "report_conclusion",
  };

  // Notify client which sections are coming
  send({ type: "start", sections: sectionKeys });

  const sections: Record<string, unknown> = {};
  const generatedKeys: string[] = [];

  for (const key of sectionKeys) {
    const task = taskMap[key];
    if (!task) continue;

    // Notify client this section is being generated
    send({ type: "generating", section: key });
    console.log(`[ReportGen] Generating section: ${key}`);

    try {
      const trimmedAnswers = trimAnswersForTask(
        allAnswers,
        task as import("@/types").AITask,
        1200,
      );
      const resp = await callAI({
        task: task as import("@/types").AITask,
        variables: { ...sectionVars, questionnaire_answers: trimmedAnswers },
        maxTokens: 16000,
      });

      const sectionData = {
        key,
        content: resp.content,
        ai_generated: true,
        last_edited_at: new Date().toISOString(),
        approved: false,
      };

      sections[key] = sectionData;
      generatedKeys.push(key);

      // Persist this section immediately so the UI can show it
      const updatedSections = {
        ...(existingReport?.sections || {}),
        ...sections,
      };
      await supabase.from("reports").upsert(
        {
          project_id: projectId,
          sections: updatedSections,
          financial_model: financialModel,
          status: "draft",
        },
        { onConflict: "project_id" },
      );

      // Notify client section is complete with content
      send({ type: "section_complete", section: key, content: resp.content });
    } catch (err) {
      console.error(`[ReportGen] Failed section ${key}:`, err);
      const errContent = `> **[Section Generation Failed]**\n\nThis section could not be generated: ${err instanceof Error ? err.message : "Unknown error"}.\n\nClick "Regenerate" to retry.`;

      sections[key] = {
        key,
        content: errContent,
        ai_generated: true,
        last_edited_at: new Date().toISOString(),
        approved: false,
      };

      send({
        type: "section_error",
        section: key,
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  // Add context sections
  sections["technical_analysis"] = {
    key: "technical_analysis",
    content: technicalAnalysis,
    ai_generated: true,
    last_edited_at: new Date().toISOString(),
    approved: false,
  };
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

  // Branding
  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "full_name, company_name, logo_url, brand_primary_color, brand_secondary_color, brand_footer_text",
    )
    .eq("id", user.id)
    .single();

  const branding = {
    consultant_name: profile?.full_name || user.email || "Consultant",
    company_name: profile?.company_name || "AgriAI Consultancy",
    logo_url: profile?.logo_url || null,
    primary_color: profile?.brand_primary_color || "#1A5C38",
    secondary_color: profile?.brand_secondary_color || "#2E7D52",
    footer_text: profile?.brand_footer_text || null,
  };

  // Final upsert with all sections + branding
  const finalSections = {
    ...(existingReport?.sections || {}),
    ...sections,
  };

  await supabase.from("reports").upsert(
    {
      project_id: projectId,
      sections: finalSections,
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
      ? `Report section regenerated: ${sectionsToGenerate.join(", ")}`
      : "Full report draft generated",
    detail: `${sectionKeys.length} sections · Financial model: ${financialModelSource} · Currency: ${currency}`,
    metadata: {
      sections_generated: sectionKeys,
      is_incremental: isIncremental,
      currency,
      financial_model_source: financialModelSource,
    },
  });

  // Signal complete
  send({ type: "complete", sections: generatedKeys });
  close();

  return { generatedKeys };
}
