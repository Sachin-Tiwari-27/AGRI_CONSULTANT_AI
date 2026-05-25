"use client";

// src/components/report/SectionInstructionsPanel.tsx
//
// A compact, slide-in panel that sits below the section header in ReportEditor.
// Consultants type instructions here before generating (or regenerating) a section.
// Instructions are saved to projects.section_instructions and passed into the
// AI prompt as {{consultant_instructions}}.

import { useState, useEffect, useCallback } from "react";
import { Sparkles, ChevronDown, ChevronUp, Save, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  projectId: string;
  sectionKey: string;
  /** Initial value loaded from project.section_instructions[sectionKey] */
  initialValue?: string;
  /** Called after a successful save so the parent can refresh its state */
  onSaved?: (sectionKey: string, instruction: string) => void;
}

export function SectionInstructionsPanel({
  projectId,
  sectionKey,
  initialValue = "",
  onSaved,
}: Props) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(initialValue);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Sync if the parent provides a new initial value (e.g. section change)
  useEffect(() => {
    setValue(initialValue);
    setSaved(false);
  }, [initialValue, sectionKey]);

  const hasInstruction = value.trim().length > 0;

  const save = useCallback(async () => {
    setSaving(true);
    try {
      await fetch("/api/report/instructions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          sectionKey,
          instruction: value.trim(),
        }),
      });
      setSaved(true);
      onSaved?.(sectionKey, value.trim());
      // Auto-dismiss the "saved" state after 2s
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }, [projectId, sectionKey, value, onSaved]);

  const clear = useCallback(async () => {
    setValue("");
    setSaving(true);
    try {
      await fetch("/api/report/instructions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, sectionKey, instruction: "" }),
      });
      onSaved?.(sectionKey, "");
    } finally {
      setSaving(false);
    }
  }, [projectId, sectionKey, onSaved]);

  return (
    <div
      className={cn(
        "rounded-xl border transition-colors mb-3",
        hasInstruction
          ? "border-violet-200 bg-violet-50/60"
          : "border-border bg-muted/20",
      )}
    >
      {/* Header toggle */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-2.5 text-left"
      >
        <Sparkles
          className={cn(
            "size-3.5 flex-shrink-0",
            hasInstruction ? "text-violet-600" : "text-muted-foreground",
          )}
        />
        <span
          className={cn(
            "text-xs font-medium flex-1 truncate",
            hasInstruction ? "text-violet-700" : "text-muted-foreground",
          )}
        >
          {hasInstruction
            ? `Consultant instructions: ${value.trim().slice(0, 55)}${value.trim().length > 55 ? "…" : ""}`
            : "Add consultant instructions for this section"}
        </span>
        {open ? (
          <ChevronUp className="size-3.5 text-muted-foreground flex-shrink-0" />
        ) : (
          <ChevronDown className="size-3.5 text-muted-foreground flex-shrink-0" />
        )}
      </button>

      {/* Expanded content */}
      {open && (
        <div className="px-3 pb-3 space-y-2.5">
          <p className="text-[10px] text-muted-foreground leading-relaxed">
            These instructions are injected into the AI prompt when this section
            is generated or regenerated. Use them to steer tone, emphasis,
            specific data points, or structure. Leave blank to use the default prompt.
          </p>

          <textarea
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setSaved(false);
            }}
            rows={4}
            placeholder={PLACEHOLDERS[sectionKey] || DEFAULT_PLACEHOLDER}
            className={cn(
              "w-full px-3 py-2 text-xs rounded-lg border resize-none",
              "bg-white focus:outline-none focus:ring-2 focus:ring-violet-400",
              hasInstruction ? "border-violet-300" : "border-input",
            )}
          />

          <div className="flex items-center gap-2">
            <button
              onClick={save}
              disabled={saving}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                saved
                  ? "bg-green-100 text-green-700 border border-green-300"
                  : "bg-violet-700 text-white hover:bg-violet-600",
                saving && "opacity-60 cursor-not-allowed",
              )}
            >
              <Save className="size-3" />
              {saved ? "Saved!" : saving ? "Saving…" : "Save instructions"}
            </button>

            {hasInstruction && (
              <button
                onClick={clear}
                disabled={saving}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-destructive hover:bg-red-50 border border-border transition-colors"
              >
                <Trash2 className="size-3" />
                Clear
              </button>
            )}

            <span className="ml-auto text-[10px] text-muted-foreground">
              {value.length} chars
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Section-specific placeholder hints ────────────────────────────────────────
// These appear as greyed-out hint text inside the textarea so consultants know
// what kind of instruction makes sense for each section.

const DEFAULT_PLACEHOLDER =
  "e.g. Focus on the water scarcity angle. Mention the government subsidy programme. Keep it under 400 words.";

const PLACEHOLDERS: Record<string, string> = {
  executive_summary:
    "e.g. Open with a reference to the client's Vision 2040 alignment. Emphasise the tourism revenue stream. The feasibility verdict must be unambiguous.",

  introduction:
    "e.g. Use the exact GDP figure of 2.5% from the Ministry of Agriculture report. Mention the 9.8% sector growth in 2019-2020.",

  project_overview:
    "e.g. The client is a well-known businessman in region X. Reference the two land plots: 10,175 sqm and 28,311 sqm. Unicorn Farm Tech is the implementation partner.",

  market_analysis:
    "e.g. Emphasise that Oman imports fruits and vegetables worth 1 billion annually. Highlight that XYZ Farm's initial production is only 0.1% of this market — enormous headroom. Include UAE export opportunity via road.",

  target_market:
    "e.g. Prioritise Carrefour, Sultan Center, Al Fair, Spinneys, and Lulu as the primary supermarket targets. Include Al Meera for Qatar export if applicable.",

  competitive_analysis:
    "e.g. The key differentiator is that Al Hamra's low humidity lets us grow in summer when Al Bathina farms stop. Quantify: we eliminate 90% of seasonal competition. Be specific about the summer price premium.",

  business_model:
    "e.g. Greenhouse 1: 153m x 36m = 5,508 sqm. Greenhouse 2: 107m x 36m = 3,852 sqm. Net house: 96m x 66m = 6,335 sqm. 250 fig trees in open field. Cultivation plan: 15 spans beef tomato, 11 spans cherry tomato, nethouse for capsicum.",

  revenue_streams:
    "e.g. Include agro-tourism pricing: Twin Unit OMR 150/night, Single Unit OMR 80/night, Farm Day Tour OMR 20/person. Total agro-tourism revenue OMR 33,732. Total farm revenue OMR 241,308.",

  marketing_sales_plan:
    "e.g. Prioritise WhatsApp Business for B2B buyer communication in Oman. Instagram for agro-tourism. Partner with Oman Tourism for farm listing. Target Sultan Center and Carrefour for initial supermarket listings.",

  proposed_machinery:
    "e.g. Emphasise the H2O2 generator as a key disease prevention tool. Include the liquid CO2 injection trial. Prefabricated accommodation units should be referenced as a first-of-its-kind offering in Al Hamra.",

  proposed_timelines:
    "e.g. Construction start: August. Lead time for structures: end of September delivery. Construction: 120 days from early February. Operational: grower joins October, seeding February 2024, first harvest May 2024.",

  quality_assurance:
    "e.g. Reference GLOBALG.A.P, ISO 9001, and ISO 22000 as the three standards to pursue. Certification target: after 1 year of operation. Link to export market requirements (UAE, Saudi).",

  financial_projection:
    "e.g. CAPEX: OMR 715,800. Pre-startup: OMR 87,109. Beef tomato: OMR 0.750/kg, Cherry tomato: OMR 1.300/kg, Capsicum: OMR 0.650/kg, Fig: OMR 2.000/kg. Total annual revenue: OMR 275,040. EBITDA: OMR 153,921 (61%). Breakeven: July 2029.",

  risk_mitigation:
    "e.g. Emphasise that a 25% drop in both production and price still keeps the project viable — stress-test result. Al Hamra's unique climate eliminates 90% of summer competition. Year-round contracts at agreed prices remove demand risk.",

  benefits_impact:
    "e.g. Link to Oman Vision 2040 food security target of 4% GDP by 2030. Reference the 9.8% sector growth. Quantify water savings: hydroponic vs soil farming. Mention direct jobs created (from staffing table).",

  csr:
    "e.g. School partnerships with Al Hamra schools. Ramadan surplus produce donations. Free training workshops for local farmers on hydroponic techniques. Community open farm days quarterly.",

  conclusion:
    "e.g. Open: 'XYZ Farm is a project that can change the face of agriculture in Oman.' Payback 6-7 years. Reference exponential growth potential. End with a clear call to action for bank funding.",
};