import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { callAI, callAIJSON } from "@/lib/ai/ai.service";
import { researchMarket, fetchClimateData } from "@/lib/ai/search.service";
import { parseGPS } from "@/lib/utils";
import type { ReportSectionKey, FinancialModel } from "@/types";

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

  // Fetch all submissions for this project
  const { data: submissions } = await supabase
    .from("questionnaire_submissions")
    .select("*")
    .eq("project_id", projectId)
    .not("submitted_at", "is", null)
    .order("created_at");

  const allAnswers =
    submissions?.reduce((acc, s) => ({ ...acc, ...s.answers }), {}) || {};

  // ── Fetch existing report to potentially reuse data ──
  const { data: existingReport } = await supabase
    .from("reports")
    .select("*")
    .eq("project_id", projectId)
    .maybeSingle();

  const isIncremental = !!(sectionsToGenerate && existingReport);

  // ── Fetch live data (Reuse if incremental) ─────────────────────────
  let marketResearch: string = existingReport?.sections?.context_market_data?.content || "";
  let climateData: string = existingReport?.sections?.context_climate_data?.content || "";

  if (!isIncremental || !marketResearch || !climateData) {
    const [freshMarket, freshClimate] = await Promise.all([
      !marketResearch ? researchMarket(
        project.crop_types || [],
        project.region || "",
        project.country || "",
      ) : Promise.resolve(marketResearch),
      !climateData ? (() => {
        const gps = parseGPS(project.gps_coordinates || "");
        return gps
          ? fetchClimateData(gps.lat, gps.lon)
          : Promise.resolve("GPS coordinates not provided");
      })() : Promise.resolve(climateData),
    ]);
    marketResearch = freshMarket;
    climateData = freshClimate;
  }

  // ── Shared variables ───────────────────────────────────────────────
  const baseVars = {
    project_title: project.title,
    region: project.region || "Not specified",
    country: project.country || "Not specified",
    crop_types: (project.crop_types || []).join(", "),
    project_type: project.project_type || "greenhouse",
    target_markets: (project.target_market || []).join(", "),
    consultant_name: user.email || "Consultant",
    company_name: "Tech Farming International",
    questionnaire_answers: JSON.stringify(allAnswers, null, 2),
    market_research: marketResearch,
    climate_data: climateData,
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
    water_source: (allAnswers["water_source"] as string) || "Not specified",
    water_quality: (allAnswers["water_ec_tds"] as string) || "Not specified",
    power_source: (allAnswers["power_source"] as string) || "Not specified",
  };

  // ── Technical analysis & Financial model (Reuse if incremental) ──
  let technicalAnalysis = existingReport?.sections?.technical_analysis?.content || "";
  let financialModel = existingReport?.financial_model as FinancialModel || null;

  if (!isIncremental || !technicalAnalysis || !financialModel) {
    const [techResp, finModel] = await Promise.all([
      !technicalAnalysis ? callAI({
        task: "technical_analysis",
        variables: baseVars,
        maxTokens: 1000,
      }) : Promise.resolve({ content: technicalAnalysis }),
      !financialModel ? callAIJSON<FinancialModel>({
        task: "financial_projection",
        variables: baseVars,
        maxTokens: 1500,
      }) : Promise.resolve(financialModel),
    ]);
    technicalAnalysis = techResp.content;
    financialModel = finModel;
  }

  const vars = {
    ...baseVars,
    technical_analysis: technicalAnalysis,
    market_research: marketResearch,
    financial_model_json: JSON.stringify(financialModel, null, 2),
    capex_total: financialModel?.capex_total?.toString() || "0",
    total_annual_revenue:
      financialModel?.total_annual_revenue?.toString() || "0",
    ebitda: financialModel?.ebitda?.toString() || "0",
    ebitda_margin: financialModel?.ebitda_margin?.toString() || "0",
    payback_years: financialModel?.payback_years?.toString() || "0",
    strategic_highlights: `${project.crop_types?.join(", ")} production, year-round capability, ${project.region} location advantage`,
  };

  // ── Generate Sections Sequentially ──
  // Sequential generation is required for free-tier AI keys to avoid 429 Rate Limits
  // which occur when sending too many large requests simultaneously.
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

  const sections: Record<string, any> = {};
  
  for (const key of sectionKeys) {
    const task = taskMap[key];
    if (!task) continue;

    console.log(`[ReportGen] Processing section: ${key}...`);
    try {
      const resp = await callAI({
        task: task as any,
        variables: vars,
        maxTokens: 1200,
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
      // Insert a placeholder so the user knows this specific section failed
      sections[key] = {
        key,
        content: `> [!] Generation Failed\n\nThis section could not be generated due to an AI provider error: ${err instanceof Error ? err.message : 'Unknown error'}.\n\nPlease try clicking "Regenerate" to fix this section.`,
        ai_generated: true,
        last_edited_at: new Date().toISOString(),
        approved: false,
      };
    }
  }

  // Add technical analysis as a section
  sections["technical_analysis"] = {
    key: "technical_analysis",
    content: technicalAnalysis,
    ai_generated: true,
    last_edited_at: new Date().toISOString(),
    approved: false,
  };

  // Store the fetched context data directly in the report for later consultant review
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

  // ── Upsert report ──────────────────────────────────────────────────
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
    await supabase.from("reports").insert({
      project_id: projectId,
      sections,
      financial_model: financialModel,
      status: "draft",
      branding: {
        consultant_name: user.email || "Consultant",
        company_name: "Tech Farming International",
        primary_color: "#1A5C38",
        secondary_color: "#2E7D52",
      },
    });
  }

  // Update project status
  await supabase
    .from("projects")
    .update({ status: "report_draft" })
    .eq("id", projectId);

  return NextResponse.json({ success: true, sections: Object.keys(sections) });
}
