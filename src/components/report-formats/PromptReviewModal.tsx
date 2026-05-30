"use client";

// ── src/components/report-formats/PromptReviewModal.tsx ──────────────────────
import { useState } from "react";
import { Check, X, Wand2, AlertCircle, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface Props {
  sectionKey: string;
  sectionTitle: string;
  initialPrompt: string;
  onConfirm: (sectionKey: string, prompt: string) => void;
  onClose: () => void;
}

// Variables available at report generation time — shown as reference
const AVAILABLE_VARIABLES = [
  "project_title",
  "region",
  "country",
  "currency",
  "crop_types",
  "project_type",
  "client_name",
  "company_name",
  "consultant_name",
  "technical_analysis",
  "market_research",
  "financial_model_json",
  "questionnaire_answers",
  "consultant_research_notes",
  "climate_data",
  "capex_total",
  "total_annual_revenue",
  "ebitda",
  "ebitda_margin",
  "payback_years",
  "agro_tourism",
  "target_markets",
  "budget_range",
  "experience_level",
  "gps_coordinates",
  "land_size_sqm",
  "greenhouse_area_sqm",
  "nethouse_area_sqm",
  "strategic_highlights",
  "consultant_instructions",
];

export function PromptReviewModal({
  sectionKey,
  sectionTitle,
  initialPrompt,
  onConfirm,
  onClose,
}: Props) {
  const [prompt, setPrompt] = useState(initialPrompt);
  const [showVarRef, setShowVarRef] = useState(false);

  // Detect any variables used in the prompt
  const usedVars =
    prompt.match(/\{\{([^}]+)\}\}/g)?.map((v) => v.replace(/\{\{|\}\}/g, "")) ??
    [];
  const unknownVars = usedVars.filter((v) => !AVAILABLE_VARIABLES.includes(v));

  const wordCount = prompt.trim().split(/\s+/).filter(Boolean).length;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-card border border-border rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-violet-100">
              <Wand2 className="size-4 text-violet-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">
                Review AI-generated prompt
              </p>
              <p className="text-[11px] text-muted-foreground truncate max-w-sm">
                {sectionTitle}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Info banner */}
        <div className="px-6 py-3 bg-blue-50 border-b border-blue-100 flex-shrink-0">
          <div className="flex items-start gap-2 text-xs text-blue-700">
            <Info className="size-3.5 flex-shrink-0 mt-0.5" />
            <p>
              This prompt will be used every time this section is generated or
              regenerated. Edit it below — use{" "}
              <code className="bg-blue-100 px-1 rounded">{"{{variable}}"}</code>{" "}
              syntax for dynamic values.
              <button
                onClick={() => setShowVarRef(!showVarRef)}
                className="ml-1 font-medium underline"
              >
                {showVarRef ? "Hide" : "Show"} available variables
              </button>
            </p>
          </div>
        </div>

        {/* Variable reference (collapsible) */}
        {showVarRef && (
          <div className="px-6 py-3 bg-slate-50 border-b border-border flex-shrink-0">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              Available variables
            </p>
            <div className="flex flex-wrap gap-1">
              {AVAILABLE_VARIABLES.map((v) => (
                <button
                  key={v}
                  onClick={() => {
                    const insertion = `{{${v}}}`;
                    setPrompt((p) => p + insertion);
                  }}
                  className="text-[10px] font-mono bg-white border border-border rounded px-1.5 py-0.5 text-muted-foreground hover:border-brand-400 hover:text-brand-700 transition-colors"
                >
                  {v}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Prompt editor */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {unknownVars.length > 0 && (
            <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3">
              <AlertCircle className="size-3.5 flex-shrink-0 mt-0.5" />
              <p>
                Unknown variables detected:{" "}
                {unknownVars.map((v) => (
                  <code key={v} className="bg-amber-100 px-1 rounded mx-0.5">
                    {`{{${v}}}`}
                  </code>
                ))}
                . These will be replaced with "Not specified" at generation
                time.
              </p>
            </div>
          )}

          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={20}
            className="w-full px-3 py-3 text-xs font-mono rounded-xl border border-input bg-background focus:outline-none focus:ring-2 focus:ring-violet-400 resize-none leading-relaxed"
            placeholder="Prompt template will appear here…"
          />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-muted/30 flex-shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-[11px] text-muted-foreground">
              {wordCount} words · {prompt.length} chars
            </span>
            {usedVars.length > 0 && (
              <span className="text-[11px] text-muted-foreground">
                · {usedVars.length} variable
                {usedVars.length !== 1 ? "s" : ""} used
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => onConfirm(sectionKey, prompt)}
              disabled={!prompt.trim()}
              className="bg-violet-700 hover:bg-violet-600 border-violet-600 text-white"
            >
              <Check className="size-3.5" /> Confirm prompt
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
