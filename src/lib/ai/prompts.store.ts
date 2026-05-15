import type { AITask } from "@/types";

export const PROMPTS: Record<AITask, string> = {
  // ── Stage 1: summarise call notes ──────────────────────────────────
  call_brief_summary: `
You are an expert agricultural consultant assistant. A consultant just completed an introductory call with a client.

Consultant's raw notes or transcript:
{{raw_notes}}

Extract and structure the following into clean JSON. Be concise — only include fields that are actually mentioned.
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
  "agro_tourism_interest": false,
  "water_source_mentioned": "",
  "power_source_mentioned": "",
  "key_concerns": [],
  "consultant_notes": ""
}

Return only valid JSON. No preamble or explanation.
`,

  // ── Questionnaire personalisation ──────────────────────────────────
  personalize_questionnaire: `
You are an agricultural consultant assistant helping personalise a client questionnaire.

The consultant just completed an intro call with a client. Here is what was learned:

Call brief:
{{call_brief}}

Project context:
- Location: {{region}}, {{country}}
- Crops: {{crop_types}}
- Project type: {{project_type}}
- Budget: {{budget_range}} {{currency}}

The base questionnaire has these sections and question IDs:
{{template_summary}}

Your task: Suggest personalisation of this questionnaire based on the call brief.

Return a JSON object:
{
  "covering_note": "1-2 sentence note for the consultant explaining what was changed and why",
  "add": [
    {
      "section_id": "s2",
      "label": "Could you provide the EC and TDS reading from your water source?",
      "type": "textarea",
      "required": true,
      "reason": "Client mentioned deep well — water quality is critical for hydroponic crops"
    }
  ],
  "annotate": {
    "q17": "Client mentioned agro-tourism during the call — flag this question"
  },
  "reorder": {}
}

Rules:
- Only add questions that are genuinely missing from the base template and directly relevant to what was discussed on the call
- Do not add more than 4 new questions
- Do not reorder unless there is a strong reason
- If nothing needs changing, return empty add/annotate/reorder arrays and explain in covering_note
- Return only valid JSON
`,

  // ── Stage 3: gap detection ──────────────────────────────────────────
  // IMPORTANT: Answers are now pre-labelled (e.g. "Primary Water Source: Deep well")
  // not raw question IDs. Entries marked [File uploaded: ...] are file attachments —
  // never flag these as missing data. Only flag genuinely absent information.
  clarification_check: `
You are a senior agricultural engineer reviewing a client questionnaire for a {{project_type}} project.

Project context:
- Location: {{region}}, {{country}}
- Crop types: {{crop_types}}
- Project type: {{project_type}}
- Local currency: {{currency}}

Client's questionnaire answers (human-readable labels):
{{questionnaire_answers}}

IMPORTANT INSTRUCTIONS:
1. Answers marked "[File uploaded: ...]" mean the client has provided a document — do NOT flag these as missing.
2. Only flag data that is genuinely absent OR technically insufficient for engineering purposes.
3. Focus on fields CRITICAL for this specific project type and location:
   - For hydroponic projects: EC/TDS/pH of water is MANDATORY if not provided
   - For greenhouse projects in arid regions: GPS coordinates are CRITICAL for climate analysis
   - For export-focused projects: logistics, cold chain details are needed
   - For agro-tourism projects: visitor capacity, accommodation details
4. Do NOT flag optional or nice-to-have information.
5. Be SPECIFIC about why each piece of missing data matters for THIS project in {{country}}.

Return a JSON array of flags (empty array [] if no gaps):
[
  {
    "field_name": "exact field name matching the label above",
    "reason": "specific explanation of why this is needed for THIS project type in {{country}}",
    "suggested_question": "polite, specific follow-up question to the client",
    "severity": "required"
  }
]

Valid severity values: "required" | "recommended"
Return ONLY valid JSON. If there are no gaps, return [].
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

  // ── Stage 4: climate analysis ───────────────────────────────────────
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

Use realistic benchmark values for {{country}}'s agricultural market. All prices and costs must be denominated in {{currency}}.

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

  // ── Stage 4: market research ────────────────────────────────────────
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
This is the LAST section generated — you have full context from all other sections.

Project: {{project_title}}
Location: {{region}}, {{country}}
Consultant: {{consultant_name}}, {{company_name}}
Currency: {{currency}}

Financial highlights (MUST quote these exact figures):
- Total investment (CAPEX + pre-startup): {{capex_total}} {{currency}}
- Annual revenue: {{total_annual_revenue}} {{currency}}
- EBITDA: {{ebitda}} {{currency}} ({{ebitda_margin}}%)
- Payback period: {{payback_years}} years

Market context (from Introduction section):
{{introduction_content}}

Market opportunity (from Market Analysis section):
{{market_analysis_content}}

Consultant's additional research:
{{consultant_research_notes}}

Write the Executive Summary with these 4 subsections:

### Project Overview
1 paragraph: what the project is, where ({{region}}, {{country}}), who is developing it,
and the key concept (commercial farm + agro-tourism if applicable).

### Key Financial Highlights
Markdown table with exact figures from above. Do not change the numbers.
| Metric | Value |
|--------|-------|
| Total Capital Investment | {{capex_total}} {{currency}} |
| Annual Revenue (Year 1) | {{total_annual_revenue}} {{currency}} |
| EBITDA | {{ebitda}} {{currency}} ({{ebitda_margin}}%) |
| Payback Period | {{payback_years}} years |
| Primary Crops | {{crop_types}} |

### Strategic Rationale
1-2 paragraphs: why {{region}}, {{country}} is strategic for this project.
Reference specific market data (import figures, seasonal gaps, export opportunities).
Reference the location's unique advantages (climate, proximity to tourist attractions if applicable).

### Feasibility Verdict
1 paragraph: clear, confident feasibility statement.
"{{project_title}} is a commercially viable and strategically positioned agricultural venture..."
Reference the key success factors and what makes the project resilient.

⬡ PLACEHOLDER: Cover Page Photo
Upload a site photo, farm rendering, or aerial view of the project location.

Tone: compelling, professional, evidence-based. Quote specific {{country}} market context.
`,

  report_market_analysis: `
You are writing the Market Analysis section of a professional agricultural feasibility report.

Project: {{project_title}}
Location: {{region}}, {{country}}
Target crops: {{crop_types}}
Target markets: {{target_markets}}
Currency: {{currency}}

Market research data (extract specific figures):
{{market_research}}

Consultant's notes:
{{consultant_research_notes}}

Write 400-600 words covering:

### {{country}} Agricultural Landscape
1-2 paragraphs. Must include: agriculture's % of GDP, government self-sufficiency targets,
annual import value of fruits/vegetables in {{currency}}, seasonal growing limitations,
government incentives for greenhouse farming.

### Target Crop Demand & Pricing
Table showing demand and pricing for {{crop_types}}.
| Crop | Market Demand | Avg Price ({{currency}}/kg) Summer | Avg Price ({{currency}}/kg) Winter | Import vs. Local |
Use actual figures from market_research where available.

### Export Opportunities
1 paragraph (only if export markets selected). GCC road connectivity, UAE demand for
fresh produce, contract farming opportunities with regional distributors.

### Agro-Tourism Market Opportunity
1 paragraph (only if agro_tourism = Yes). Tourism statistics for {{region}},
proximity to landmarks, estimated visitor revenue potential.

CRITICAL: All monetary values in {{currency}}. Use actual figures from market_research.
`,

  report_business_model: `
You are writing the Business Model section of a professional agricultural feasibility report.

Project: {{project_title}}
Location: {{region}}, {{country}}
Currency: {{currency}}
Land: {{land_size_sqm}} sqm
Greenhouse area: {{greenhouse_area_sqm}} sqm
Nethouse area: {{nethouse_area_sqm}} sqm
Crops: {{crop_types}}
Agro-tourism: {{agro_tourism}}
Target markets: {{target_markets}}

Technical context:
{{technical_analysis}}

Write the Business Model section:

### Farm Operations
1 paragraph overview of the growing operation.

**Growing Structures**
⬡ PLACEHOLDER: Greenhouse & Nethouse Specifications
Add exact structure dimensions, number of spans, and area for each greenhouse and nethouse.
[Pre-filled: "The project features approximately {{greenhouse_area_sqm}} sqm of greenhouse
cultivation and {{nethouse_area_sqm}} sqm of nethouse across the {{land_size_sqm}} sqm site."]

**Crop Cultivation Plan**
Table showing planned crops and cultivation method:
| Crop | Growing Area (sqm) | Cultivation Method | Harvest Frequency |
Include all crops from {{crop_types}}. Cultivation method = Hydroponic (for tomato/capsicum/cucumber)
or Open field (for fig/outdoor crops).

**Operation Facility**
Bullet list:
• **Packing Room:** Efficient handling and packaging of harvested crops.
• **Office:** Administrative hub for farm operations management.
• **Raw Material Storeroom:** Seeds, fertilizers, and cultivation inputs.
• **Maintenance Room:** Equipment maintenance and repair.
• **Restrooms & Staff Facilities:** Well-being facilities for farm staff.
• **Staff Accommodation:** On-site living spaces for farm workers.

### Agro-Tourism Activities
(Only if agro_tourism = Yes)
Numbered list of 4-5 activities with bold heading + 2 sentences each:
1. **Farm Tours and Guided Walks**
2. **Farm-to-Table Dining / Salad Bar**
3. **Farm Accommodation**
4. **Nature Activities (Trekking & Biking)** (if terrain suitable for {{region}})
5. Additional activity relevant to {{region}}'s tourism profile

Tone: professional, specific to this project. Include actual crop names and location.
`,
  report_financial_projection: `
You are writing the Financial Projection section of a professional agricultural feasibility report.
CRITICAL: All numbers come from the financial model JSON below. Do NOT invent or change any figures.

Currency: {{currency}}
Financial model (read-only — all values in {{currency}}):
{{financial_model_json}}

Consultant's financial notes:
{{consultant_research_notes}}

Write the Financial Projection section using ONLY the figures from the financial model above.

### Investment Summary
1 paragraph introducing total investment. Then table:
| Component | Amount ({{currency}}) |
Use capex_total and pre_startup_cost from the model.

⬡ PLACEHOLDER: Detailed CAPEX Breakdown
Add line-item cost breakdown per infrastructure component from supplier quotes.

### Production Projections
Table derived from financial_model.crops array:
| Crop | Growing Area (sqm) | Annual Yield (Tonnes) |
Use exact figures from crops array.

### Revenue Projections
Table from financial_model.crops:
| Crop | Annual Yield (kg) | Avg Price ({{currency}}/kg) | Annual Revenue ({{currency}}) |
Include agro_tourism_revenue row if > 0.
Total row showing total_annual_revenue.

1 paragraph on seasonal price variation (summer premium vs winter competition).

### Operating Costs
Table from financial model:
| Category | Annual Cost ({{currency}}) |
| Growing Costs (seeds, nutrients, packaging) | [growing_cost_annual] |
| Manpower (full team) | [manpower_cost_annual] |
| Total OPEX | [sum] |

⬡ PLACEHOLDER: Staffing Plan
Add detailed role descriptions, salary breakdown, and Omani/Expat ratio if applicable.

### Profitability Summary
Table from financial model — exact figures only:
| Metric | Value |
| Annual Revenue | [total_annual_revenue] {{currency}} |
| Annual EBITDA | [ebitda] {{currency}} |
| EBITDA Margin | [ebitda_margin]% |
| Payback Period | [payback_years] years |

1 paragraph on ROI enhancement options (expanding farm size, adjusting crop mix,
adding export revenue) — these are suggestions only, not changes to the model.
`,

  report_risk_mitigation: `
You are writing the Risk & Mitigation section of a professional agricultural feasibility report.

Project: {{project_title}}
Location: {{region}}, {{country}}
Crops: {{crop_types}}
Project type: {{project_type}}

Write a Markdown risk table followed by a sensitivity analysis paragraph.

| Risk Category | Risk Description & Impact | Mitigation Strategy |
|---------------|--------------------------|---------------------|
| **Utility Availability** | Electricity and quality water at {{region}} are critical. Delay or unreliability affects all farm phases. | Location selected based on electrical infrastructure availability. [Water source mitigation from questionnaire answer]. Backup systems planned. |
| **Production — Disease & Breakdown** | Low yield from soil-borne disease, equipment breakdown, or extreme weather events. 25% yield reduction tested. | Soil-free hydroponic growing eliminates soil-borne disease. Air-filtered cooling system blocks airborne pests. Seed certification and worker disinfection protocols. Equipment maintenance schedule. |
| **Market Demand** | Demand for {{crop_types}} must be consistent for revenue targets. | Crop selection based on import data for {{country}}. Year-round supply enables advance contracts with buyers. |
| **Market Penetration** | New entrant competing against established importers and traders. | Competitive pricing vs. imports. Superior freshness from local production. Government support for local agriculture in {{country}}. |
| **Competition** | Seasonal competitors reduce supply during cooler months. | Year-round growing capability in {{region}} eliminates 90%+ of seasonal competition in summer. Premium pricing during competitor off-season. |
| **Pricing Volatility** | Market prices for {{crop_types}} fluctuate seasonally. 25% price drop tested. | Conservative market prices used in projections. Year-round contracts at agreed prices with anchor buyers. Summer price premium offsets winter compression. |
| **Seasonal Dependency** | Winter months may see lower prices due to increased local supply from other farms. | Year-round contracts lock in pricing. Product quality differentiation. Export to UAE/GCC as price buffer (if applicable). |

Add {{country}}-specific risks if applicable:
- Regulatory/licensing delays in {{country}}
- Labour availability for specialist roles
- Currency/exchange rate risk (if export-focused)

**Sensitivity Analysis:**
A 25% decrease in both production volume and selling price has been modelled and does not
affect project viability, though it extends the payback period and reduces profitability.
This demonstrates the project's resilience under adverse market conditions.
`,

  report_conclusion: `
You are writing the Conclusion of a professional agricultural feasibility report.

Project: {{project_title}}
Location: {{region}}, {{country}}
Currency: {{currency}}

Financial highlights (quote these exactly):
- Total investment: {{capex_total}} {{currency}}
- EBITDA margin: {{ebitda_margin}}%
- Payback period: {{payback_years}} years

Strategic context: {{strategic_highlights}}

Write 3 paragraphs:

**Paragraph 1 — Feasibility Verdict:**
"{{project_title}} is a commercially viable, strategically positioned agricultural venture
expected to generate {{ebitda_margin}}% EBITDA margins with full investment payback
in {{payback_years}} years."
Reference the key factors driving viability: year-round growing in {{region}},
import substitution opportunity in {{country}}, [agro-tourism if applicable].

**Paragraph 2 — National Alignment:**
How this project contributes to {{country}}'s agricultural Vision goals,
food security objectives, and economic diversification. Reference specific national
policies or targets mentioned in the Introduction.

**Paragraph 3 — Scalability and Next Steps:**
The project's design allows for future expansion — increasing growing area,
diversifying into additional crop varieties, or replicating the model in other regions.
End with a call to action for the investor/bank to proceed with funding.
`,

  // ── Section 2: Introduction ─────────────────────────────────────────
  report_introduction: `
You are writing the Introduction section of a professional agricultural feasibility report.

Project: {{project_title}}
Location: {{region}}, {{country}}
Crops: {{crop_types}}
Project type: {{project_type}}
Currency: {{currency}}

Market research data (use specific figures from here):
{{market_research}}

Write the Introduction covering:

### Country Agricultural Context
2 paragraphs. Must include specific figures from the market research:
- Agriculture's % contribution to {{country}}'s GDP
- Government target (e.g. Vision 2040/2030 goals)
- Annual import value of fruits/vegetables in {{currency}}
- Which crops are most heavily imported
- How greenhouse farming addresses the seasonal cultivation gap in {{country}}

### About This Project
1 paragraph. Describe the project, its location in {{region}}, and why this specific location
is strategic (proximity to landmarks, climate advantages, accessibility).

### Main Objectives
Numbered list of 3-4 objectives with bold headings, each followed by 2-3 sentences:
1. **Establishing a Productive and Environmentally Friendly Commercial Farm**
2. **Providing an Engaging and Educational Agro-Tourism Experience** (if agro_tourism = Yes)
3. **Supporting {{country}}'s Food Security Drive**
4. (Optional) **Creating Employment and Economic Development in {{region}}**

Tone: confident, professional, specific to {{country}}. No generic statements.
All monetary values in {{currency}}.
`,

  // ── Section 3: Project Overview ────────────────────────────────────
  report_project_overview: `
You are writing the Project Overview & About Us section of a professional agricultural feasibility report.

Project: {{project_title}}
Client: {{client_name}}
Location: {{region}}, {{country}}
Land: {{land_size_sqm}} sqm
GPS: {{gps_coordinates}}
Consultant: {{consultant_name}}, {{company_name}}

Write skeleton text for:

### Project Overview
1 paragraph introducing the project investor (use "{{client_name}}" as the name).
Reference the land area of {{land_size_sqm}} sqm and the {{region}} location.
Note that {{company_name}} is spearheading the design and implementation.

⬡ PLACEHOLDER: Investor / Client Profile
Add the investor's background, company name, and vision for this project.

### About Us — {{company_name}}
1 paragraph describing the consultant firm's role.

⬡ PLACEHOLDER: Consultant Firm Profile
Add your firm profile, years of experience, past projects, key services, and certifications.

Keep skeleton text brief (1-2 sentences per subsection) — the consultant fills in the details.
`,

  // ── Section 5: Target Market ────────────────────────────────────────
  report_target_market: `
You are writing the Target Market section of a professional agricultural feasibility report.

Project: {{project_title}}
Location: {{region}}, {{country}}
Crops: {{crop_types}}
Target markets selected: {{target_markets}}
Agro-tourism planned: {{agro_tourism}}
Currency: {{currency}}

Write the Target Market section with these customer segments.
Always include the core commercial segments. Add tourism segments only if agro_tourism = Yes.

For each segment write: **Segment Name:** [2-3 sentences explaining who they are,
what they need, and specifically how this farm serves them in {{country}}'s context.]

Core segments to always include:
• **Domestic Consumers** — families, individuals seeking fresh local produce
• **Supermarkets & Hypermarkets** — [name actual chains in {{country}} if known]
• **Local Restaurants & Hotels** — farm-to-table sourcing
• **Local Vegetable Traders** — wholesale supply

Add if applicable based on target_markets:
• **Export to UAE / GCC** — if export markets selected
• **Domestic Tourists** — if agro_tourism = Yes
• **International Tourists** — if agro_tourism = Yes
• **Educational Institutions** — if agro_tourism = Yes
• **Tourist Agencies & Tour Operators** — if agro_tourism = Yes

End with 1 sentence noting the year-round supply capability as a key advantage over seasonal competitors.
`,

  // ── Section 6: Competitive Analysis ────────────────────────────────
  report_competitive_analysis: `
You are writing the Competitive Analysis section of a professional agricultural feasibility report.

Project: {{project_title}}
Location: {{region}}, {{country}}
Crops: {{crop_types}}
Agro-tourism: {{agro_tourism}}

Market research (use for competitor context):
{{market_research}}

Write 4-5 competitive advantages, each as:
**[Advantage Name]** — bold heading followed by 2 paragraphs.

Required advantages (adapt to {{country}}/{{region}} context):
1. **Year-Round Growing Capability** — explain how most farms in {{country}} face a limited
   growing season (reference specific months), while this project in {{region}} can grow 365 days.
2. **Year-Round Contracts and Faster ROI** — ability to offer consistent supply enables
   long-term contracts with hypermarkets and restaurants; summer price premium advantage.
3. **Optimal Environment for Year-Round Cultivation** — specific climate advantages of
   {{region}} (reference climate data if available); how greenhouse technology overcomes
   local limitations.
4. **Agro-Tourism for Enhanced Visibility** — (only if agro_tourism = Yes) proximity to
   tourist attractions, additional revenue, word-of-mouth marketing.
5. **Strategic Location Advantage** — proximity to markets, export routes, or tourist areas.

Be specific to {{region}} and {{country}}. Reference actual competitors or market gaps found
in the market research. Avoid generic competitive analysis language.
`,

  // ── Section 8: Revenue Streams ──────────────────────────────────────
  report_revenue_streams: `
You are writing the Revenue Streams section of a professional agricultural feasibility report.

Project: {{project_title}}
Currency: {{currency}}
Financial model:
{{financial_model_json}}

Agro-tourism planned: {{agro_tourism}}
Target markets: {{target_markets}}

Write the Revenue Streams section with 2-3 revenue stream entries.
For each stream use a bold bullet heading followed by 2-3 paragraphs.

Always include:
• **Crop Sales** — primary revenue source. Reference specific crops from the financial model,
  their target buyers (supermarkets, traders, export). Mention year-round supply capability
  and how it enables consistent revenue vs seasonal competitors.

Include if agro_tourism = Yes:
• **Agro-Tourism Services** — farm tours, guided walks, farm-to-table dining, educational
  experiences. Reference the agro_tourism_revenue figure from the financial model.
• **Accommodation Services** — farm stay revenue if accommodation is planned.

End with 1 sentence noting total projected annual revenue of {{total_annual_revenue}} {{currency}}.
All monetary figures must be in {{currency}}.
`,

  // ── Section 9: Marketing & Sales Plan ──────────────────────────────
  report_marketing_sales_plan: `
You are writing the Marketing & Sales Plan section of a professional agricultural feasibility report.

Project: {{project_title}}
Location: {{region}}, {{country}}
Crops: {{crop_types}}
Target markets: {{target_markets}}
Agro-tourism: {{agro_tourism}}

Write 4 numbered strategies:

1. **Brand Positioning and Identity**
   1 paragraph. What the brand stands for: sustainability, year-round local supply,
   [agro-tourism if applicable]. USPs for {{country}}'s market.

2. **Target Market Segmentation**
   Brief re-statement of key segments from the Target Market section as sub-bullets.
   (Domestic Tourists, International Tourists, Educational Institutions, Tour Operators,
   Local Restaurants & Hotels, Local Vegetable Traders, Export to UAE — only segments relevant
   to this project's target_markets selection.)

3. **Digital Marketing**
   1 paragraph. Website + SEO, social media platforms popular in {{country}},
   WhatsApp business for B2B orders (important in GCC/Middle East markets).

4. **Partnerships and Collaborations**
   1 paragraph. Name specific potential partners: actual supermarket chains in {{country}},
   tour operators, hotels, educational institutions, agricultural ministry partnerships.

⬡ PLACEHOLDER: Marketing Budget & Spend Plan
Add quarterly marketing budget allocation and planned campaigns.
`,

  // ── Section 10: Proposed Machinery ─────────────────────────────────
  report_proposed_machinery: `
You are writing the Proposed Machinery & Infrastructure section of a professional agricultural
feasibility report.

Project: {{project_title}}
Location: {{region}}, {{country}}
Land: {{land_size_sqm}} sqm
Crops: {{crop_types}}
Technology level: {{experience_level}}
Climate: arid/semi-arid region requiring cooling solutions

Write a numbered list of infrastructure items. Select items based on the technology level:
- standard: items 1, 2, 4, 5, 6, 7, 8
- advanced: items 1, 2, 3, 4, 5, 6, 7, 8, 9, 10
- elite: all 12 items

1. **Hitech Greenhouses and Net Houses** — describe structure type, coverage area based on
   {{land_size_sqm}}, and why this structure suits {{region}}'s climate.
2. **Greenhouse with Pad and Fan Cooling** — describe cooling mechanism and importance for
   {{region}}'s summer temperatures.
3. **Retractable Roof and Thermal Screens** — automatic climate adjustment system.
4. **Circulation Fans** — air movement for uniform temperature and humidity.
5. **Automated Irrigation Network with Fertigation Units** — precise EC/pH control for
   hydroponic growing medium.
6. **Hydroponic Growing System with Growbags** — gutter drain system for water reuse,
   suitable for {{crop_types}} cultivation.
7. **Ground Cover for Disease Control** — soil-borne disease prevention.
8. **Hydraulic Lifts and Specialized Tools** — harvest carts, forklifts, waste removal.
9. **H2O2 Generator for Water Sanitation** — hydrogen peroxide for pipe/water cleanliness.
10. **Data-Based Agriculture (Sensors & Meters)** — EC, pH, CO2, temperature monitoring.
11. **Advanced Climate Control Technologies** — CO2 enrichment, advanced enclosures.
12. **Agro-Tourism Prefabricated Structures** — glamping/accommodation units for visitors.
    (Include only if agro_tourism = Yes)

After the list:
⬡ PLACEHOLDER: Equipment Supplier Quotes
Attach supplier quotations for greenhouse structure, cooling system, and irrigation equipment.

⬡ PLACEHOLDER: Greenhouse Layout Plan
Upload site plan or CAD drawing showing greenhouse and nethouse placement on the land.
`,

  // ── Section 11: Proposed Timelines ─────────────────────────────────
  report_proposed_timelines: `
You are writing the Proposed Timelines section of a professional agricultural feasibility report.

Project: {{project_title}}
Location: {{region}}, {{country}}
Land: {{land_size_sqm}} sqm
Project type: {{project_type}}

Write two subsections:

### Construction Timeline

⬡ PLACEHOLDER: Construction Gantt Chart
Upload your project management Gantt chart showing all construction phases.

Write a narrative paragraph describing the construction sequence for a {{project_type}} project
of {{land_size_sqm}} sqm in {{country}}. Cover these phases in sequence:
- Preconstruction & contract signing (2-4 weeks)
- Detailed drawing preparation & regulatory approvals (3-4 weeks)
- Procurement of greenhouse structure, nethouse, and prefabricated units (12-16 weeks lead time)
- Civil works & site levelling (4-6 weeks)
- Greenhouse & nethouse construction (10-14 weeks)
- HVAC, electrical, plumbing (4-6 weeks, parallel)
- Growing system installation (3-4 weeks)
- Testing, commissioning & staff training (2-3 weeks)

Total construction duration: estimate in weeks/months based on project scale.

### Operational Timeline

⬡ PLACEHOLDER: Operational Gantt Chart
Upload operational readiness timeline showing recruitment, procurement, and go-live phases.

Write a narrative paragraph describing the operational sequence:
- Recruitment of farm manager/grower (start 3 months before go-live)
- Government licensing & compliance (45 days)
- Procurement of agri tools and consumables
- Farm worker recruitment and joining
- SOPs and log format preparation
- Operational readiness date / Go-live / Seeding
- First transplanting (Month +2)
- First harvest (Month +4 to +5 depending on {{crop_types}})
- Full commercial operation (Month +6 to +8)

Reference the specific growing cycles of {{crop_types}} for harvest timing.
`,

  // ── Section 12: Quality Assurance ──────────────────────────────────
  report_quality_assurance: `
You are writing the Quality Assurance & Control Plan section of a professional agricultural
feasibility report.

Project: {{project_title}}
Location: {{country}}
Crops: {{crop_types}}
Target markets: {{target_markets}}

Write the QA section covering:

1. **Quality Standards Framework** — introduce the multi-standard QA approach.

2. **GLOBALG.A.P (Global Agricultural Practices)** — explain what it covers, why it's
   relevant for {{country}}'s market, and its recognition in 120+ countries.

3. **ISO 22000 — Food Safety Management** — explain food safety scope and relevance
   to {{crop_types}} production for domestic and export markets.

4. **ISO 9001 — Administration Quality** (if applicable to project scale)

If target_markets includes export (UAE/GCC):
5. **Export Certification Requirements** — additional requirements for UAE/GCC export.

If project_type includes organic interest:
6. **Organic Certification Pathway** — timeline and requirements.

**Certification Timeline:**
Note that full certification is typically achievable after 12-18 months of operation,
giving time to establish processes and documentation. Initial operations follow the
standards from day one even before formal certification.

End with 1 sentence on how the QA programme supports the farm's premium pricing strategy.
`,

  // ── Section 15: Benefits & Impact ──────────────────────────────────
  report_benefits_impact: `
You are writing the Benefits & Impact section of a professional agricultural feasibility report.

Project: {{project_title}}
Location: {{region}}, {{country}}
Crops: {{crop_types}}
Financial highlights: EBITDA {{ebitda}} {{currency}}, Payback {{payback_years}} years
Agro-tourism: {{agro_tourism}}

Write 5-6 benefits as bold bullet headings, each followed by 2-3 sentences.
Tailor each benefit specifically to {{country}}'s development context.

Always include:
• **Food Security** — link to {{country}}'s food security policy/vision goals.
  Reference the import substitution impact (locally grown {{crop_types}} replacing imports).
• **Economic Growth & Employment** — job creation (farm workers, management, agro-tourism
  staff if applicable). Estimated number of direct jobs from the financial model.
• **Technology Transfer and Innovation** — introduction of advanced greenhouse technology,
  knowledge sharing for {{country}}'s agricultural sector.
• **Diversification of Economy** — moving beyond oil-dependent industries in GCC context
  (or equivalent for other countries), investing in sustainable agriculture.

Add if applicable:
• **Tourism and Education** — (if agro_tourism = Yes) agro-tourism attraction, educational
  tours for schools and universities.
• **Knowledge and Skill Development** — training programmes for local farmers, upskilling
  in modern agricultural techniques.
• **Environmental Sustainability** — water efficiency of hydroponic systems vs conventional
  farming, reduced pesticide use, lower carbon footprint from local supply.
`,

  // ── Section 16: CSR ────────────────────────────────────────────────
  report_csr: `
You are writing the CSR Initiatives section of a professional agricultural feasibility report.

Project: {{project_title}}
Location: {{region}}, {{country}}
Agro-tourism: {{agro_tourism}}

Write 4-5 CSR initiatives as bold bullet headings with 2-3 sentences each.
Tailor to {{country}}'s social and cultural context.

Always include:
• **Support for Local Schools** — educational farm tours for students, agricultural
  curriculum support, hands-on learning experiences.
• **Donations to Food Banks and Charities** — surplus crop donations to local food banks,
  iftar meals during Ramadan (if GCC/Middle East), support for vulnerable communities.
• **Farmer Training and Empowerment** — workshops for local farmers on modern agricultural
  techniques, subsidised or free training programmes.
• **Community Engagement** — involvement of local residents in farm activities,
  community events, open farm days.

Add if applicable to {{country}} context:
• **Women Empowerment Programme** — training and employment opportunities for women
  in agricultural roles (relevant for some GCC countries).
• **Environmental Initiatives** — tree planting, water conservation awareness,
  school environmental programmes.
`,
};

export function buildPrompt(
  task: AITask,
  variables: Record<string, string>,
): string {
  let template = PROMPTS[task];
  if (!template) throw new Error(`Unknown AI task: ${task}`);

  for (const [key, value] of Object.entries(variables)) {
    template = template.replaceAll(`{{${key}}}`, value || "Not specified");
  }

  if (process.env.NODE_ENV === "development") {
    const unfilled = template.match(/\{\{[^}]+\}\}/g);
    if (unfilled) {
      console.warn(`[AI] Unfilled variables in ${task}:`, unfilled);
    }
  }

  return template.trim();
}
