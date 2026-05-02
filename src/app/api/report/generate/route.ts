import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { callAI, callAIJSON, trimAnswersForTask, trimContext } from "@/lib/ai/ai.service";
import { researchMarket, fetchClimateData } from "@/lib/ai/search.service";
import { parseGPS } from "@/lib/utils";
import { logProjectEvent } from "@/lib/events";
import type { ReportSectionKey, FinancialModel } from "@/types";

function resolveCurrency(project: Record<string, unknown>): string {
  return (project.currency as string) || detectCurrencyFromCountry(project.country as string) || "USD";
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
  if (["france","germany","spain","italy","netherlands"].some(n => c.includes(n))) return "EUR";
  return "USD";
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { projectId, sectionsToGenerate } = await req.json();

  // Fetch project — include financial_model_override and financial_model_notes
  const { data: project } = await supabase
    .from("projects")
    .select("*, financial_model_override, financial_model_notes")
    .eq("id", projectId)
    .single();

  if (!project || project.consultant_id !== user.id)
    return NextResponse.json({ error: "Not found or forbidden" }, { status: 404 });

  const currency = resolveCurrency(project as Record<string, unknown>);

  // Questionnaire data
  const { data: submissions } = await supabase
    .from("questionnaire_submissions")
    .select("*")
    .eq("project_id", projectId)
    .not("submitted_at", "is", null)
    .order("created_at");

  const allAnswers: Record<string, unknown> =
    submissions?.reduce((acc, s) => ({ ...acc, ...s.answers }), {}) || {};

  if (!submissions || submissions.length === 0 || Object.keys(allAnswers).length === 0) {
    return NextResponse.json(
      { error: "No questionnaire submissions found. Please collect questionnaire data before generating a report." },
      { status: 400 }
    );
  }

  // Consultant research notes
  const { data: consultantNotes } = await supabase
    .from("consultant_notes")
    .select("category, title, content, is_pinned")
    .eq("project_id", projectId)
    .order("is_pinned", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(20);

  // Merge consultant's financial_model_notes into research notes if present
  const financialModelNotes = (project as any).financial_model_notes
    ? `[FINANCIAL MODEL NOTES — CONSULTANT OVERRIDE]\n${(project as any).financial_model_notes}`
    : null;

  const notesForReport = [
    consultantNotes?.length
      ? consultantNotes.map(n => `[${n.category.toUpperCase()}] ${n.title}:\n${n.content}`).join("\n\n")
      : null,
    financialModelNotes,
  ].filter(Boolean).join("\n\n") || "No additional consultant research notes provided.";

  const { data: existingReport } = await supabase
    .from("reports")
    .select("*")
    .eq("project_id", projectId)
    .maybeSingle();

  const isIncremental = !!(sectionsToGenerate && existingReport);

  // Live context data
  let marketResearch: string = existingReport?.sections?.context_market_data?.content || "";
  let climateData: string = existingReport?.sections?.context_climate_data?.content || "";

  if (!marketResearch) {
    marketResearch = await researchMarket(project.crop_types || [], project.region || "", project.country || "");
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
    greenhouse_area_sqm: project.land_size_sqm ? (project.land_size_sqm * 0.35).toFixed(0) : "5000",
    nethouse_area_sqm: project.land_size_sqm ? (project.land_size_sqm * 0.15).toFixed(0) : "2000",
    budget_range: project.budget_range || "Not specified",
    experience_level: project.experience_level || "Not specified",
    water_source: String(allAnswers["q6"] ?? allAnswers["water_source"] ?? "Not specified"),
    water_quality: String(allAnswers["q8"] ?? allAnswers["water_ec_tds"] ?? "Not specified"),
    power_source: String(allAnswers["q10"] ?? allAnswers["power_source"] ?? "Not specified"),
  };

  // Technical analysis
  let technicalAnalysis: string = existingReport?.sections?.technical_analysis?.content || "";
  if (!isIncremental || !technicalAnalysis) {
    const trimmedAnswers = trimAnswersForTask(allAnswers, "technical_analysis");
    const techResp = await callAI({
      task: "technical_analysis",
      variables: { ...baseVars, questionnaire_answers: trimmedAnswers },
      maxTokens: 1500,
    });
    technicalAnalysis = techResp.content;
  }

  // ── Financial model: consultant override takes priority ───────────
  // If the consultant has saved an override, use it directly.
  // This skips the AI financial_projection call entirely — saving tokens
  // and ensuring the report reflects corrected numbers.
  let financialModel: FinancialModel | null = null;
  let financialModelSource = "ai_generated";

  const override = (project as any).financial_model_override as FinancialModel | null;

  if (override && override.capex_total !== undefined) {
    console.log("[ReportGen] Using consultant financial model override");
    financialModel = override;
    financialModelSource = "consultant_override";
  } else if (isIncremental && existingReport?.financial_model) {
    console.log("[ReportGen] Using existing report financial model (incremental)");
    financialModel = existingReport.financial_model as FinancialModel;
    financialModelSource = "existing_report";
  } else {
    console.log("[ReportGen] Generating financial model via AI");
    const trimmedAnswers = trimAnswersForTask(allAnswers, "financial_projection");
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

  const sectionKeys: ReportSectionKey[] = sectionsToGenerate || [
    "executive_summary", "market_analysis", "business_model",
    "financial_projection", "risk_mitigation", "conclusion",
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
      const trimmedAnswers = trimAnswersForTask(allAnswers, task as import("@/types").AITask, 1200);
      const resp = await callAI({
        task: task as import("@/types").AITask,
        variables: { ...sectionVars, questionnaire_answers: trimmedAnswers },
        maxTokens: 16000,
      });
      sections[key] = {
        key, content: resp.content, ai_generated: true,
        last_edited_at: new Date().toISOString(), approved: false,
      };
    } catch (err) {
      console.error(`[ReportGen] Failed section ${key}:`, err);
      sections[key] = {
        key,
        content: `> **[Section Generation Failed]**\n\nThis section could not be generated: ${err instanceof Error ? err.message : "Unknown error"}.\n\nClick "Regenerate" to retry.`,
        ai_generated: true, last_edited_at: new Date().toISOString(), approved: false,
      };
    }
  }

  sections["technical_analysis"] = { key: "technical_analysis", content: technicalAnalysis, ai_generated: true, last_edited_at: new Date().toISOString(), approved: false };
  sections["context_market_data"] = { key: "context_market_data", content: marketResearch, title: "Live Market Research Context", ai_generated: true, last_edited_at: new Date().toISOString(), approved: false };
  sections["context_climate_data"] = { key: "context_climate_data", content: climateData, title: "Location Climate Context", ai_generated: true, last_edited_at: new Date().toISOString(), approved: false };

  // Upsert report
  if (existingReport) {
    await supabase.from("reports").update({
      sections: { ...existingReport.sections, ...sections },
      financial_model: financialModel,
      status: "draft",
    }).eq("project_id", projectId);
  } else {
    const { data: profile } = await supabase
      .from("profiles").select("full_name, company_name").eq("id", user.id).single();
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

  await supabase.from("projects").update({ status: "report_draft" }).eq("id", projectId);

  // Log event — note whether override was used
  await logProjectEvent(supabase, {
    projectId,
    eventType: "report_generated",
    actor: "ai",
    title: sectionsToGenerate
      ? `Report section regenerated: ${sectionsToGenerate.join(", ")}`
      : "Full report draft generated",
    detail: `${sectionKeys.length} sections · Financial model: ${financialModelSource}`,
    metadata: {
      sections_generated: sectionKeys,
      is_incremental: isIncremental,
      currency,
      financial_model_source: financialModelSource,
    },
  });

  return NextResponse.json({ success: true, sections: Object.keys(sections) });
}
