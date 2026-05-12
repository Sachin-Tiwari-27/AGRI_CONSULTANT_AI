import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { callAIJSON } from "@/lib/ai/ai.service";
import { trimAnswersForTask } from "@/lib/ai/ai.service";
import { detectCurrencyFromCountry, parseGPS } from "@/lib/utils";
import { logProjectEvent } from "@/lib/events";
import type { FinancialModel } from "@/types";

/**
 * POST /api/projects/[id]/financial-model/estimate
 *
 * Generates a financial model estimate using AI without requiring a full
 * report to exist first. Stores the result as financial_model_override
 * so it is picked up by report generation automatically.
 *
 * This breaks the circular dependency where the Analysis tab required
 * a report to show any financial data.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { data: project } = await supabase
    .from("projects")
    .select("*, financial_model_override")
    .eq("id", id)
    .eq("consultant_id", user.id)
    .single();

  if (!project)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  // If a consultant override already exists, don't overwrite it without explicit intent
  if (project.financial_model_override) {
    return NextResponse.json(
      {
        error:
          "A financial model override already exists for this project. " +
          "Edit it directly in the Financial Model tab, or pass { force: true } to regenerate.",
      },
      { status: 409 },
    );
  }

  const body = await req.json().catch(() => ({}));
  const force = body?.force === true;

  if (project.financial_model_override && !force) {
    return NextResponse.json(
      { error: "Override exists. Pass { force: true } to regenerate." },
      { status: 409 },
    );
  }

  // Get latest questionnaire submission
  const { data: submissions } = await supabase
    .from("questionnaire_submissions")
    .select("answers")
    .eq("project_id", id)
    .not("submitted_at", "is", null)
    .order("created_at", { ascending: false });

  const allAnswers: Record<string, unknown> =
    submissions?.reduce((acc, s) => ({ ...acc, ...s.answers }), {}) || {};

  const currency =
    (project.currency as string | null) ||
    detectCurrencyFromCountry(project.country) ||
    "USD";

  const landSizeSqm = project.land_size_sqm || 10000;
  const cropTypes = (project.crop_types || ["vegetables"]).join(", ");

  const baseVars = {
    project_title: project.title,
    region: project.region || "Not specified",
    country: project.country || "Not specified",
    currency,
    crop_types: cropTypes,
    project_type: project.project_type || "greenhouse",
    target_markets: (project.target_market || []).join(", ") || "Local market",
    agro_tourism: project.project_type === "agro_tourism" ? "Yes" : "No",
    gps_coordinates: project.gps_coordinates || "Not provided",
    land_size_sqm: landSizeSqm.toString(),
    greenhouse_area_sqm: (landSizeSqm * 0.35).toFixed(0),
    nethouse_area_sqm: (landSizeSqm * 0.15).toFixed(0),
    budget_range: project.budget_range || "Not specified",
    experience_level: project.experience_level || "Not specified",
    consultant_name: user.email || "Consultant",
    company_name: "AgriAI Consultancy",
  };

  const trimmedAnswers = trimAnswersForTask(
    allAnswers,
    "financial_projection",
    1500,
  );

  let financialModel: FinancialModel;
  try {
    financialModel = await callAIJSON<FinancialModel>({
      task: "financial_projection",
      variables: { ...baseVars, questionnaire_answers: trimmedAnswers },
      maxTokens: 2500,
    });
  } catch (err) {
    console.error("[FM Estimate] AI generation failed:", err);
    return NextResponse.json(
      {
        error: "Failed to generate financial model estimate. Please try again.",
      },
      { status: 500 },
    );
  }

  // Recompute derived fields server-side for consistency
  const crops = financialModel.crops ?? [];
  const cropRevenue = crops.reduce((s, c) => s + (c.annual_revenue ?? 0), 0);
  const totalRevenue = cropRevenue + (financialModel.agro_tourism_revenue ?? 0);
  const opex =
    (financialModel.growing_cost_annual ?? 0) +
    (financialModel.manpower_cost_annual ?? 0);
  const ebitda = totalRevenue - opex;
  const ebitdaMargin =
    totalRevenue > 0 ? Math.round((ebitda / totalRevenue) * 100) : 0;
  const totalInvestment =
    (financialModel.capex_total ?? 0) + (financialModel.pre_startup_cost ?? 0);
  const paybackYears =
    ebitda > 0 ? Math.round((totalInvestment / ebitda) * 10) / 10 : 0;

  const sanitised: FinancialModel = {
    ...financialModel,
    crops,
    total_annual_revenue: totalRevenue,
    ebitda,
    ebitda_margin: ebitdaMargin,
    payback_years: paybackYears,
  };

  // Save as financial_model_override so report generation picks it up
  const { error: saveError } = await supabase
    .from("projects")
    .update({ financial_model_override: sanitised })
    .eq("id", id);

  if (saveError) {
    console.error("[FM Estimate] Save error:", saveError);
    return NextResponse.json({ error: saveError.message }, { status: 500 });
  }

  await logProjectEvent(supabase, {
    projectId: id,
    eventType: "financial_model_edited" as any,
    actor: "ai",
    title: "AI financial model estimate generated",
    detail: `${crops.length} crop${crops.length !== 1 ? "s" : ""} · CAPEX ${currency} ${sanitised.capex_total?.toLocaleString()} · Payback ${paybackYears} yrs`,
    metadata: {
      source: "ai_estimate",
      capex_total: sanitised.capex_total,
      total_annual_revenue: totalRevenue,
      ebitda_margin: ebitdaMargin,
      payback_years: paybackYears,
      crop_count: crops.length,
      currency,
    },
  });

  return NextResponse.json({
    financialModel: sanitised,
    source: "ai_estimate",
    message:
      "AI financial estimate generated and saved. You can now edit it in the Financial Model tab.",
  });
}
