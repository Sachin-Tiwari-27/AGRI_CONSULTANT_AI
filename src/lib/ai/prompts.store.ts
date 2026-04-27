import type { AITask } from "@/types";

// ── Prompt store ──────────────────────────────────────────────────────
// All prompts live here. Never inline in business logic.
// Variables injected as {{variable_name}} — replaced at call time.
// IMPORTANT: No hardcoded currencies, countries, or region-specific benchmarks.
// All location/currency context comes from project variables.

export const PROMPTS: Record<AITask, string> = {
  // ── Stage 1: summarise call notes ──────────────────────────────────
  call_brief_summary: `
You are an expert agricultural consultant assistant. A consultant just completed an introductory call with a client.

Consultant's raw notes:
{{raw_notes}}

Extract and structure the following into clean JSON:
{
  "client_name": "",
  "region": "",
  "country": "",
  "land_size_sqm": null,
  "crop_types": [],
  "project_type": "",
  "budget_range": "",
  "experience_level": "",
  "target_market": [],
  "funding_status": "",
  "key_concerns": [],
  "consultant_notes": ""
}

Return only valid JSON. No preamble or explanation.
`,

  // ── Stage 3: gap detection ──────────────────────────────────────────
  clarification_check: `
You are a senior agricultural engineer reviewing a client questionnaire for a {{project_type}} project.

Project context:
- Location: {{region}}, {{country}}
- Crop types: {{crop_types}}
- Project type: {{project_type}}
- Local currency: {{currency}}

Client's questionnaire answers:
{{questionnaire_answers}}

Your task: Review these answers and identify gaps, ambiguities, or technically insufficient responses.

Focus on fields that are truly critical for designing this specific project type and location:
- For hydroponic projects: water EC/TDS is mandatory
- For greenhouse projects: GPS/climate data is critical
- For projects in arid regions: water availability and quality are paramount
- For export-focused projects: logistics, cold chain, and certification details are needed

Return a JSON array of flags:
[
  {
    "field_name": "exact field or question name",
    "reason": "clear, specific explanation of why this is needed for THIS project in {{country}}",
    "suggested_question": "polite, specific follow-up question to the client",
    "severity": "required" | "recommended"
  }
]

Return only valid JSON. If there are no gaps, return [].
`,

  // ── Stage 3: draft follow-up questions ─────────────────────────────
  followup_questions: `
You are drafting a follow-up questionnaire on behalf of agricultural consultant {{consultant_name}}.

The client has submitted their initial questionnaire for a {{project_type}} project in {{region}}, {{country}}.
Some critical information is missing for us to proceed with the feasibility analysis.

Your tone should be: professional, helpful, specific. Not bureaucratic.

Accepted flags (what we need from the client):
{{accepted_flags}}

Draft a brief, friendly covering message (2-3 sentences) explaining why we need this additional information.

Format:
{
  "covering_message": "...",
  "questions": [
    { "id": "q1", "label": "...", "type": "text|number|file_upload|boolean", "required": true }
  ]
}

Return only valid JSON.
`,

  // ── Stage 4: technical analysis ────────────────────────────────────
  technical_analysis: `
You are a senior greenhouse and controlled-environment agriculture engineer.

Project data:
- Location: {{region}}, {{country}}
- GPS: {{gps_coordinates}}
- Land area: {{land_size_sqm}} sqm
- Target crops: {{crop_types}}
- Project type: {{project_type}}
- Experience level: {{experience_level}}
- Water source: {{water_source}}
- Water quality (EC/TDS): {{water_quality}}
- Power source: {{power_source}}
- Budget range: {{budget_range}} {{currency}}
- Local currency: {{currency}}
- Target market: {{target_markets}}

Full questionnaire answers:
{{questionnaire_answers}}

Provide a structured technical feasibility analysis SPECIFIC to {{country}} and its climate, regulations, and market conditions. Cover:
1. Recommended greenhouse type and why — factoring in {{country}}'s climate profile
2. Cooling/heating strategy appropriate for {{region}}'s weather patterns
3. Growing technology recommendation (hydroponic vs soil vs NFT) based on water quality and crop selection
4. Infrastructure requirements: irrigation, fertigation, packhouse, cold storage if needed
5. Local supply chain considerations for inputs (substrates, nutrients, seedlings) in {{country}}
6. Technical red flags or prerequisites specific to this location

Write in professional English. Reference actual project parameters. Avoid generic statements.
Max 700 words.
`,

  // ── Stage 4: climate analysis (uses Open-Meteo data) ───────────────
  climate_analysis: `
You are an agricultural climate specialist. Analyse the climate data below for crop viability.

Location: {{region}}, {{country}}
Target crops: {{crop_types}}

Climate data (monthly averages):
{{climate_data}}

Analyse:
1. Optimal growing windows (which months are ideal for each crop given {{country}}'s climate)
2. Stress periods (heat, humidity, cold — and their impact on the target crops)
3. Cooling/heating requirements and recommended strategy for {{region}}
4. Whether year-round cultivation is feasible and under what conditions
5. Specific risks unique to {{region}}, {{country}} and how to mitigate them

Be specific to the crops and location. Do not give generic greenhouse advice.
Max 400 words.
`,

  // ── Stage 4: financial projection ──────────────────────────────────
  financial_projection: `
You are an agricultural financial analyst. Generate a feasibility-level financial model.

IMPORTANT: All monetary values must be in {{currency}}. Do NOT use any other currency.

Project inputs:
- Greenhouse area: {{greenhouse_area_sqm}} sqm
- Net house area: {{nethouse_area_sqm}} sqm  
- Target crops: {{crop_types}}
- Location: {{region}}, {{country}}
- Project type: {{project_type}}
- Local currency: {{currency}}
- Budget range: {{budget_range}} {{currency}}
- Agro-tourism planned: {{agro_tourism}}
- Target market: {{target_markets}}

Use realistic benchmark values for {{country}}'s agricultural market. If you don't have specific data for {{country}}, use conservative regional estimates and note your assumptions. All prices and costs must be denominated in {{currency}}.

Consider local factors for {{country}}:
- Labour costs typical for the region
- Input costs (substrates, nutrients, packaging) for local supply chains
- Realistic farm-gate prices for {{crop_types}} in {{country}}'s market
- Infrastructure costs appropriate for {{country}}

Output must be ONLY a valid JSON object. All numeric values are in {{currency}}. No text before or after the JSON.

{
  "capex_total": 0,
  "pre_startup_cost": 0,
  "crops": [
    {
      "name": "",
      "area_sqm": 0,
      "yield_tonnes": 0,
      "price_per_kg": 0,
      "annual_revenue": 0
    }
  ],
  "agro_tourism_revenue": 0,
  "total_annual_revenue": 0,
  "growing_cost_annual": 0,
  "manpower_cost_annual": 0,
  "ebitda": 0,
  "ebitda_margin": 0,
  "payback_years": 0,
  "assumptions": ["list key assumptions including currency used and country-specific benchmarks applied"]
}
`,

  // ── Stage 4: market research (results injected from Tavily) ─────────
  market_research: `
You are an agricultural market analyst. Synthesise the research data below into a concise market opportunity assessment.

Project: {{project_type}} in {{region}}, {{country}}
Target crops: {{crop_types}}
Target markets: {{target_markets}}
Currency: {{currency}}

Live market research data:
{{search_results}}

Write a market analysis covering:
1. Current demand and supply gaps for {{crop_types}} in {{country}} and the wider region
2. Import dependency and local production opportunity specific to {{country}}
3. Price benchmarks in {{currency}} with seasonal variations
4. Export opportunities relevant to {{country}}'s geographic position
5. Key buyer segments: hypermarkets, restaurants, traders, exporters in {{country}}/region

Use specific data from the research where available. Note source limitations where data is absent.
Write in professional English suitable for a business report.
Max 500 words.
`,

  // ── Stage 5: report sections ────────────────────────────────────────
  report_executive_summary: `
You are writing the Executive Summary of a professional agricultural feasibility report.
This section should be compelling — it's what the bank or investor reads first.

Project: {{project_title}}
Location: {{region}}, {{country}}
Consultant: {{consultant_name}}, {{company_name}}
Currency: {{currency}}

Technical analysis summary:
{{technical_analysis}}

Financial highlights (all in {{currency}}):
- Total investment: {{capex_total}} {{currency}}
- Annual revenue: {{total_annual_revenue}} {{currency}}
- EBITDA: {{ebitda}} {{currency}} ({{ebitda_margin}}%)
- Payback period: {{payback_years}} years

Write a 3-4 paragraph executive summary specific to {{country}} and this project's context. Cover:
- What the project is and where ({{region}}, {{country}})
- Why this location and timing is strategic for {{country}}'s agricultural landscape
- The financial opportunity with figures in {{currency}}
- Why it is viable given local conditions

Tone: confident, professional, evidence-based. Reference specific local context.
`,

  report_market_analysis: `
You are writing the Market Analysis section of a professional agricultural feasibility report.

Project: {{project_title}}
Location: {{region}}, {{country}}
Target crops: {{crop_types}}
Target markets: {{target_markets}}
Currency: {{currency}}

Market research:
{{market_research}}

Climate and competitive advantage:
{{technical_analysis}}

Write a thorough market analysis (400-600 words) covering:
- Market size and demand for {{crop_types}} in {{country}} and region
- Import dependency and local production gaps specific to {{country}}
- Competitive advantage of this location in {{region}}
- Target customer segments in {{country}}'s market
- Price benchmarks in {{currency}} with seasonal variations
- Export opportunities given {{country}}'s position

CRITICAL: Use Markdown tables to display price benchmarks, supply/demand metrics, and market segments. Use {{currency}} for all monetary values.
`,

  report_business_model: `
You are writing the Business Model section of a professional agricultural feasibility report.

Project: {{project_title}}
Location: {{region}}, {{country}}
Currency: {{currency}}
Farm operations:
{{technical_analysis}}

Agro-tourism planned: {{agro_tourism}}
Target market: {{target_markets}}

Write the Business Model section (300-400 words) covering:
- Farm operations overview specific to {{region}}, {{country}}
- Crop cultivation approach and technology
- Distribution channels relevant to {{country}}'s market
- Agro-tourism activities if applicable
- Revenue streams with estimates in {{currency}}

CRITICAL: Include a Markdown table summarizing revenue streams and target audiences. All monetary values in {{currency}}.
`,

  report_financial_projection: `
You are writing the Financial Projection section of a professional agricultural feasibility report.

Currency: {{currency}}
Financial model (all values in {{currency}}):
{{financial_model_json}}

Write a detailed Financial Projection section (400-500 words) explaining:
- Capital investment breakdown in {{currency}}
- Annual production projections by crop
- Revenue calculations with farm-gate prices in {{currency}}
- Operating cost breakdown (growing cost + manpower) in {{currency}}
- EBITDA analysis and margin explanation
- Break-even timeline and ROI

CRITICAL: Use Markdown tables heavily. Show CAPEX breakdown, crop yields/revenues, and operating costs. All values in {{currency}}.
`,

  report_risk_mitigation: `
You are writing the Risk & Mitigation section of a professional agricultural feasibility report.

Project: {{project_title}} in {{region}}, {{country}}
Technical approach: {{project_type}}, {{crop_types}}

Identify risks SPECIFIC to {{country}} and this project type. For each risk, provide actionable mitigation.
Cover: utility reliability in {{country}}, crop production risks, market demand volatility, regulatory/compliance risks for {{country}}, seasonal risks for {{region}}'s climate, currency/financial risks.

CRITICAL: Structure as a Markdown table with columns: "Risk Category" | "Description & Impact" | "Mitigation Strategy"
Max 400 words.
`,

  report_conclusion: `
You are writing the Conclusion section of a professional agricultural feasibility report.

Project: {{project_title}} in {{region}}, {{country}}
Key financial outcomes (in {{currency}}): Investment {{capex_total}}, EBITDA {{ebitda_margin}}%, payback {{payback_years}} years.
Key strategic points: {{strategic_highlights}}

Write a concise, confident 2-3 paragraph conclusion. Reaffirm the project's viability in {{country}}'s agricultural context, its alignment with {{country}}'s food security and agricultural goals, and the path to profitability. End with a clear call to action.
`,
};

// ── Template variable injection ───────────────────────────────────────
export function buildPrompt(
  task: AITask,
  variables: Record<string, string>,
): string {
  let template = PROMPTS[task];
  if (!template) throw new Error(`Unknown AI task: ${task}`);

  for (const [key, value] of Object.entries(variables)) {
    template = template.replaceAll(`{{${key}}}`, value || "Not specified");
  }

  // Warn about any unfilled variables in development
  if (process.env.NODE_ENV === "development") {
    const unfilled = template.match(/\{\{[^}]+\}\}/g);
    if (unfilled) {
      console.warn(`[AI] Unfilled variables in ${task}:`, unfilled);
    }
  }

  return template.trim();
}
