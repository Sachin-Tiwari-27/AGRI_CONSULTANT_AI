/**
 * src/lib/report-section-config.ts
 *
 * Single source of truth for the greenhouse 17-section report structure.
 * Used by: ReportEditor, ReportTab, PublicReportView, report/generate/route.ts
 *
 * Each section has:
 *   key          — matches ReportSectionKey in types/index.ts
 *   number       — display number (1-17)
 *   title        — display title shown in UI and PDF
 *   description  — shown as subtitle in empty-state cards
 *   aiTask       — the AITask key to call for generation (null = auto-populated)
 *   aiGenerated  — true if AI writes this section
 *   autoPopulated— true if built from existing project data
 *   hasPlaceholders — true if section contains ⬡ PLACEHOLDER blocks
 *   generationPhase — 1-6, controls generation order
 *   maxTokens    — token budget for this section's AI call
 */

import type { ReportSectionKey, AITask } from "@/types";

export interface SectionConfig {
  key: ReportSectionKey;
  number: number;
  title: string;
  description: string;
  aiTask: AITask | null;
  aiGenerated: boolean;
  autoPopulated: boolean;
  hasPlaceholders: boolean;
  generationPhase: 1 | 2 | 3 | 4 | 5 | 6;
  maxTokens: number;
}

export interface AppendixConfig {
  key: ReportSectionKey;
  title: string;
  autoPopulated: boolean;
  placeholder: boolean;
  placeholderHint?: string;
}

// ── Main sections (shown to client) ───────────────────────────────────
// Generation order:
//   Phase 1 — Foundation (sequential)
//   Phase 2 — Analysis (parallel after Phase 1)
//   Phase 3 — Business & Revenue (sequential)
//   Phase 4 — Risk, Benefits, CSR (parallel)
//   Phase 5 — Timelines (parallel)
//   Phase 6 — Executive Summary (LAST — synthesises all upstream)

export const REPORT_SECTIONS: SectionConfig[] = [
  {
    key: "executive_summary",
    number: 1,
    title: "1. Executive Summary",
    description:
      "Project overview, key financial highlights, strategic rationale, and feasibility verdict.",
    aiTask: "report_executive_summary",
    aiGenerated: true,
    autoPopulated: false,
    hasPlaceholders: true, // cover photo placeholder
    generationPhase: 6, // MUST be last
    maxTokens: 4000,
  },
  {
    key: "introduction",
    number: 2,
    title: "2. Introduction",
    description:
      "Country agricultural context, import dependency, project positioning, and objectives.",
    aiTask: "report_introduction",
    aiGenerated: true,
    autoPopulated: false,
    hasPlaceholders: false,
    generationPhase: 1,
    maxTokens: 3000,
  },
  {
    key: "project_overview",
    number: 3,
    title: "3. Project Overview & About Us",
    description:
      "Investor profile, land and site details, and consultant firm profile.",
    aiTask: "report_project_overview",
    aiGenerated: true,
    autoPopulated: false,
    hasPlaceholders: true, // investor profile + consultant profile placeholders
    generationPhase: 1,
    maxTokens: 1500,
  },
  {
    key: "market_analysis",
    number: 4,
    title: "4. Market Analysis",
    description:
      "Country agricultural landscape, target crop demand & pricing, export opportunities.",
    aiTask: "report_market_analysis",
    aiGenerated: true,
    autoPopulated: false,
    hasPlaceholders: false,
    generationPhase: 2,
    maxTokens: 4000,
  },
  {
    key: "target_market",
    number: 5,
    title: "5. Target Market",
    description:
      "Customer segments: domestic tourists, supermarkets, restaurants, exporters.",
    aiTask: "report_target_market",
    aiGenerated: true,
    autoPopulated: false,
    hasPlaceholders: false,
    generationPhase: 2,
    maxTokens: 2000,
  },
  {
    key: "competitive_analysis",
    number: 6,
    title: "6. Competitive Analysis",
    description:
      "Unique advantages: year-round growing, location, agro-tourism differentiation.",
    aiTask: "report_competitive_analysis",
    aiGenerated: true,
    autoPopulated: false,
    hasPlaceholders: false,
    generationPhase: 2,
    maxTokens: 2500,
  },
  {
    key: "business_model",
    number: 7,
    title: "7. Business Model",
    description:
      "Farm operations, crop cultivation plan, operation facility, agro-tourism activities.",
    aiTask: "report_business_model",
    aiGenerated: true,
    autoPopulated: false,
    hasPlaceholders: true, // greenhouse layout plan placeholder
    generationPhase: 3,
    maxTokens: 3500,
  },
  {
    key: "revenue_streams",
    number: 8,
    title: "8. Revenue Streams",
    description:
      "Crop sales, agro-tourism services, accommodation revenue model.",
    aiTask: "report_revenue_streams",
    aiGenerated: true,
    autoPopulated: false,
    hasPlaceholders: false,
    generationPhase: 3,
    maxTokens: 2000,
  },
  {
    key: "marketing_sales_plan",
    number: 9,
    title: "9. Marketing & Sales Plan",
    description:
      "Brand positioning, target segments, digital marketing, partnerships.",
    aiTask: "report_marketing_sales_plan",
    aiGenerated: true,
    autoPopulated: false,
    hasPlaceholders: true, // marketing budget placeholder
    generationPhase: 3,
    maxTokens: 2500,
  },
  {
    key: "proposed_machinery",
    number: 10,
    title: "10. Proposed Machinery & Infrastructure",
    description:
      "Greenhouse specs, cooling systems, irrigation, hydroponics, automation.",
    aiTask: "report_proposed_machinery",
    aiGenerated: true,
    autoPopulated: false,
    hasPlaceholders: true, // supplier quotes + layout plan placeholders
    generationPhase: 1,
    maxTokens: 3000,
  },
  {
    key: "proposed_timelines",
    number: 11,
    title: "11. Proposed Timelines",
    description:
      "Construction and operational timeline narrative with Gantt chart placeholders.",
    aiTask: "report_proposed_timelines",
    aiGenerated: true,
    autoPopulated: false,
    hasPlaceholders: true, // Gantt chart placeholders (construction + operational)
    generationPhase: 5,
    maxTokens: 2000,
  },
  {
    key: "quality_assurance",
    number: 12,
    title: "12. Quality Assurance & Control Plan",
    description:
      "GLOBALG.A.P, ISO 22000, food safety standards and certification roadmap.",
    aiTask: "report_quality_assurance",
    aiGenerated: true,
    autoPopulated: false,
    hasPlaceholders: false,
    generationPhase: 2,
    maxTokens: 1500,
  },
  {
    key: "financial_projection",
    number: 13,
    title: "13. Financial Projection",
    description:
      "Investment, production, revenue, operating costs, and profitability summary.",
    aiTask: "report_financial_projection",
    aiGenerated: false, // numbers come from financial_model, AI writes narrative only
    autoPopulated: true,
    hasPlaceholders: true, // staffing plan + CAPEX breakdown placeholders
    generationPhase: 3,
    maxTokens: 3000,
  },
  {
    key: "risk_mitigation",
    number: 14,
    title: "14. Risk & Mitigation",
    description:
      "Risk matrix covering utility, production, market, competition, pricing, and seasonal risks.",
    aiTask: "report_risk_mitigation",
    aiGenerated: true,
    autoPopulated: false,
    hasPlaceholders: false,
    generationPhase: 4,
    maxTokens: 3000,
  },
  {
    key: "benefits_impact",
    number: 15,
    title: "15. Benefits & Impact",
    description:
      "Socio-economic and environmental benefits aligned with national vision.",
    aiTask: "report_benefits_impact",
    aiGenerated: true,
    autoPopulated: false,
    hasPlaceholders: false,
    generationPhase: 4,
    maxTokens: 2000,
  },
  {
    key: "csr",
    number: 16,
    title: "16. CSR Initiatives",
    description:
      "Community engagement, school partnerships, farmer training programmes.",
    aiTask: "report_csr",
    aiGenerated: true,
    autoPopulated: false,
    hasPlaceholders: false,
    generationPhase: 4,
    maxTokens: 1500,
  },
  {
    key: "conclusion",
    number: 17,
    title: "17. Conclusion",
    description:
      "Feasibility verdict, key success factors, and recommended next steps.",
    aiTask: "report_conclusion",
    aiGenerated: true,
    autoPopulated: false,
    hasPlaceholders: false,
    generationPhase: 4,
    maxTokens: 2000,
  },
];

// ── Appendices ─────────────────────────────────────────────────────────
export const REPORT_APPENDICES: AppendixConfig[] = [
  {
    key: "appendix_questionnaire",
    title: "Appendix A — Questionnaire Summary",
    autoPopulated: true,
    placeholder: false,
  },
  {
    key: "appendix_climate",
    title: "Appendix B — Climate Data",
    autoPopulated: true,
    placeholder: false,
  },
  {
    key: "appendix_market_sources",
    title: "Appendix C — Market Research Sources",
    autoPopulated: true,
    placeholder: false,
  },
  {
    key: "appendix_assumptions",
    title: "Appendix D — Financial Assumptions",
    autoPopulated: true,
    placeholder: false,
  },
  {
    key: "appendix_water_quality",
    title: "Appendix E — Water Quality Report",
    autoPopulated: false,
    placeholder: true,
    placeholderHint: "Upload lab EC/TDS/pH report",
  },
  {
    key: "appendix_soil_analysis",
    title: "Appendix F — Soil Analysis Report",
    autoPopulated: false,
    placeholder: true,
    placeholderHint: "Upload soil test results",
  },
  {
    key: "appendix_site_survey",
    title: "Appendix G — Site Survey / Map",
    autoPopulated: false,
    placeholder: true,
    placeholderHint: "Upload land survey or satellite map with boundaries",
  },
  {
    key: "appendix_supplier_quotes",
    title: "Appendix H — Equipment Supplier Quotes",
    autoPopulated: false,
    placeholder: true,
    placeholderHint: "Attach greenhouse, cooling, and irrigation quotes",
  },
  {
    key: "appendix_company_profile",
    title: "Appendix I — Company / Firm Profile",
    autoPopulated: false,
    placeholder: true,
    placeholderHint: "Attach consultant firm profile and past projects",
  },
];

// ── Context sections (not shown to client) ─────────────────────────────
export const CONTEXT_SECTION_KEYS: ReportSectionKey[] = [
  "context_market_data",
  "context_climate_data",
  "technical_analysis",
];

// ── Helpers ────────────────────────────────────────────────────────────

/** All main section keys in display order */
export const MAIN_SECTION_KEYS = REPORT_SECTIONS.map((s) => s.key);

/** Keys that should NOT require approval before publishing */
export const NO_APPROVAL_KEYS: ReportSectionKey[] = [
  "appendix_questionnaire",
  "appendix_climate",
  "appendix_market_sources",
  "appendix_assumptions",
  "appendix_water_quality",
  "appendix_soil_analysis",
  "appendix_site_survey",
  "appendix_supplier_quotes",
  "appendix_company_profile",
  ...CONTEXT_SECTION_KEYS,
];

/** Get sections grouped by generation phase */
export function getSectionsByPhase(): Map<number, SectionConfig[]> {
  const map = new Map<number, SectionConfig[]>();
  for (const section of REPORT_SECTIONS) {
    const existing = map.get(section.generationPhase) || [];
    map.set(section.generationPhase, [...existing, section]);
  }
  return map;
}

/** Get a section config by key */
export function getSectionConfig(
  key: ReportSectionKey,
): SectionConfig | undefined {
  return REPORT_SECTIONS.find((s) => s.key === key);
}

/** Task-to-token budget map — used by ai.service.ts TASK_MAX_TOKENS */
export const SECTION_TASK_TOKENS: Partial<Record<AITask, number>> =
  Object.fromEntries(
    REPORT_SECTIONS.filter((s) => s.aiTask !== null).map((s) => [
      s.aiTask!,
      s.maxTokens,
    ]),
  ) as Partial<Record<AITask, number>>;
