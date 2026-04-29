import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  callAI,
  callAIJSON,
  trimAnswersForTask,
  trimContext,
} from "@/lib/ai/ai.service";
import { researchMarket, fetchClimateData } from "@/lib/ai/search.service";
import { parseGPS } from "@/lib/utils";
import type { ReportSectionKey, FinancialModel } from "@/types";

// Detect currency from project — fallback chain
function resolveCurrency(project: Record<string, unknown>): string {
  return (
    (project.currency as string) ||
    detectCurrencyFromCountry(project.country as string) ||
    "USD"
  );
}

function detectCurrencyFromCountry(country?: string): string | null {
  if (!country) return null;
  const c = country.toLowerCase();
  if (c.includes("oman")) return "OMR";
  if (c.includes("uae") || c.includes("emirates")) return "AED";
  if (c.includes("saudi") || c.includes("ksa")) return "SAR";
  if (c.includes("qatar")) return "QAR";
  if (c.includes("kuwait")) return "KWD";
  if (c.includes("bahrain")) return "BHD";
  if (c.includes("india")) return "INR";
  if (c.includes("jordan")) return "JOD";
  if (c.includes("egypt")) return "EGP";
  if (c.includes("morocco")) return "MAD";
  if (c.includes("kenya")) return "KES";
  if (c.includes("ghana")) return "GHS";
  if (c.includes("nigeria")) return "NGN";
  if (c.includes("uk") || c.includes("britain")) return "GBP";
  if (
    c.includes("euro") ||
    ["france", "germany", "spain", "italy", "netherlands"].some((n) =>
      c.includes(n),
    )
  )
    return "EUR";
  return "USD";
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { projectId, sectionsToGenerate } = await req.json();

  const { data: project } = await supabase
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .single();
  if (!project || project.consultant_id !== user.id)
    return NextResponse.json(
      { error: "Not found or forbidden" },
      { status: 404 },
    );

  // Resolve currency — use project.currency, detect from country, or default USD
  const currency = resolveCurrency(project as Record<string, unknown>);

  // Fetch all submissions for this project
  const { data: submissions } = await supabase
    .from("questionnaire_submissions")
    .select("*")
    .eq("project_id", projectId)
    .not("submitted_at", "is", null)
    .order("created_at");

  const allAnswers: Record<string, unknown> =
    submissions?.reduce((acc, s) => ({ ...acc, ...s.answers }), {}) || {};

  // Server-side guard: block generation if no questionnaire data exists
  if (!submissions || submissions.length === 0 || Object.keys(allAnswers).length === 0) {
    return NextResponse.json(
      { error: "No questionnaire submissions found. Please collect questionnaire data before generating a report." },
      { status: 400 }
    );
  }

  // Fetch consultant research notes to enrich the report
  const { data: consultantNotes } = await supabase
    .from("consultant_notes")
    .select("category, title, content, is_pinned")
    .eq("project_id", projectId)
    .order("is_pinned", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(20);

  const notesForReport = consultantNotes?.length
    ? consultantNotes
        .map((n) => `[${n.category.toUpperCase()}] ${n.title}:\n${n.content}`)
        .join("\n\n")
    : "No additional consultant research notes provided.";

  // Fetch existing report
  const { data: existingReport } = await supabase
    .from("reports")
    .select("*")
    .eq("project_id", projectId)
    .maybeSingle();

  const isIncremental = !!(sectionsToGenerate && existingReport);

  // ── Fetch live context data ───────────────────────────────────────
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

  // ── Shared base variables — ALL dynamic, none hardcoded ──────────
  const cropList = (project.crop_types || []).join(", ");
  const baseVars = {
    project_title: project.title,
    region: project.region || "Not specified",
    country: project.country || "Not specified",
    currency, // ← dynamic per project
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

  // ── Technical analysis ────────────────────────────────────────────
  let technicalAnalysis: string =
    existingReport?.sections?.technical_analysis?.content || "";

  if (!isIncremental || !technicalAnalysis) {
    const trimmedAnswers = trimAnswersForTask(allAnswers, "technical_analysis");
    const techResp = await callAI({
      task: "technical_analysis",
      variables: { ...baseVars, questionnaire_answers: trimmedAnswers },
      maxTokens: 1500, // increased
    });
    technicalAnalysis = techResp.content;
  }

  // ── Financial model ───────────────────────────────────────────────
  let financialModel: FinancialModel | null =
    (existingReport?.financial_model as FinancialModel) || null;

  if (!isIncremental || !financialModel) {
    const trimmedAnswers = trimAnswersForTask(
      allAnswers,
      "financial_projection",
    );
    financialModel = await callAIJSON<FinancialModel>({
      task: "financial_projection",
      variables: { ...baseVars, questionnaire_answers: trimmedAnswers },
      maxTokens: 2500, // increased
    });
  }

  // ── Section variables ─────────────────────────────────────────────
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

  // ── Section generation ────────────────────────────────────────────
  const sectionKeys: ReportSectionKey[] = sectionsToGenerate || [
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

  const sections: Record<string, unknown> = {};

  for (const key of sectionKeys) {
    const task = taskMap[key];
    if (!task) continue;

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
        maxTokens: 16000, // INCREASED — was 12000, pushing to max for complete sections
      });

      sections[key] = {
        key,
        content: resp.content,
        ai_generated: true,
        last_edited_at: new Date().toISOString(),
        approved: false,
      };
    } catch (err) {
      console.error(`[ReportGen] Failed section ${key}:`, err);
      sections[key] = {
        key,
        content: `> **[Section Generation Failed]**\n\nThis section could not be generated: ${
          err instanceof Error ? err.message : "Unknown error"
        }.\n\nClick "Regenerate" to retry this section individually.`,
        ai_generated: true,
        last_edited_at: new Date().toISOString(),
        approved: false,
      };
    }
  }

  // Store technical analysis and context data
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

  // ── Upsert report ─────────────────────────────────────────────────
  if (existingReport) {
    await supabase
      .from("reports")
      .update({
        sections: { ...existingReport.sections, ...sections },
        financial_model: financialModel,
        status: "draft",
      })
      .eq("project_id", projectId);
  } else {
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, company_name")
      .eq("id", user.id)
      .single();

    await supabase.from("reports").insert({
      project_id: projectId,
      sections,
      financial_model: financialModel,
      status: "draft",
      branding: {
        consultant_name: profile?.full_name || user.email || "Consultant",
        company_name: profile?.company_name || "AgriAI Consultancy",
        primary_color: "#1A5C38",
        secondary_color: "#2E7D52",
      },
    });
  }

  await supabase
    .from("projects")
    .update({ status: "report_draft" })
    .eq("id", projectId);

  return NextResponse.json({ success: true, sections: Object.keys(sections) });
}
