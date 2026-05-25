"use client";

/**
 * src/components/report/ReportPublishBar.tsx
 *
 * The publish / status bar shown at the top (or bottom) of the ReportTab.
 * Covers fixes 3b (placeholder count badge), 3d (financial model override
 * indicator), and 3i (report completeness score).
 *
 * Drop this in place of wherever the existing publish button lives.
 */

import { useState } from "react";
import {
  CheckCircle,
  AlertTriangle,
  Lock,
  Unlock,
  Edit3,
  FileText,
  XCircle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Report, Project } from "@/types";

interface Props {
  report: Report;
  project: Project;
  /** Total sections that should exist (17) */
  totalSections: number;
  /** Whether a publish action is currently in flight */
  publishing: boolean;
  onPublish: () => void;
}

// ── Completeness checks ───────────────────────────────────────────────────────

interface Check {
  label: string;
  done: boolean;
  severity: "error" | "warning" | "info";
}

function useCompletenessChecks(
  report: Report,
  project: Project,
  totalSections: number,
): { checks: Check[]; score: number; placeholderCount: number } {
  const sections = Object.values(report.sections || {}).filter(Boolean);
  const generatedCount = sections.filter((s) => s?.content).length;

  // Count all unfilled ⬡ PLACEHOLDER blocks across all sections
  const placeholderCount = sections.reduce((count, section) => {
    const matches = (section?.content || "").match(/⬡ PLACEHOLDER/g);
    return count + (matches?.length || 0);
  }, 0);

  const financialModel = report.financial_model;
  const hasOverride = !!(project as any).financial_model_override?.capex_total;

  const checks: Check[] = [
    {
      label: `All ${totalSections} sections generated (${generatedCount}/${totalSections})`,
      done: generatedCount >= totalSections,
      severity: "error",
    },
    {
      label: "Executive summary approved",
      done: !!report.sections?.executive_summary?.approved,
      severity: "warning",
    },
    {
      label: "Financial model confirmed",
      done: !!financialModel?.capex_total,
      severity: "error",
    },
    {
      label: `No unfilled placeholders (${placeholderCount} remaining)`,
      done: placeholderCount === 0,
      severity: "warning",
    },
    {
      label: "Client email set",
      done: !!project.client_email,
      severity: "error",
    },
    {
      label: "PDF generated",
      done: !!(report as any).pdf_url,
      severity: "info",
    },
  ];

  const score = checks.filter((c) => c.done).length;
  return { checks, score, placeholderCount };
}

// ── Main component ────────────────────────────────────────────────────────────

export function ReportPublishBar({
  report,
  project,
  totalSections,
  publishing,
  onPublish,
}: Props) {
  const [checklistOpen, setChecklistOpen] = useState(false);
  const { checks, score, placeholderCount } = useCompletenessChecks(
    report,
    project,
    totalSections,
  );

  const total = checks.length;
  const allCriticalPassed = checks
    .filter((c) => c.severity === "error")
    .every((c) => c.done);

  const hasOverride = !!(project as any).financial_model_override?.capex_total;
  const isPublished = (report as any).status === "published";

  // Progress percentage
  const pct = Math.round((score / total) * 100);

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
      {/* Main bar */}
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Score ring */}
        <div className="relative size-10 flex-shrink-0">
          <svg className="size-10 -rotate-90" viewBox="0 0 36 36">
            <circle
              cx="18"
              cy="18"
              r="15"
              fill="none"
              stroke="#f1f5f9"
              strokeWidth="3"
            />
            <circle
              cx="18"
              cy="18"
              r="15"
              fill="none"
              stroke={pct === 100 ? "#1a5c38" : pct >= 66 ? "#f59e0b" : "#ef4444"}
              strokeWidth="3"
              strokeDasharray={`${(pct / 100) * 94.2} 94.2`}
              strokeLinecap="round"
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-foreground">
            {score}/{total}
          </span>
        </div>

        {/* Label */}
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-foreground">
            {score === total
              ? "Ready to publish"
              : `${score} of ${total} checks passed`}
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {score === total
              ? "All checks passed — publish when ready"
              : allCriticalPassed
              ? "Critical checks passed — warnings remain"
              : "Resolve errors before publishing"}
          </p>
        </div>

        {/* Badges */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Placeholder count badge */}
          {placeholderCount > 0 && (
            <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-amber-100 text-amber-700 text-[10px] font-semibold border border-amber-200">
              <AlertTriangle className="size-3" />
              {placeholderCount} placeholder{placeholderCount !== 1 ? "s" : ""}
            </span>
          )}

          {/* Financial model override badge */}
          {hasOverride && (
            <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-blue-100 text-blue-700 text-[10px] font-semibold border border-blue-200">
              <Edit3 className="size-3" />
              Manual model
            </span>
          )}

          {/* Checklist toggle */}
          <button
            onClick={() => setChecklistOpen((v) => !v)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-border text-[11px] text-muted-foreground hover:bg-muted transition-colors"
          >
            {checklistOpen ? (
              <ChevronUp className="size-3.5" />
            ) : (
              <ChevronDown className="size-3.5" />
            )}
            Checklist
          </button>

          {/* Publish button */}
          <button
            onClick={onPublish}
            disabled={publishing || !allCriticalPassed}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-colors",
              isPublished
                ? "bg-blue-600 text-white hover:bg-blue-500"
                : allCriticalPassed
                ? "bg-brand-700 text-white hover:bg-brand-600"
                : "bg-muted text-muted-foreground cursor-not-allowed",
              publishing && "opacity-60 cursor-not-allowed",
            )}
          >
            {isPublished ? (
              <>
                <Unlock className="size-3.5" />
                {publishing ? "Republishing…" : "Republish"}
              </>
            ) : (
              <>
                <Lock className="size-3.5" />
                {publishing ? "Publishing…" : "Publish report"}
              </>
            )}
          </button>
        </div>
      </div>

      {/* Financial model override alert */}
      {hasOverride && (
        <div className="mx-4 mb-3 flex items-start gap-2 px-3 py-2.5 rounded-lg bg-blue-50 border border-blue-200">
          <Edit3 className="size-3.5 text-blue-600 flex-shrink-0 mt-0.5" />
          <p className="text-[11px] text-blue-700 leading-relaxed">
            <span className="font-semibold">Consultant financial model active.</span>{" "}
            The AI-generated figures have been replaced with your manually entered model.
            All financial sections reflect your override values.
          </p>
        </div>
      )}

      {/* Expandable checklist */}
      {checklistOpen && (
        <div className="border-t border-border px-4 py-3 space-y-2">
          {checks.map((check, i) => (
            <div key={i} className="flex items-center gap-2.5">
              {check.done ? (
                <CheckCircle className="size-4 text-brand-600 flex-shrink-0" />
              ) : check.severity === "error" ? (
                <XCircle className="size-4 text-destructive flex-shrink-0" />
              ) : check.severity === "warning" ? (
                <AlertTriangle className="size-4 text-amber-500 flex-shrink-0" />
              ) : (
                <FileText className="size-4 text-muted-foreground flex-shrink-0" />
              )}
              <span
                className={cn(
                  "text-xs",
                  check.done
                    ? "text-muted-foreground line-through"
                    : check.severity === "error"
                    ? "text-foreground font-medium"
                    : "text-muted-foreground",
                )}
              >
                {check.label}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}