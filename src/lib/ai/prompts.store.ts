import type { AITask } from "@/types";

// ─────────────────────────────────────────────────────────────────────────────
// PROMPTS — Every template follows the Standard report structure:
//   • Clear numbered / headed sections
//   • Placeholders (⬡ PLACEHOLDER: …) for consultant-filled content
//   • Confident, evidence-based, professional tone
//   • All monetary values in {{currency}}
//   • Every prompt ends with {{consultant_instructions}} so the consultant
//     can steer individual sections before or after generation
// ─────────────────────────────────────────────────────────────────────────────

export const PROMPTS: Record<AITask, string> = {

  // ── Stage 1: Summarise call notes ──────────────────────────────────────────
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

  // ── Questionnaire personalisation ──────────────────────────────────────────
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

  // ── Stage 3: Gap detection ──────────────────────────────────────────────────
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
   - For export-focused projects: logistics and cold chain details are needed
   - For agro-tourism projects: visitor capacity and accommodation details
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

  // ── Stage 3: Draft follow-up questions ─────────────────────────────────────
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

  // ── Stage 4: Technical analysis ────────────────────────────────────────────
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

{{consultant_instructions}}
`,

  // ── Stage 4: Climate analysis ───────────────────────────────────────────────
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

{{consultant_instructions}}
`,

  // ── Stage 4: Financial projection ──────────────────────────────────────────
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

  // ── Stage 4: Market research ────────────────────────────────────────────────
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

{{consultant_instructions}}
`,

  // ════════════════════════════════════════════════════════════════════════════
  // REPORT SECTIONS — Structured after the Zaher Farm Sample report format.
  //
  // Design principles applied across all sections:
  //   1. Each section mirrors the heading hierarchy of the sample report
  //   2. ⬡ PLACEHOLDER blocks appear wherever the consultant must add
  //      project-specific content (photos, supplier data, org charts, etc.)
  //   3. Tone: confident, professional, evidence-based — not generic AI text
  //   4. All numbers come from provided variables — AI never invents figures
  //   5. {{consultant_instructions}} is always the last item so the consultant
  //      can steer or override any part of the section
  // ════════════════════════════════════════════════════════════════════════════

  // ── Section 1: Executive Summary ───────────────────────────────────────────
  report_executive_summary: `
You are writing the Executive Summary of a professional agricultural feasibility report.
This section is generated LAST so you have full context from all other sections.

STRUCTURE TO FOLLOW — match this exactly, in this order:

---

## Executive Summary

⬡ PLACEHOLDER: Cover Page Photo
Upload a site photo, aerial view, or greenhouse rendering of the project location.

### Project Overview
Write 1 confident paragraph (4-5 sentences) covering:
- What the project is and its concept (e.g. "{{project_title}} is a commercial farm with an agro-tourism focus")
- Where it is located ({{region}}, {{country}}) and why this location is strategic
- Who is developing it ({{client_name}}, supported by {{company_name}})
- The core value proposition (year-round production, import substitution, tourism, etc.)

### Table of Contents
Generate a clean numbered markdown list of all report sections in order:
1. Executive Summary
2. Introduction
3. Project Overview & About Us
4. Market Analysis
5. Target Market
6. Competitive Analysis
7. Business Model
8. Revenue Streams
9. Marketing & Sales Plan
10. Proposed Machinery & Infrastructure
11. Proposed Timelines
12. Quality Assurance & Control Plan
13. Financial Projection
14. Risk & Mitigation
15. Benefits & Impact
16. CSR Initiatives
17. Conclusion

### Key Financial Highlights
Use EXACTLY these figures — do not alter any number:

| Metric | Value |
|--------|-------|
| Total Capital Investment | {{capex_total}} {{currency}} |
| Pre-Startup Requirement | [pre_startup_cost from financial model] {{currency}} |
| Annual Revenue (Year 1) | {{total_annual_revenue}} {{currency}} |
| EBITDA | {{ebitda}} {{currency}} ({{ebitda_margin}}%) |
| Payback Period | {{payback_years}} years |
| Primary Crops | {{crop_types}} |

### Strategic Rationale
Write 1-2 paragraphs explaining WHY this project makes sense in {{region}}, {{country}}:
- Reference specific market data from the Introduction/Market Analysis sections
- Mention import dependency figures for {{country}} if available
- Reference the location's unique advantages (climate, proximity to landmarks, road access, etc.)
- If agro-tourism is planned, explain the tourism opportunity

### Feasibility Verdict
Write 1 strong closing paragraph that opens with:
"{{project_title}} is a commercially viable and strategically positioned agricultural venture..."
Then reference:
- The {{ebitda_margin}}% EBITDA margin
- The {{payback_years}}-year payback period
- The 2-3 key factors that make this project resilient and scalable

---

Context from upstream sections (use to strengthen the narrative — do not paste verbatim):
Market context: {{market_analysis_content}}
Introduction context: {{introduction_content}}
Consultant research notes: {{consultant_research_notes}}

{{consultant_instructions}}
`,

  // ── Section 2: Introduction ─────────────────────────────────────────────────
  report_introduction: `
You are writing the Introduction section of a professional agricultural feasibility report.
Model the structure on a professional agri-feasibility report. Be specific to {{country}} — never generic.

STRUCTURE TO FOLLOW:

---

## Introduction

Write an opening paragraph (3-4 sentences) that sets the scene:
- What trend is driving this project? (e.g. rising demand for sustainable agriculture, food security policy, agro-tourism growth)
- How does {{project_title}} respond to this trend?
- What is the farm's core concept in one sentence?

### {{country}} Agricultural Landscape

Write 2 substantial paragraphs. You MUST include ALL of the following specific data points
(use market research data — estimate conservatively if exact figures are unavailable):

Paragraph 1:
- Agriculture's current % contribution to {{country}}'s GDP
- The government's target % contribution and the target year (e.g. Vision 2040, Vision 2030)
- Annual import value of fruits and vegetables in {{currency}}
- The top imported crops by volume or value (name at least 4-5 specific crops)
- The seasonal cultivation limitation (how many months per year is normal field farming viable)

Paragraph 2:
- How greenhouse and controlled-environment farming addresses the seasonal gap
- Government incentives or programmes supporting greenhouse farming in {{country}}
- How {{project_title}} fits into the national food security strategy
- The opportunity for local production of the specific crops: {{crop_types}}

### About This Project

Write 1 paragraph describing:
- The project's exact location in {{region}}, {{country}}
- What makes this specific location strategic (proximity to tourist attractions, road access,
  climate advantages, water availability, market proximity — use what applies)
- The land area: {{land_size_sqm}} sqm
- The vision: what this farm will become

### Main Objectives of {{project_title}}

Write 3-4 objectives. Use this exact format for each — bold title, then 2-3 sentences of body text:

1. **[Objective Title]:** [2-3 sentences explaining what the farm will do under this objective
   and why it matters for {{country}}'s context.]

2. **[Objective Title]:** [2-3 sentences.]

3. **[Objective Title]:** [2-3 sentences.]

4. **[Optional Objective Title]:** [2-3 sentences — only include if genuinely applicable.]

Required objectives to always include (adapt wording to the project):
- Establishing a productive, environmentally friendly commercial farm (mention specific techniques: hydroponics, greenhouse, etc.)
- {{agro_tourism == "Yes" ? "Providing an engaging and educational agro-tourism experience" : "Developing reliable year-round supply chains for domestic and/or export markets"}}
- Supporting {{country}}'s food security drive and raising awareness about sustainable agriculture

---

Market research data (extract specific figures from here):
{{market_research}}

Consultant research notes:
{{consultant_research_notes}}

{{consultant_instructions}}
`,

  // ── Section 3: Project Overview & About Us ──────────────────────────────────
  report_project_overview: `
You are writing the Project Overview & About Us section of a professional agricultural feasibility report.

Project data:
- Project title: {{project_title}}
- Client name: {{client_name}}
- Location: {{region}}, {{country}}
- Land size: {{land_size_sqm}} sqm
- GPS: {{gps_coordinates}}
- Consultant firm: {{company_name}}
- Consultant name: {{consultant_name}}

STRUCTURE TO FOLLOW:

---

## Project Overview

Write 1-2 paragraphs covering:
- Who the visionary/investor is behind this project (use {{client_name}})
- Their background or role (use questionnaire data if available, otherwise leave a placeholder)
- How they envision {{project_title}} — the mission and values behind it
- The land: two or more available plots in {{region}}, total {{land_size_sqm}} sqm
- Who is spearheading design and implementation ({{company_name}}) and their role

⬡ PLACEHOLDER: Site Aerial / Land Map
Upload an aerial photograph or boundary map of the project land showing the plots.

⬡ PLACEHOLDER: Investor / Client Profile
Add the investor's full background: company name, years in business, other ventures,
personal motivation for this project, and community standing.

---

## About Us

### {{company_name}}

Write 1 paragraph introducing {{company_name}} and its role in this project:
- What the firm does (turnkey agricultural project development, consultancy, implementation)
- The partnership structure if applicable (e.g. engineering firm + agri consultancy)
- Years of experience and geographic focus
- How this expertise applies to {{project_title}}

⬡ PLACEHOLDER: Consultant Firm Full Profile
Replace the paragraph above with your firm's complete profile including:
- Year established, team size, countries of operation
- List of past completed projects (farm type, location, scale)
- Key certifications (GLOBALG.A.P, ISO, etc.)
- Partner organisations and technology alliances
- Any awards or recognition

---

{{consultant_instructions}}
`,

  // ── Section 4: Market Analysis ──────────────────────────────────────────────
  report_market_analysis: `
You are writing the Market Analysis section of a professional agricultural feasibility report.
Be specific to {{country}} — use data from the market research provided. Never use placeholder percentages.

STRUCTURE TO FOLLOW:

---

## Market Analysis

Write an opening paragraph (2-3 sentences) framing the market opportunity:
- State the sector's growth trajectory in {{country}}
- Reference a key driver (food security policy, import dependency, tourism growth)
- State what opportunity this creates for {{project_title}}

### {{country}} Agricultural Sector Overview

Write 2 paragraphs covering:

Paragraph 1 — current state:
- Agriculture's % of GDP and recent growth rate
- Key limitations of the current sector (seasonal cultivation window, import dependency)
- Government targets (Vision 2040/2030 or equivalent) and self-sufficiency goals

Paragraph 2 — the greenhouse farming opportunity:
- Annual import value of target crop categories in {{currency}}
- What share of the market {{project_title}} could capture at current scale
- How year-round greenhouse production addresses the seasonal gap
- Government incentives or subsidies supporting this type of project in {{country}}

### Target Crop Demand & Pricing

Write 1 introductory sentence. Then include this table for {{crop_types}}:

| Crop | Market Demand | Summer Price ({{currency}}/kg) | Winter Price ({{currency}}/kg) | Import vs. Local Supply |
|------|--------------|-------------------------------|-------------------------------|------------------------|

For each crop, use figures from the market research. Note seasonal price premiums clearly.
After the table, write 1-2 sentences on which crops have the strongest margin opportunity and why.

### Export & Regional Opportunities

Write 1-2 paragraphs (only include sections relevant to this project's target markets):
- Road connectivity and logistics routes to neighbouring GCC/regional markets
- Demand for fresh produce in neighbouring countries and seasonal gaps
- Opportunity for year-round contracts with regional distributors or supermarket chains
- Name specific potential buyers or chains if identifiable from market research

### Agro-Tourism Market Opportunity

(Include only if agro_tourism = Yes. Skip this section entirely if No.)

Write 1-2 paragraphs covering:
- Tourism statistics for {{region}} and {{country}} (visitors per year, growth trend)
- Proximity of the project to major tourist attractions (use questionnaire/GPS data)
- The agro-tourism market size or comparable farm tourism revenue data
- Why visitors to the area represent a captive audience for this farm

### Conclusion & Scale of Opportunity

Write 1 closing paragraph summarising:
- The total addressable market
- {{project_title}}'s current market share at launch (will likely be <1% — state this as
  "enormous room for growth" rather than a weakness)
- Future expansion potential (additional crops, additional regions, export contracts)

---

Market research data:
{{market_research}}

Consultant research notes:
{{consultant_research_notes}}

{{consultant_instructions}}
`,

  // ── Section 5: Target Market ────────────────────────────────────────────────
  report_target_market: `
You are writing the Target Market section of a professional agricultural feasibility report.

Project: {{project_title}}
Location: {{region}}, {{country}}
Crops: {{crop_types}}
Target markets selected: {{target_markets}}
Agro-tourism planned: {{agro_tourism}}
Currency: {{currency}}

STRUCTURE TO FOLLOW:

---

## Target Market

Write an opening sentence explaining that {{project_title}}'s target market spans multiple
customer segments, each with distinct needs that the farm's model is designed to serve.

Then write each segment as:
**[Segment Name]:** [2-3 sentences explaining who they are, what they need, and specifically
how {{project_title}} serves them in {{country}}'s context.]

ALWAYS include these core commercial segments:
- **Domestic Consumers** — families and individuals seeking fresh, locally grown produce
  as an alternative to imported vegetables; the farm-to-table proposition
- **Supermarkets & Hypermarkets** — name actual chains operating in {{country}} if known
  (e.g. Carrefour, Lulu, Spinneys, Sultan Center, Al Fair — use relevant ones for {{country}});
  focus on the year-round supply reliability advantage
- **Local Restaurants & Hotels** — farm-to-table sourcing, fresh produce for premium menus,
  sustainability credentials that appeal to hospitality buyers
- **Local Vegetable Traders & Wholesalers** — bulk supply relationships, reducing their
  import dependency, competitive pricing during peak summer shortage

Add these segments only if they appear in {{target_markets}} or the project supports them:
- **Export to UAE / GCC / Regional Markets** — if export markets selected; explain the
  road logistics, demand gap, and contract farming opportunity
- **Educational Institutions** — if agro_tourism = Yes; schools, universities, field trips
- **Domestic Tourists** — if agro_tourism = Yes; families seeking rural escape from cities
- **International Tourists** — if agro_tourism = Yes; visitors seeking authentic cultural experiences
- **Tourist Agencies & Tour Operators** — if agro_tourism = Yes; package inclusion opportunity

End with 1-2 sentences noting:
- The year-round supply capability as a structural advantage over seasonal competitors
- How {{project_title}}'s ability to produce during summer — when local supply drops —
  makes it the preferred supplier for buyers who need consistent stock

---

{{consultant_instructions}}
`,

  // ── Section 6: Competitive Analysis ────────────────────────────────────────
  report_competitive_analysis: `
You are writing the Competitive Analysis section of a professional agricultural feasibility report.
This section must articulate clear, specific competitive advantages — not generic statements.

Project: {{project_title}}
Location: {{region}}, {{country}}
Crops: {{crop_types}}
Agro-tourism: {{agro_tourism}}

Market research context:
{{market_research}}

STRUCTURE TO FOLLOW:

---

## Competitive Analysis

Write an opening paragraph (2-3 sentences) stating that {{project_title}} has several distinct
advantages that differentiate it from both traditional farms and importers in {{country}}.

Then write each competitive advantage as:
**[Advantage Title]**

Followed by 1-2 paragraphs of specific, evidence-based content.

REQUIRED ADVANTAGES (adapt all language and specifics to this project's actual location and data):

**Year-Round Growing Capability**
Explain:
- How most farms in {{country}} face a limited growing season (reference the specific months
  when field farming is unviable due to heat, humidity, or other factors)
- That {{project_title}} in {{region}} can grow 365 days a year using greenhouse technology
- The specific climate advantage of {{region}} that makes this possible (low humidity,
  altitude, cooler nights, or whatever applies based on GPS/climate data)
- That as competing farms in other regions cease summer operations, {{project_title}}
  steps in as the primary local supplier — eliminating roughly 90% of seasonal competition

**Year-Round Contracts & Accelerated ROI**
Explain:
- How the ability to supply year-round enables long-term contracts with hypermarkets,
  supermarkets, and restaurants — buyers who cannot afford supply gaps
- The summer price premium: when local supply drops, prices rise and {{project_title}}
  benefits from higher margins while competitors are offline
- How contracted annual pricing provides revenue predictability and faster payback

**Optimal Conditions for {{region}}**
Explain:
- The specific micro-climate or environmental advantages of {{region}} for the chosen crops
- How the greenhouse infrastructure (pad-and-fan cooling, thermal screens, fertigation)
  is designed specifically for these conditions
- Why this combination of location + technology gives yield advantages over generic greenhouse farms

**Agro-Tourism Differentiation** (include only if agro_tourism = Yes)
Explain:
- How most commercial farms in {{country}} have no tourism offering — this is genuinely rare
- The proximity to {{region}}'s tourist attractions and the captive visitor audience
- How agro-tourism creates an additional revenue stream that insulates the farm from
  crop price volatility — a structural resilience advantage
- The word-of-mouth and brand value generated by visitors becoming advocates

**Strategic Location Advantage**
Explain:
- Road access to domestic markets (name key cities or distribution hubs)
- Proximity to export corridors if applicable (UAE border, GCC road network)
- Distance from competing growing regions and why this matters for supply chain timing

---

{{consultant_instructions}}
`,

  // ── Section 7: Business Model ───────────────────────────────────────────────
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

STRUCTURE TO FOLLOW:

---

## Business Model

### Farm Operations

Write 1-2 paragraphs giving an overview of how the farm operates:
- The combination of growing structures (hitech greenhouses + net houses + any open-field areas)
- That the design enables year-round cultivation despite {{country}}'s climatic challenges
- The overall cultivation philosophy (hydroponic / soilless, data-driven, sustainable inputs)

**Growing Structures**

Write a brief intro sentence. Then present this table:

| Structure | Dimensions | Total Area |
|-----------|------------|------------|
| Greenhouse 1 (Hitech) | [from technical analysis or questionnaire] | [sqm] |
| Greenhouse 2 (Hitech) | [from technical analysis or questionnaire] | [sqm] |
| Net House | [from technical analysis or questionnaire] | [sqm] |
| Open Field / Plantation | [if applicable] | [sqm or number of trees] |
| **Total Covered Area** | | **{{greenhouse_area_sqm}} sqm greenhouse + {{nethouse_area_sqm}} sqm nethouse** |

⬡ PLACEHOLDER: Greenhouse & Nethouse Dimensions
Replace the table rows above with exact dimensions from supplier drawings or site survey.
Format: Length × Width × Number of spans.

⬡ PLACEHOLDER: Greenhouse Layout Plan
Upload the site plan or CAD drawing showing the greenhouse, nethouse, and facility placement
on the {{land_size_sqm}} sqm site.

**Crop Cultivation Plan**

Write 1 introductory sentence naming the crops. Then this table:

| Crop | Growing Area (sqm) | Cultivation Method | Estimated Harvest Frequency |
|------|-------------------|-------------------|----------------------------|

Rules for the table:
- Cultivation Method = "Hydroponic — Growbag System" for tomato, capsicum, cucumber, pepper
- Cultivation Method = "Open Field" for fig, date, or outdoor crops
- Harvest Frequency = "Continuous (weekly)" for vine crops; "Seasonal" for tree crops
- Include ALL crops from {{crop_types}}

After the table, write 2-3 sentences on why these specific crops were selected:
reference demand data from the market analysis, the cultivation suitability for {{region}},
and the price-per-kg opportunity.

**Operation Facility**

Write 1 intro sentence. Then list each facility component as a bold bullet:

• **Packing Room:** [2 sentences — function and why it matters for quality and export readiness]
• **Office & Administration:** [1-2 sentences]
• **Raw Material Storeroom:** [1-2 sentences covering seeds, nutrients, substrates, packaging]
• **Maintenance Room:** [1-2 sentences]
• **Restrooms & Staff Welfare Facilities:** [1 sentence]
• **Staff Accommodation:** [1-2 sentences — on-site housing for farm workers, proximity benefit]

**Outdoor Plantation** (include only if the crop list includes fig, date, citrus, or any open-field crop)

Write 2-3 sentences:
- What is planted outdoors (crop name, number of trees/plants)
- How the outdoor area complements the greenhouse operation
- If agro_tourism = Yes: how visitors can experience and explore the plantation area

---

### Agro-Tourism Activities

(Include this entire section only if agro_tourism = Yes. If No, remove completely.)

Write 1 intro paragraph explaining that {{project_title}} integrates a commercial farm with
a curated set of agro-tourism experiences that are designed to be memorable and educational.

Then write each activity as a numbered item with a bold title followed by 2-3 sentences:

1. **Farm Tours & Guided Walks**
   Describe: guided tours of crop fields and greenhouses, hands-on harvesting and planting
   experiences, knowledgeable guides, educational content about sustainable agriculture.

2. **Farm-to-Table Dining / Salad Bar**
   Describe: on-site dining using the farm's own fresh produce, the concept of eating food
   harvested the same day, the menu format (salad bar, fresh juices, light meals).

3. **Farm Accommodation / Farm Stay**
   Describe: the accommodation style (modern prefabricated units, glamping domes, or similar
   — use whatever fits the project), farm views, the serene rural experience.

4. **Nature & Adventure Activities**
   Describe: trekking, biking trails, or other outdoor activities suited to {{region}}'s
   terrain and proximity to natural attractions. Reference nearby landmarks if applicable.

5. **[Additional activity relevant to {{region}}]** (optional — add only if genuinely applicable)
   E.g. Miyawaki forest experience, falconry, stargazing, date harvest festival, etc.

⬡ PLACEHOLDER: Agro-Tourism Facility Rendering
Upload a rendering or photo of the planned accommodation units, salad bar, or visitor area.

---

{{consultant_instructions}}
`,

  // ── Section 8: Revenue Streams ──────────────────────────────────────────────
  report_revenue_streams: `
You are writing the Revenue Streams section of a professional agricultural feasibility report.

Project: {{project_title}}
Currency: {{currency}}
Agro-tourism: {{agro_tourism}}
Target markets: {{target_markets}}
Financial model: {{financial_model_json}}

STRUCTURE TO FOLLOW:

---

## Revenue Streams

Write an opening paragraph (2-3 sentences) explaining that {{project_title}}'s revenue model
is deliberately diversified across multiple income sources, reducing reliance on any single
stream and creating financial resilience across seasons.

Then write each revenue stream as a bold bullet heading followed by 2-3 paragraphs:

• **Crop Sales** (Primary Revenue Stream)
  Paragraph 1: Describe the crops being sold ({{crop_types}}), the growing structures that
  enable year-round production, and the target buyers (domestic traders, supermarkets, export).
  Paragraph 2: Explain the seasonal pricing advantage — during summer, when competing local
  farms go offline, {{project_title}} continues producing and commands premium prices.
  Year-round supply contracts with hypermarket chains (name relevant ones for {{country}}) and
  restaurants provide revenue predictability.
  Reference the annual crop revenue figure from the financial model.

• **Agro-Tourism Services** (include only if agro_tourism = Yes)
  Paragraph 1: Describe the range of tourism revenue — farm tours, guided experiences,
  farm-to-table dining, activity fees (trekking, biking, etc.).
  Paragraph 2: Explain the pricing strategy: day visitors vs. overnight guests, group rates
  for educational institutions, seasonal peaks aligned with {{country}}'s tourist calendar.
  Reference the agro_tourism_revenue figure from the financial model.

• **Accommodation Services** (include only if agro_tourism = Yes and accommodation is planned)
  Paragraph 1: Describe the farm stay accommodation — unit types, capacity, experience.
  Paragraph 2: Explain how accommodation revenue is complementary (guests who stay overnight
  spend more on dining, tours, and activities — higher revenue per visitor).
  Reference twin unit, single unit rental pricing from the financial model if available.

End with 1-2 sentences noting the total projected annual revenue of {{total_annual_revenue}} {{currency}}
and how the multi-stream model provides stability that a crop-only operation cannot.

---

{{consultant_instructions}}
`,

  // ── Section 9: Marketing & Sales Plan ──────────────────────────────────────
  report_marketing_sales_plan: `
You are writing the Marketing & Sales Plan section of a professional agricultural feasibility report.

Project: {{project_title}}
Location: {{region}}, {{country}}
Crops: {{crop_types}}
Target markets: {{target_markets}}
Agro-tourism: {{agro_tourism}}

STRUCTURE TO FOLLOW:

---

## Marketing & Sales Plan

Write 1 opening paragraph explaining that the success of {{project_title}} depends on a
focused marketing strategy that builds brand recognition, secures long-term supply contracts,
and (if applicable) positions the farm as a must-visit agro-tourism destination in {{region}}.

Then write each strategy as a numbered section with a bold heading:

**1. Brand Positioning & Identity**
Write 1-2 paragraphs. Cover:
- The brand's core identity: what does {{project_title}} stand for? (e.g. year-round freshness,
  sustainable local production, authentic agro-tourism, premium quality)
- The key differentiators to emphasise in all marketing: year-round availability, locally grown,
  no-import premium, sustainable practices
- The visual and verbal identity direction (professional, clean, farm-authentic — not industrial)

**2. Target Market Segmentation**
Write a brief intro sentence. Then list each target segment as a sub-bullet with 1 sentence
on the specific sales approach for that segment:
- Commercial buyers (supermarkets, traders): direct sales team, volume pricing, supply agreements
- Hospitality (restaurants, hotels): quality samples, chef relationship programme, farm visits
- Export (UAE/GCC if applicable): export documentation, cold chain logistics, broker relationships
- Agro-tourism (if applicable): online booking platform, travel agency partnerships, social media

**3. Digital Marketing**
Write 1-2 paragraphs covering:
- A professional website showcasing the farm, produce, and (if applicable) tourism experiences
- SEO strategy targeting {{country}} agricultural and farm tourism keywords
- Social media platforms most relevant for {{country}} (Instagram for food and lifestyle;
  WhatsApp Business for B2B buyer communication — critical in GCC/Middle East markets;
  Facebook for community and educational content)
- Content strategy: farm-to-table stories, harvest videos, sustainability credentials,
  visitor testimonials (if agro-tourism)

**4. Partnerships & Collaborations**
Write 1-2 paragraphs covering:
- Supermarket and hypermarket partnerships: name specific chains in {{country}} and the
  approach to securing a listing (quality audits, trial orders, consistent volumes)
- Restaurant and hotel partnerships: direct supply agreements, branded presence on menus
- Agro-tourism partnerships (if applicable): tie-ups with tour operators, travel agencies,
  and educational institutions in {{region}} and {{country}}
- Government and industry: engagement with the Ministry of Agriculture in {{country}},
  participation in agricultural fairs, certification bodies

⬡ PLACEHOLDER: Marketing Budget & Quarterly Campaign Plan
Add a breakdown of the first-year marketing budget by channel and quarter.
Include planned campaigns, trade show participation, and launch event budget.

---

{{consultant_instructions}}
`,

  // ── Section 10: Proposed Machinery & Infrastructure ────────────────────────
  report_proposed_machinery: `
You are writing the Proposed Machinery & Infrastructure section of a professional agricultural
feasibility report. This section establishes {{project_title}} as a technically credible,
state-of-the-art operation.

Project: {{project_title}}
Location: {{region}}, {{country}}
Land: {{land_size_sqm}} sqm
Crops: {{crop_types}}
Technology level: {{experience_level}}
Agro-tourism planned: {{agro_tourism}}

STRUCTURE TO FOLLOW:

---

## Proposed Machinery & Infrastructure

Write 1 opening paragraph explaining that {{project_title}} is designed as one of the most
advanced greenhouse operations in {{region}}, integrating cutting-edge technology, automation,
and sustainable practices to achieve optimal productivity while minimising environmental impact.

Then write each infrastructure item as a numbered section with a bold heading followed by
2-3 sentences of specific, technical explanation:

1. **Hitech Greenhouses & Net Houses**
   Describe: the structure type (multi-span, Venlo, or tunnel — use what is appropriate for
   {{country}}'s climate), total coverage area ({{greenhouse_area_sqm}} sqm greenhouse +
   {{nethouse_area_sqm}} sqm nethouse), galvanised steel construction, polycarbonate or
   polyethylene cladding. Explain why this structure type suits {{region}}'s climate profile.

2. **Pad & Fan Evaporative Cooling System**
   Describe: how the system works (water-saturated cooling pads + exhaust fans create a
   cool airflow through the greenhouse), the target temperature differential achievable,
   why this is the appropriate cooling solution for {{region}}'s climate (high summer
   temperatures, low humidity). Include energy efficiency note.

3. **Retractable Roof & Thermal Screens** (include if technology level = advanced or elite)
   Describe: automated retractable roof panels for rain protection and ventilation control,
   thermal screens that reduce heat load during peak summer and retain warmth on cool nights,
   sensor-driven automatic adjustment based on temperature and light thresholds.

4. **Circulation Fans**
   Describe: strategically positioned fans to ensure uniform air movement throughout the
   growing area, prevention of stagnant humid pockets that cause fungal disease, uniform
   temperature and CO₂ distribution across the full canopy.

5. **Automated Irrigation & Fertigation System**
   Describe: drip irrigation integrated with a fertigation unit that delivers water and
   nutrients in precise doses, automated EC (Electrical Conductivity) and pH dosing to
   maintain optimal growing medium conditions, timer and sensor-controlled schedules.
   Explain why this is essential for the specific crops: {{crop_types}}.

6. **Hydroponic Growing System — Growbag & Gutter Drain**
   Describe: substrate-filled growbags (coconut coir, rockwool, or perlite — specify what
   is standard for {{country}}'s supply chain), the Dutch-style gutter drain system for
   collecting and recycling drain water, water usage efficiency vs soil farming, elimination
   of soil-borne disease risk.

7. **Ground Cover & Disease Control**
   Describe: white or black PE ground cover sheeting to prevent soil-borne pathogen contact,
   reflect light upward into the canopy, and reduce weed pressure. Note that combined with
   soilless growing, this essentially eliminates the main disease vectors for {{crop_types}}.

8. **Hydraulic Lifts, Harvest Carts & Material Handling**
   Describe: mobile hydraulic work platforms for safe access to high-wire crops (tomato,
   cucumber), dedicated harvest carts with integrated weighing, forklifts for packhouse
   operations, trailer systems for green waste removal. Note the reduction in manual labour
   and ergonomic injury risk.

9. **H₂O₂ Generator for Water Sanitation** (include if technology level = advanced or elite)
   Describe: on-site hydrogen peroxide generation for pipe sanitation and root zone sterilisation,
   elimination of biofilm and algae in drip lines, reduction in chemical pesticide inputs.

10. **Data-Based Agriculture — Sensor Network & Monitoring**
    Describe: a network of sensors monitoring EC, pH, temperature, humidity, CO₂ levels,
    and light intensity at canopy level. How data is logged and used to make real-time
    adjustments to climate, irrigation, and fertigation. Reference to data-driven yield
    optimisation and early problem detection.

11. **Advanced Technologies Under Evaluation** (include if technology level = elite or if mentioned in questionnaire)
    Describe 1-2 technologies being trialled or evaluated, e.g.:
    - Liquid CO₂ enrichment for enhanced photosynthesis and yield improvement
    - Next-generation low-emissivity greenhouse cladding materials for heat reduction
    - AI-based plant health monitoring using camera systems

12. **Agro-Tourism Infrastructure** (include only if agro_tourism = Yes)
    Describe: prefabricated accommodation units (material, design aesthetic, number of units
    planned — use questionnaire data if available, otherwise leave for placeholder),
    visitor pathways through the farm, salad bar / dining facility design, welcome and
    ticketing area. Reference the tourist experience design philosophy.

⬡ PLACEHOLDER: Equipment Supplier Quotes
Attach formal quotations from suppliers for:
- Greenhouse structure and cladding
- Cooling system (pad & fan or alternative)
- Irrigation and fertigation equipment
- Hydroponic growing system components
Include lead times, warranty terms, and local service availability in {{country}}.

⬡ PLACEHOLDER: Greenhouse Layout / Site Plan
Upload the technical site plan or CAD drawing showing all structures, service areas,
accommodation (if applicable), and vehicle access routes on the {{land_size_sqm}} sqm site.

---

{{consultant_instructions}}
`,

  // ── Section 11: Proposed Timelines ─────────────────────────────────────────
  report_proposed_timelines: `
You are writing the Proposed Timelines section of a professional agricultural feasibility report.

Project: {{project_title}}
Location: {{region}}, {{country}}
Land: {{land_size_sqm}} sqm
Crops: {{crop_types}}
Project type: {{project_type}}

STRUCTURE TO FOLLOW:

---

## Proposed Timelines

### Construction Timeline

⬡ PLACEHOLDER: Construction Gantt Chart
Upload your project management Gantt chart showing all construction phases,
durations, dependencies, and milestone dates.

Write a narrative paragraph describing the construction sequence for this project.
Cover all phases in logical order, noting which overlap and which are sequential:

- **Pre-construction (Weeks 1-3):** Work order / contract agreement signing, site marking,
  mobilisation of site team.
- **Drawing Preparation & Approvals (Weeks 2-5, overlapping):** Detailed engineering drawings,
  building permits, regulatory approvals from {{country}}'s relevant authorities.
  Note: approval timelines in {{country}} can vary — consultant to verify.
- **Procurement (Weeks 1-20, parallel track):** Lead time for greenhouse structure,
  nethouse, prefabricated units (if applicable), and specialised equipment is typically
  12-16 weeks. Orders must be placed early to avoid delaying construction readiness.
- **Civil Works (Weeks 8-14):** Site levelling and excavation, foundation works, internal
  road and drainage layout, utility connections (power, water, internet).
- **Greenhouse & Nethouse Construction (Weeks 14-24):** Structural erection, cladding,
  gutter system, internal fit-out (benching, rails, growing system supports).
- **HVAC, Electrical & Plumbing (Weeks 18-24, parallel):** Cooling system installation,
  electrical distribution, irrigation mainlines, fertigation tank installation.
- **Growing System Installation (Weeks 22-26):** Drip lines, growbag placement, sensor
  network, fertigation system calibration and testing.
- **Packhouse, Office & Accommodation (Weeks 16-26):** Parallel to greenhouse works;
  prefabricated structures installed and fitted out.
- **Testing, Commissioning & Training (Final 2-3 weeks):** Full system test runs,
  climate control calibration, staff training on equipment operation and SOPs.
- **Project Completion:** Estimated total construction duration: [estimate based on project
  scale — typically 5-8 months for a project of this size].

---

### Operational Timeline

⬡ PLACEHOLDER: Operational Gantt Chart
Upload the operational readiness Gantt chart showing recruitment, procurement,
licensing, and go-live milestones with owner-responsible dates.

Write a narrative paragraph describing the operational sequence from team hiring through
to first commercial harvest:

- **Farm Manager / Grower (3+ months before seeding):** The lead grower must join early
  to oversee crop planning, SOP development, and system setup before workers arrive.
- **Government Licensing & Compliance (45 days, overlapping):** Agricultural licences,
  food safety registration, and export certifications where applicable. Timeline varies
  in {{country}} — consultant to confirm with relevant authority.
- **Marketing & Branding (2+ months before go-live):** Website launch, social media setup,
  initial buyer outreach, and tour operator partnerships (if agro-tourism).
- **Procurement of Agri Inputs & Consumables (1 month before seeding):** Seeds (certified
  varieties), growing substrates, nutrients, packaging materials.
- **Farm Labour Recruitment & Onboarding (1 month before seeding):** Workers join,
  receive training on hydroponic operations, pest management, and health & safety.
- **SOP & Log Format Preparation (2-4 weeks before seeding):** Standard operating
  procedures for all farm tasks, daily log formats, pest scouting records.
- **Operational Readiness / Go-Live — Seeding:** First seeds placed in propagation trays.
  This is the official operational start date.
- **Transplanting (Month +5 to +7 weeks after seeding):** Seedlings transplanted into
  growbags in the main greenhouse.
- **First Harvest (Month +4 to +5 from seeding):** For vine crops (tomato, capsicum,
  cucumber), first harvest typically occurs 10-14 weeks after transplanting.
  Reference specific growing cycles of {{crop_types}}.
- **Full Commercial Production (Month +6 to +8):** All growing areas at full production
  capacity; sales contracts active; logistics operational.

---

{{consultant_instructions}}
`,

  // ── Section 12: Quality Assurance & Control Plan ────────────────────────────
  report_quality_assurance: `
You are writing the Quality Assurance & Control Plan section of a professional agricultural
feasibility report.

Project: {{project_title}}
Location: {{country}}
Crops: {{crop_types}}
Target markets: {{target_markets}}

STRUCTURE TO FOLLOW:

---

## Quality Assurance & Control Plan

Write 1 opening paragraph explaining that {{project_title}}'s quality programme is built
on internationally recognised standards, ensuring that produce meets the requirements of
domestic buyers, export markets, and food safety regulators in {{country}}.

### Quality Standards Framework

**GLOBALG.A.P (Global Agricultural Practices)**
Write 2-3 sentences covering:
- What GLOBALG.A.P covers (safe and sustainable production, environmental responsibility,
  worker welfare, traceability)
- Its recognition in 120+ countries as the leading farm assurance programme
- How it translates consumer and retailer requirements into documented agricultural practice
- Its importance for supplying supermarket chains and export markets

**ISO 22000 — Food Safety Management System**
Write 2-3 sentences covering:
- What ISO 22000 addresses (food safety hazards throughout the supply chain)
- Its scope for this project: from growing inputs → harvest → packing → distribution
- Its relevance for supplying hotels, restaurants, and export buyers who require formal
  food safety documentation

**ISO 9001 — Administration & Quality Management** (include if project scale warrants it)
Write 1-2 sentences on how ISO 9001 underpins the administrative and operational processes
(purchasing, supplier management, staff training, customer complaint handling).

**Export Certification Requirements** (include only if export markets are in {{target_markets}})
Write 2-3 sentences covering:
- Phytosanitary certification requirements for exporting fresh produce from {{country}}
- Any destination-country specific requirements (UAE ESMA, Saudi SFDA, etc.)
- Cold chain documentation and traceability requirements for cross-border shipments

**Organic Certification Pathway** (include only if mentioned in questionnaire or consultant notes)
Write 2 sentences on the pathway to organic certification, minimum transition period,
and the premium market opportunity this creates.

### Certification Timeline

Write 1-2 paragraphs:
- Note that formal certification typically requires 12-18 months of documented operation
- Explain that the farm will operate to the standard from Day 1 — building the records
  and evidence base needed for audit
- Reference the market advantage: certified produce commands premium pricing and opens
  doors to buyers who mandate certification (major supermarket chains, export)
- State that after the first year of operation, if the client requires it, {{company_name}}
  can support the formal certification audit process

Write 1 closing sentence linking the QA programme to the farm's premium pricing strategy
and the financial projections.

---

{{consultant_instructions}}
`,

  // ── Section 13: Financial Projection ───────────────────────────────────────
  report_financial_projection: `
You are writing the Financial Projection section of a professional agricultural feasibility report.
CRITICAL: Every number in this section comes from the financial model JSON below.
Do NOT invent, estimate, or change any figure. If a figure is missing, use a placeholder.

Currency: {{currency}}
Financial model (source of truth — all values in {{currency}}):
{{financial_model_json}}

Consultant financial notes:
{{consultant_research_notes}}

STRUCTURE TO FOLLOW:

---

## Financial Projection

Write 1 opening paragraph introducing the financial projections:
- Total investment required and what it covers at a high level
- That projections are based on conservative market pricing and realistic yield benchmarks
- That a sensitivity analysis confirms viability even under adverse conditions

### Investment Summary

Write 1 sentence introducing the investment. Then this table:

| Investment Component | Amount ({{currency}}) |
|----------------------|-----------------------|
| Infrastructure & Greenhouse Construction | [from capex breakdown if available] |
| Hydroponic Growing Systems | [from capex breakdown if available] |
| Packhouse & Cold Storage | [from capex breakdown if available] |
| Automated Irrigation & Fertigation | [from capex breakdown if available] |
| Office, Administration & Staff Facilities | [from capex breakdown if available] |
| Agro-Tourism Infrastructure | [from capex breakdown if available — only if applicable] |
| **Total Capital Investment (CAPEX)** | **[capex_total] {{currency}}** |
| Pre-Startup Operating Requirement | [pre_startup_cost] {{currency}} |
| **Total Investment Required** | **[capex_total + pre_startup_cost] {{currency}}** |

Note: If line-item CAPEX breakdown is not available from the model, show only the totals
and add this placeholder:

⬡ PLACEHOLDER: Detailed CAPEX Breakdown
Add a line-item cost breakdown per infrastructure component from supplier quotations.
This will replace the summary table above with actual quoted costs.

---

### Production Projections

Write 1 sentence introducing production. Then this table (use crops array from financial model):

| Crop | Growing Area (sqm) | Annual Yield (Tonnes) |
|------|-------------------|----------------------|

After the table, write 1-2 sentences noting:
- That yields are based on industry benchmarks for {{country}}'s climate and the chosen varieties
- Any crop with delayed full production (e.g. fig trees reach full yield after year 1)

---

### Revenue Projections

Write 1 introductory sentence. Then this table:

| Crop / Revenue Source | Annual Yield (kg) | Avg. Price ({{currency}}/kg) | Annual Revenue ({{currency}}) |
|-----------------------|------------------|-----------------------------|-----------------------------|
[rows from crops array]
[Agro-Tourism Revenue row if agro_tourism_revenue > 0]
| **Total Annual Revenue** | | | **[total_annual_revenue] {{currency}}** |

Write 2-3 sentences on:
- The seasonal pricing strategy: summer premium prices vs winter competitive pricing
- How year-round contracts at agreed prices with anchor buyers buffer against seasonal price drops
- The blended average price used in the model and why it is conservative

---

### Operating Costs

Write 1 sentence. Then this table:

| Cost Category | Annual Cost ({{currency}}) |
|---------------|---------------------------|
| Growing Costs (seeds, nutrients, substrates, packaging, pest management) | [growing_cost_annual] |
| Agro-Tourism Operating Costs (utilities, guide, facility maintenance) | [agro_tourism cost if applicable] |
| Total Manpower (full team — see staffing table below) | [manpower_cost_annual] |
| **Total Annual OPEX** | **[growing_cost_annual + manpower_cost_annual] {{currency}}** |

**Management & Staffing**

Write 1 intro sentence. Then this staffing table as a starting framework:

| Role | Qty | Qualification | Min. Experience | Est. Monthly Cost ({{currency}}) | Nationality |
|------|-----|---------------|-----------------|----------------------------------|-------------|
| Farm Manager / Grower | 1 | Bachelor's in Agriculture | 5+ years | [from model or estimate] | Expat |
| Sales & Marketing | 1 | Bachelor's in Business | 3+ years | [estimate] | Local / Expat |
| Accounts | 1 | CA / Accounting Degree | 3+ years | [estimate] | Local / Expat |
| Agro-Tourism Executive | 1 | Bachelor's in Business | 3+ years | [estimate — only if agro_tourism = Yes] | Local / Expat |
| Farm Supervisor / Storekeeper | 1 | High School | 5+ years | [estimate] | Expat |
| Farm Labour | [n] | High School | N/A | [from model or estimate per head] | Local / Expat |
| PRO / Admin | 1 | High School | 3+ years | [estimate] | Local |
| **Total Monthly CTC** | | | | **[manpower_cost_annual / 12] {{currency}}** | |
| **Total Annual CTC** | | | | **[manpower_cost_annual] {{currency}}** | |

⬡ PLACEHOLDER: Staffing Plan — Final Figures
Verify all salary figures against current local market rates in {{country}}.
Confirm the Local vs Expat ratio complies with {{country}}'s labour nationalisation requirements.
Adjust headcount based on farm scale and phased ramp-up plan.

---

### Profitability Summary

Write 1 introductory sentence. Then this table — use EXACT figures from the financial model:

| Metric | Value |
|--------|-------|
| Annual Revenue | [total_annual_revenue] {{currency}} |
| Total Annual OPEX | [growing_cost_annual + manpower_cost_annual] {{currency}} |
| **Annual EBITDA** | **[ebitda] {{currency}}** |
| **EBITDA Margin** | **[ebitda_margin]%** |
| Break-Even Point | [estimate month/year based on seeding start + payback] |
| **Payback Period** | **[payback_years] years** |

Write 2-3 sentences after the table:
- Note that the projected payback period of {{payback_years}} years is prudent for an
  agricultural project and represents a strong return for the investment
- Mention ROI enhancement options (without changing the model numbers): expanding growing
  area, shifting crop mix toward higher-margin varieties, adding export revenue
- State that these are opportunities for Phase 2 scaling, not assumptions in this model

---

{{consultant_instructions}}
`,

  // ── Section 14: Risk & Mitigation ───────────────────────────────────────────
  report_risk_mitigation: `
You are writing the Risk & Mitigation section of a professional agricultural feasibility report.

Project: {{project_title}}
Location: {{region}}, {{country}}
Crops: {{crop_types}}
Project type: {{project_type}}

STRUCTURE TO FOLLOW:

---

## Risk & Mitigation

Write 1 opening paragraph stating that management has identified and embedded risk mitigation
strategies into the business plan and project design, ensuring the project remains viable
under a range of adverse conditions.

Then present this risk matrix table:

| Risk Category | Risk Description & Impact | Mitigation Strategy |
|---------------|--------------------------|---------------------|
| **Utility Availability** | Electricity and quality water at {{region}} are critical at all phases. Outages or poor water quality can halt production and threaten crop health. | Site selected based on confirmed electrical infrastructure access in {{region}}. Water source verified for salinity and EC suitability. Backup power and water storage provision in project design. |
| **Production — Disease & Yield Loss** | Crop disease (soil-borne, airborne, or waterborne), equipment breakdown, or extreme weather can reduce yields. A 25% yield reduction has been stress-tested. | Soil-free hydroponic growing eliminates soil-borne disease risk. Air-filtered cooling system prevents airborne pest entry. Certified seeds with disease-resistance profiles. Worker disinfection protocol on greenhouse entry. Preventive maintenance schedule for all equipment. |
| **Market Demand** | Demand for {{crop_types}} must remain consistent for revenue projections to hold. A sudden demand drop would affect cash flow. | Crops selected based on import data and confirmed local demand gaps in {{country}}. Year-round supply capability enables advance annual contracts — demand risk is pre-committed, not spot-market dependent. |
| **Market Penetration** | As a new entrant, securing shelf space in supermarkets and establishing buyer relationships takes time. | Competitive pricing against importers from Day 1. Superior freshness advantage of locally grown produce. Government support for local agriculture in {{country}} creates a favourable buyer environment. Initial sales via direct channels (traders, restaurants) while supermarket listings are secured. |
| **Competition** | Other local farms may compete for the same buyers, particularly during the winter growing season. | Year-round growing capability in {{region}} eliminates approximately 90% of seasonal competition during summer. Premium pricing during competitor off-season. Quality differentiation and certification (GLOBALG.A.P) command loyalty with serious buyers. |
| **Pricing Volatility** | Market prices for {{crop_types}} fluctuate seasonally. A simultaneous 25% drop in production volume and selling price has been stress-tested. | Conservative base pricing used in all projections. Year-round contracts at agreed annual prices with anchor buyers hedge against spot market drops. Summer premium offsets winter compression. Crop mix includes varieties with different seasonal demand peaks. |
| **Seasonal Risk** | Winter months may see increased local supply from other farms, compressing margins. | Year-round contracted pricing insulates against winter margin pressure. Export to UAE / GCC (if applicable) provides an alternative market during domestic oversupply periods. Quality differentiation reduces price sensitivity with premium buyers. |
| **Regulatory & Licensing Delays** | Delays in obtaining agricultural or construction licences from {{country}}'s authorities can push back the operational timeline. | Early engagement with relevant authorities during pre-construction phase. Consultant ({{company_name}}) has experience navigating {{country}}'s agricultural licensing process. Timeline buffer built into construction schedule. |
| **Labour Availability** | Specialist agricultural staff (growers, supervisors) may be scarce locally; recruitment of expat staff adds cost and lead time. | Farm Manager / Grower recruitment commenced 3+ months before go-live. Use of qualified expat grower for technical leadership with local staff for day-to-day operations. Training programme to develop local team capacity over time. |

**Sensitivity Analysis**

Write 2-3 sentences:
- A sensitivity analysis was conducted modelling a simultaneous 25% reduction in both
  production volume and selling price — the most adverse realistic scenario.
- Under this scenario, the project remains viable: revenue decreases but EBITDA remains
  positive and the project continues to service its obligations, though the payback period
  extends beyond the base case of {{payback_years}} years.
- This demonstrates the fundamental resilience of the business model and the conservative
  nature of the base case projections.

---

{{consultant_instructions}}
`,

  // ── Section 15: Benefits & Impact ───────────────────────────────────────────
  report_benefits_impact: `
You are writing the Benefits & Impact section of a professional agricultural feasibility report.

Project: {{project_title}}
Location: {{region}}, {{country}}
Crops: {{crop_types}}
Financial highlights: EBITDA {{ebitda}} {{currency}}, Payback {{payback_years}} years
Agro-tourism: {{agro_tourism}}

STRUCTURE TO FOLLOW:

---

## Benefits & Impact

Write 1 opening paragraph stating that {{project_title}} is more than a commercial enterprise —
its establishment in {{region}}, {{country}} creates meaningful and lasting socio-economic
and environmental benefits at the local, regional, and national level.

Then write each benefit as a bold bullet heading followed by 2-3 sentences. Every benefit
MUST be specific to {{country}}'s development context — never generic:

• **Food Security**
  Link directly to {{country}}'s national food security policy or Vision goal.
  Quantify the import substitution: {{project_title}} will produce [yield tonnes] of
  {{crop_types}} locally, reducing the need for the same volume of imported produce.
  Reference the broader strategic goal of reducing {{country}}'s food import bill.

• **Economic Growth & Direct Employment**
  State the number of direct jobs created (from the staffing plan: management + labour).
  Explain the multiplier effect: indirect employment in transport, packaging supply,
  maintenance services, and (if agro-tourism) hospitality.
  Reference the EBITDA of {{ebitda}} {{currency}} as evidence of commercial viability
  and tax-generating economic activity.

• **Technology Transfer & Agricultural Innovation**
  Explain how the introduction of hitech greenhouse farming and hydroponic technology
  to {{region}} raises the bar for the entire local agricultural sector.
  Note that {{company_name}}'s involvement creates a knowledge transfer opportunity for
  local farmers, government extension workers, and agricultural students.

• **Economic Diversification**
  Contextualise within {{country}}'s broader agenda to diversify the economy beyond
  primary extraction industries (oil, gas, mining — use what is relevant for {{country}}).
  Explain how sustainable agriculture, and particularly agro-tourism, represents
  productive diversification that aligns with national development goals.

• **Tourism & Education** (include only if agro_tourism = Yes)
  Explain the farm's role as a tourism asset for {{region}} — drawing visitors, extending
  their stay, and generating hospitality revenue in the local community.
  Reference the educational value: school trips, agricultural awareness programmes,
  hands-on learning that connects urban populations to food production.

• **Knowledge & Skill Development**
  Describe training programmes for farm staff — both the formal onboarding process and
  ongoing skills development in hydroponic farming, pest management, and data-based agriculture.
  Note the potential to extend training to local farmers through open farm days or formal workshops.

• **Environmental Sustainability**
  Quantify the water efficiency advantage: hydroponic systems use 70-90% less water than
  conventional soil farming for the same yield — critical in an arid country like {{country}}.
  Reference the elimination of soil-borne pesticide use, reduction in food miles (local vs
  imported), and any renewable energy or waste recycling elements of the project design.

---

{{consultant_instructions}}
`,

  // ── Section 16: CSR Initiatives ─────────────────────────────────────────────
  report_csr: `
You are writing the CSR Initiatives section of a professional agricultural feasibility report.

Project: {{project_title}}
Location: {{region}}, {{country}}
Agro-tourism: {{agro_tourism}}

STRUCTURE TO FOLLOW:

---

## CSR Initiatives

Write 1 opening paragraph explaining that {{project_title}} is committed to being a
responsible corporate citizen in {{region}}, and that CSR is embedded in the project
design — not an afterthought. Reference the local community and national development priorities.

Then write each initiative as a bold bullet heading followed by 2-3 sentences.
Tailor every initiative to {{country}}'s social, cultural, and community context:

• **Support for Local Schools & Educational Institutions**
  Describe subsidised or free educational farm tours for local school students.
  Explain the agricultural curriculum content (seed to harvest, sustainable farming,
  hydroponics) and how it supports national educational goals.
  Offer to partner with local schools as a practical learning resource.

• **Community Food Support**
  Describe donations of surplus produce to local food banks, community centres,
  or charitable organisations serving vulnerable populations.
  If the project is in a GCC / Middle East country: mention Ramadan iftar meal donations
  or support for social welfare programmes run by the local municipality.

• **Farmer Training & Empowerment**
  Describe open workshops or training programmes for local farmers on modern sustainable
  farming techniques — hydroponics, fertigation, pest management, post-harvest handling.
  Explain that this knowledge transfer supports the broader agricultural sector in {{country}},
  not just {{project_title}}'s direct operations.

• **Community Engagement & Local Involvement**
  Describe initiatives to involve local residents in the farm's activities: community
  open days, volunteering programmes, local hiring preference, and procurement from
  local suppliers where possible.
  Explain how this creates a sense of shared ownership and community pride in the project.

• **Women Empowerment Programme** (include if relevant to {{country}}'s social context)
  Describe training and employment opportunities for women in agricultural and agro-tourism
  roles, with flexible working arrangements suitable for the local context.

• **Environmental Initiatives**
  Describe any environmental community programmes: tree planting, water conservation
  awareness, school environmental projects, or support for local conservation efforts.
  Reference the farm's own environmental practices (water efficiency, reduced pesticides)
  as a demonstration model for the community.

---

{{consultant_instructions}}
`,

  // ── Section 17: Conclusion ──────────────────────────────────────────────────
  report_conclusion: `
You are writing the Conclusion of a professional agricultural feasibility report.
This section must be confident, punchy, and action-oriented — not a generic summary.

Project: {{project_title}}
Location: {{region}}, {{country}}
Currency: {{currency}}

Financial highlights — quote these EXACTLY:
- EBITDA margin: {{ebitda_margin}}%
- Payback period: {{payback_years}} years
- Total investment: {{capex_total}} {{currency}}

Strategic context:
{{strategic_highlights}}

Consultant research notes:
{{consultant_research_notes}}

STRUCTURE TO FOLLOW:

---

## Conclusion

**Paragraph 1 — Feasibility Verdict:**
Open with this sentence (adapt only the project name and country):
"{{project_title}} is a project that can change the face of agriculture in {{country}}."

Then write 3-4 sentences:
- State that this is a profitable project providing strong returns to the investor,
  with payback expected in {{payback_years}} years
- Reference the {{ebitda_margin}}% EBITDA margin as evidence of commercial strength
- Name the 2-3 key factors that drive this viability: year-round growing in {{region}},
  import substitution in {{country}}, and (if applicable) the agro-tourism revenue stream
- State that the sensitivity analysis confirms the project remains viable even under
  a 25% simultaneous reduction in yield and price — demonstrating genuine resilience

**Paragraph 2 — National Alignment:**
Write 3-4 sentences:
- Explain how {{project_title}} works toward a common goal with {{country}}'s government
  on improving food security and reducing import dependency
- Reference the specific national Vision or policy target (e.g. Vision 2040, food security
  strategy) and how this project contributes to it
- Note the contribution to GDP through agricultural output, job creation, and tax revenues
- Explain the farm's role in developing local agricultural knowledge and skills

**Paragraph 3 — Scalability & Next Steps:**
Write 3-4 sentences:
- State that scalability has been incorporated into the project design from the outset —
  the infrastructure, systems, and market relationships established in Phase 1 create a
  platform for expansion
- Name the growth levers for Phase 2: increasing growing area, adding crop varieties,
  expanding into additional regions, securing export contracts
- State that the project is expected to have exponential growth in the future as the
  farm brand and supply relationships mature
- Close with a direct call to action for the investor or financier: this is the moment
  to commit to a project that delivers both financial return and national impact

---

{{consultant_instructions}}
`,

  // ════════════════════════════════════════════════════════════════════════════
  // AUTO-POPULATED / CONTEXT SECTIONS (no consultant_instructions needed)
  // ════════════════════════════════════════════════════════════════════════════

  report_introduction_stub: ``,  // reserved

};

// ── buildPrompt ─────────────────────────────────────────────────────────────
export function buildPrompt(
  task: AITask,
  variables: Record<string, string>,
): string {
  let template = PROMPTS[task];
  if (!template) throw new Error(`Unknown AI task: ${task}`);

  // Replace all {{variable}} tokens
  for (const [key, value] of Object.entries(variables)) {
    template = template.replaceAll(`{{${key}}}`, value || "Not specified");
  }

  // If consultant_instructions was not supplied, remove the token cleanly
  template = template.replaceAll("{{consultant_instructions}}", "").trim();

  if (process.env.NODE_ENV === "development") {
    const unfilled = template.match(/\{\{[^}]+\}\}/g);
    if (unfilled) {
      console.warn(`[AI] Unfilled variables in ${task}:`, unfilled);
    }
  }

  return template.trim();
}