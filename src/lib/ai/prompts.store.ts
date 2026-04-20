import type { AITask } from '@/types'

// ── Prompt store ──────────────────────────────────────────────────────
// All prompts live here. Never inline in business logic.
// Variables injected as {{variable_name}} — replaced at call time.

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

Client's questionnaire answers:
{{questionnaire_answers}}

Your task: Review these answers and identify gaps, ambiguities, or technically insufficient responses.

Focus on fields that are truly critical for designing this specific project type. For a hydroponic project, water EC/TDS is mandatory. For a greenhouse project, GPS/climate data is critical.

Return a JSON array of flags:
[
  {
    "field_name": "exact field or question name",
    "reason": "clear, specific explanation of why this is needed for THIS project",
    "suggested_question": "polite, specific follow-up question to the client",
    "severity": "required" | "recommended"
  }
]

Return only valid JSON. If there are no gaps, return [].
`,

  // ── Stage 3: draft follow-up questions ─────────────────────────────
  followup_questions: `
You are drafting a follow-up questionnaire on behalf of agricultural consultant {{consultant_name}}.

The client has submitted their initial questionnaire but some critical information is missing.
Your tone should be: professional, helpful, specific. Not bureaucratic.

Accepted flags (what we need from the client):
{{accepted_flags}}

Project context: {{project_type}} in {{region}}, {{country}}

Draft a brief, friendly covering message (2-3 sentences) explaining why we need this additional information, followed by the specific questions. Do not number the covering message — it should read as a natural email paragraph.

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
You are a senior greenhouse engineer at a leading agricultural consultancy in the Middle East.

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
- Budget range: {{budget_range}}

Full questionnaire answers:
{{questionnaire_answers}}

Provide a structured technical feasibility analysis. Cover:
1. Recommended greenhouse type and why (given climate and crop selection)
2. Cooling strategy (pad & fan, fogging, retractable roof — based on climate)
3. Growing technology (hydroponic growbag, NFT, soil — based on crop and water quality)
4. Infrastructure requirements (irrigation, fertigation, packhouse, staff accommodation)
5. Any technical red flags or prerequisites that must be resolved before proceeding

Write in professional English. Be specific — reference the actual project parameters. Do not use generic statements.
Max 600 words.
`,

  // ── Stage 4: climate analysis (uses Open-Meteo data) ───────────────
  climate_analysis: `
You are an agricultural climate specialist. Analyse the climate data below for crop viability.

Location: {{region}}, {{country}}
Target crops: {{crop_types}}

Climate data (monthly averages):
{{climate_data}}

Analyse:
1. Optimal growing windows (which months are ideal for each crop)
2. Stress periods (heat, humidity, cold — and their impact on the target crops)
3. Cooling/heating requirements and recommended strategy
4. Whether year-round cultivation is feasible and under what conditions
5. Specific risks unique to this location and how to mitigate them

Be specific to the crops and location. Do not give generic greenhouse advice.
Max 400 words.
`,

  // ── Stage 4: financial projection ──────────────────────────────────
  financial_projection: `
You are an agricultural financial analyst. Generate a feasibility-level financial model.

Project inputs:
- Greenhouse area: {{greenhouse_area_sqm}} sqm
- Net house area: {{nethouse_area_sqm}} sqm  
- Target crops: {{crop_types}}
- Location: {{region}}, {{country}}
- Project type: {{project_type}}
- Agro-tourism planned: {{agro_tourism}}

Use these benchmark values (adjust for local market if context suggests otherwise):
- Beef tomato yield: 35-40 kg/sqm/year, price OMR 0.70-0.90/kg
- Cherry tomato yield: 28-32 kg/sqm/year, price OMR 1.20-1.50/kg
- Capsicum yield: 18-22 kg/sqm/year, price OMR 0.60-0.80/kg
- Growing cost: ~OMR 0.15-0.20/kg average
- Skilled labour (farm manager/grower): OMR 500-700/month
- Unskilled farm labour: OMR 150-200/month each

Return a JSON financial model:
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
  "assumptions": ["list key assumptions made"]
}

Return only valid JSON.
`,

  // ── Stage 4: market research (results injected from Tavily) ─────────
  market_research: `
You are an agricultural market analyst. Synthesise the research data below into a concise market opportunity assessment.

Project: {{project_type}} in {{region}}, {{country}}
Target crops: {{crop_types}}
Target markets: {{target_markets}}

Live market research data:
{{search_results}}

Write a market analysis covering:
1. Current local market demand and supply gaps
2. Import dependency and local production opportunity
3. Price benchmarks and seasonal price variations
4. Export opportunities (GCC region if relevant)
5. Key buyers: hypermarkets, restaurants, traders, export

Be specific with numbers from the research data where available.
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

Technical analysis summary:
{{technical_analysis}}

Financial highlights:
- Total investment: {{capex_total}}
- Annual revenue: {{total_annual_revenue}}
- EBITDA: {{ebitda}} ({{ebitda_margin}}%)
- Payback period: {{payback_years}} years

Write a 3-4 paragraph executive summary. Cover: what the project is, why the location is strategic, what the financial opportunity is, and why it is viable. Use the Zaher Farm report tone as a reference: confident, professional, evidence-based.
`,

  report_market_analysis: `
You are writing the Market Analysis section of a professional agricultural feasibility report.

Project: {{project_title}}
Location: {{region}}, {{country}}
Target crops: {{crop_types}}
Target markets: {{target_markets}}

Market research:
{{market_research}}

Climate and competitive advantage:
{{technical_analysis}}

Write a thorough market analysis section (400-600 words) covering: market size, import dependency, local supply gaps, competitive advantage of this location/approach, target customer segments, and export opportunities. Use specific numbers where available.
`,

  report_business_model: `
You are writing the Business Model section of a professional agricultural feasibility report.

Project: {{project_title}}
Farm operations:
{{technical_analysis}}

Agro-tourism planned: {{agro_tourism}}

Write the Business Model section (300-400 words) covering: farm operations overview, crop cultivation approach, operation facility, agro-tourism activities (if applicable), and revenue streams. Be specific about the proposed infrastructure.
`,

  report_financial_projection: `
You are writing the Financial Projection section of a professional agricultural feasibility report.

Financial model:
{{financial_model_json}}

Write a clear, detailed Financial Projection section (400-500 words) that explains: the capital investment breakdown, annual production projections by crop, revenue calculations, operating cost breakdown (growing cost + manpower), EBITDA analysis, and break-even/ROI timeline. Present the numbers clearly and explain the methodology.
`,

  report_risk_mitigation: `
You are writing the Risk & Mitigation section of a professional agricultural feasibility report.

Project: {{project_title}} in {{region}}, {{country}}
Technical approach: {{project_type}}, {{crop_types}}

Identify and address the main risks for this specific project type and location. For each risk provide a specific, actionable mitigation strategy. Cover: utility availability, crop production risks (disease, yield), market demand, competition, pricing volatility, and seasonal risks.

Write in a table-compatible format: for each risk, write "Risk:" followed by the description, then "Mitigation:" followed by the strategy. Separate each pair with a blank line.
Max 400 words.
`,

  report_conclusion: `
You are writing the Conclusion section of a professional agricultural feasibility report.

Project: {{project_title}}
Key financial outcomes: Investment {{capex_total}}, EBITDA {{ebitda_margin}}%, payback {{payback_years}} years.
Key strategic points: {{strategic_highlights}}

Write a concise, confident 2-3 paragraph conclusion. Reaffirm the project's viability, its alignment with national food security goals (if relevant), and the path to profitability. End with a call to action for the investor/bank.
`,

}

// ── Template variable injection ───────────────────────────────────────
export function buildPrompt(task: AITask, variables: Record<string, string>): string {
  let template = PROMPTS[task]
  if (!template) throw new Error(`Unknown AI task: ${task}`)

  for (const [key, value] of Object.entries(variables)) {
    template = template.replaceAll(`{{${key}}}`, value || 'Not provided')
  }

  // Warn about any unfilled variables in development
  if (process.env.NODE_ENV === 'development') {
    const unfilled = template.match(/\{\{[^}]+\}\}/g)
    if (unfilled) {
      console.warn(`[AI] Unfilled variables in ${task}:`, unfilled)
    }
  }

  return template.trim()
}
