"use client";

// ── src/components/report-formats/ExcerptConfigPanel.tsx ─────────────────────
import { FileText, Eye, Hash } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import type { ReportFormatSection } from "@/types/report-format";

interface Props {
  sections: ReportFormatSection[];
  excerptKeys: string[];
  excerptWordLimit: number;
  onExcerptKeysChange: (keys: string[]) => void;
  onWordLimitChange: (limit: number) => void;
}

const TYPE_BADGE_VARIANT: Record<string, any> = {
  content: "gray",
  financial: "green",
  market: "blue",
  risk: "amber",
  technical: "purple",
  operational: "violet",
  custom: "orange",
};

export function ExcerptConfigPanel({
  sections,
  excerptKeys,
  excerptWordLimit,
  onExcerptKeysChange,
  onWordLimitChange,
}: Props) {
  function toggleKey(key: string) {
    onExcerptKeysChange(
      excerptKeys.includes(key)
        ? excerptKeys.filter((k) => k !== key)
        : [...excerptKeys, key],
    );
  }

  const selectedSections = sections.filter((s) => excerptKeys.includes(s.key));
  const totalWordTarget = selectedSections.reduce(
    (sum, s) => sum + s.word_count_target,
    0,
  );

  return (
    <div className="px-6 py-4 space-y-5">
      {/* Explainer */}
      <div className="rounded-xl border border-border bg-muted/30 px-4 py-3">
        <div className="flex items-start gap-2.5">
          <Eye className="size-4 text-brand-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-semibold text-foreground">
              Excerpt report
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
              Before sharing the full report, you can send a teaser excerpt to
              the client. Choose which sections appear in the excerpt and how
              many words of each section to include. The excerpt has its own
              publish action and URL.
            </p>
          </div>
        </div>
      </div>

      {/* Word limit per section */}
      <div>
        <label className="text-xs font-medium text-foreground/80 block mb-1.5">
          <Hash className="size-3 inline mr-1" />
          Words per section in excerpt
        </label>
        <p className="text-[11px] text-muted-foreground mb-2">
          Each selected section will be truncated to approximately this many
          words in the excerpt view.
        </p>
        <div className="flex items-center gap-3">
          <Input
            type="number"
            value={excerptWordLimit}
            onChange={(e) => onWordLimitChange(Number(e.target.value))}
            className="w-32 h-8 text-xs"
            min={50}
            max={1000}
            step={50}
          />
          <span className="text-xs text-muted-foreground">
            words per section
          </span>
        </div>
      </div>

      {/* Section selector */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-medium text-foreground/80">
            Sections to include in excerpt
          </label>
          <span className="text-[11px] text-muted-foreground">
            {excerptKeys.length} selected · ~{totalWordTarget.toLocaleString()}{" "}
            words total (untruncated)
          </span>
        </div>

        <div className="space-y-1.5">
          {sections.map((section) => {
            const isSelected = excerptKeys.includes(section.key);
            return (
              <button
                key={section.key}
                type="button"
                onClick={() => toggleKey(section.key)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-left transition-all ${
                  isSelected
                    ? "border-brand-400 bg-brand-50"
                    : "border-border bg-card hover:border-brand-200"
                }`}
              >
                {/* Checkbox visual */}
                <div
                  className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                    isSelected
                      ? "bg-brand-700 border-brand-700"
                      : "border-border"
                  }`}
                >
                  {isSelected && (
                    <svg
                      className="w-2.5 h-2.5 text-white"
                      fill="none"
                      viewBox="0 0 12 12"
                    >
                      <path
                        d="M2 6l3 3 5-5"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p
                    className={`text-xs font-medium truncate ${
                      isSelected ? "text-brand-800" : "text-foreground"
                    }`}
                  >
                    {section.title}
                  </p>
                  {section.description && (
                    <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                      {section.description}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <Badge
                    variant={TYPE_BADGE_VARIANT[section.section_type] || "gray"}
                    className="text-[9px] py-0"
                  >
                    {section.section_type}
                  </Badge>
                  <span className="text-[10px] text-muted-foreground w-14 text-right">
                    ~{section.word_count_target}w
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Preview summary */}
      {excerptKeys.length > 0 && (
        <div className="rounded-xl border border-brand-200 bg-brand-50/40 px-4 py-3">
          <p className="text-[11px] font-semibold text-brand-700 mb-1.5">
            Excerpt will include:
          </p>
          <ol className="space-y-0.5">
            {selectedSections.map((s, i) => (
              <li key={s.key} className="text-[11px] text-brand-600">
                {i + 1}. {s.title} — up to {excerptWordLimit} words
              </li>
            ))}
          </ol>
          <p className="text-[10px] text-brand-500 mt-2">
            Unselected sections will be blurred with a "Unlock full report"
            call-to-action.
          </p>
        </div>
      )}
    </div>
  );
}
