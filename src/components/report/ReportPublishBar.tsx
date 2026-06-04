"use client";

// Changes:
//   - Moved from top-of-sidebar card to a compact status strip
//   - Progress ring replaced with a linear progress bar + fraction
//   - Checklist is a dropdown popover, not an expand-in-place panel
//   - Placeholder badge and manual model badge remain
//   - Same props interface — drop-in replacement

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  CheckCircle,
  AlertTriangle,
  Lock,
  Unlock,
  Edit3,
  XCircle,
  FileText,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Report, Project } from "@/types";

interface Props {
  report: Report;
  project: Project;
  totalSections: number;
  publishing: boolean;
  onPublish: () => void;
}

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

  const placeholderCount = sections.reduce((count, section) => {
    const matches = (section?.content || "").match(/⬡ PLACEHOLDER/g);
    return count + (matches?.length || 0);
  }, 0);

  const financialModel = report.financial_model;

  const checks: Check[] = [
    {
      label: `${generatedCount}/${totalSections} sections generated`,
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
      label: `${placeholderCount} unfilled placeholder${placeholderCount !== 1 ? "s" : ""}`,
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
  const pct = Math.round((score / total) * 100);

  // Color for progress bar
  const barColor =
    pct === 100 ? "bg-brand-600" : pct >= 66 ? "bg-amber-500" : "bg-red-400";

  return (
    <div className="rounded-xl border border-border bg-card relative">
      {/* Main row */}
      <div className="px-3 py-3 space-y-2.5">
        {/* Progress bar */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
              Readiness
            </span>
            <span className="text-[10px] font-medium text-muted-foreground tabular-nums">
              {score}/{total}
            </span>
          </div>
          <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-300",
                barColor,
              )}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        {/* Badges row */}
        {(placeholderCount > 0 || hasOverride) && (
          <div className="flex flex-wrap gap-1">
            {placeholderCount > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-[9px] font-semibold text-amber-700">
                <AlertTriangle className="size-2.5" />
                {placeholderCount} placeholder
                {placeholderCount !== 1 ? "s" : ""}
              </span>
            )}
            {hasOverride && (
              <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 border border-blue-200 px-2 py-0.5 text-[9px] font-semibold text-blue-700">
                <Edit3 className="size-2.5" /> Manual model
              </span>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-1.5">
          <Button
            onClick={onPublish}
            disabled={publishing || !allCriticalPassed}
            size="sm"
            variant={isPublished ? "secondary" : "default"}
            className="flex-1 h-8 text-xs"
            loading={publishing}
          >
            {isPublished ? (
              <>
                <Unlock className="size-3" /> Republish
              </>
            ) : (
              <>
                <Lock className="size-3" /> Publish
              </>
            )}
          </Button>

          {/* Checklist dropdown */}
          <div className="relative">
            <Button
              size="icon-sm"
              variant="outline"
              onClick={() => setChecklistOpen((v) => !v)}
              className="h-8 w-8"
              title="View readiness checklist"
            >
              <ChevronDown
                className={cn(
                  "size-3.5 transition-transform",
                  checklistOpen && "rotate-180",
                )}
              />
            </Button>

            {checklistOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setChecklistOpen(false)}
                />
                <div className="absolute right-0 top-full mt-1 w-64 bg-card border border-border rounded-xl shadow-xl py-2 z-50">
                  <p className="px-3 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                    Publish checklist
                  </p>
                  {checks.map((check, i) => (
                    <div key={i} className="flex items-start gap-2 px-3 py-1.5">
                      {check.done ? (
                        <CheckCircle className="size-3.5 text-brand-500 flex-shrink-0 mt-0.5" />
                      ) : check.severity === "error" ? (
                        <XCircle className="size-3.5 text-destructive flex-shrink-0 mt-0.5" />
                      ) : check.severity === "warning" ? (
                        <AlertTriangle className="size-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
                      ) : (
                        <FileText className="size-3.5 text-muted-foreground flex-shrink-0 mt-0.5" />
                      )}
                      <span
                        className={cn(
                          "text-[11px] leading-snug",
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
              </>
            )}
          </div>
        </div>
      </div>

      {/* Manual model notice — compact */}
      {hasOverride && (
        <div className="px-3 py-2 border-t border-border bg-blue-50/40 flex items-start gap-1.5 rounded-b-xl">
          <Edit3 className="size-3 text-blue-500 flex-shrink-0 mt-0.5" />
          <p className="text-[10px] text-blue-600 leading-snug">
            Consultant financial model active — AI figures replaced.
          </p>
        </div>
      )}
    </div>
  );
}
