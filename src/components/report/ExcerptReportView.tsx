"use client";

// ── src/components/report/ExcerptReportView.tsx ───────────────────────────────
// Renders the public excerpt page.
//
// SECURITY NOTE: This component no longer receives the full report.sections map.
// Instead it receives:
//   - excerptContent: Record<sectionKey, truncatedText> — pre-truncated on the
//     server via the public_report_excerpts view. No full report content leaks.
//   - financialHighlights: safe scalar summary values only.
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MarkdownRenderer } from "@/components/ui/markdown-renderer";
import { formatCurrency } from "@/lib/utils";
import {
  Lock,
  FileText,
  TrendingUp,
  BarChart3,
  CheckCircle,
  Eye,
} from "lucide-react";

interface ExcerptSection {
  key: string;
  title: string;
  word_limit: number;
}

interface FinancialHighlights {
  capex_total?: number | null;
  total_annual_revenue?: number | null;
  payback_years?: number | null;
}

interface Branding {
  primary_color?: string;
  secondary_color?: string;
  consultant_name?: string;
  company_name?: string;
  footer_text?: string;
}

interface Props {
  projectId: string;
  projectTitle: string;
  excerptSections: ExcerptSection[];
  /** Pre-truncated content keyed by section key — never the full report text. */
  excerptContent: Record<string, string | null>;
  financialHighlights?: FinancialHighlights | null;
  branding?: Branding | null;
  fullReportPublished: boolean;
}

export function ExcerptReportView({
  projectId,
  projectTitle,
  excerptSections,
  excerptContent,
  financialHighlights,
  branding,
  fullReportPublished,
}: Props) {
  const primary = branding?.primary_color || "#1A5C38";
  const fm = financialHighlights;

  return (
    <div className="max-w-4xl mx-auto py-10 px-4 space-y-10">
      {/* Cover */}
      <div
        className="rounded-2xl p-10 text-white shadow-xl relative overflow-hidden"
        style={{
          background: `linear-gradient(135deg, ${primary}, ${branding?.secondary_color || "#2E7D52"})`,
        }}
      >
        <div className="relative z-10">
          <Badge className="bg-white/20 text-white border-white/30 mb-4">
            <Eye className="size-3" /> Excerpt Preview
          </Badge>
          <h1 className="text-3xl font-bold tracking-tight mb-2">
            {projectTitle}
          </h1>
          <p className="text-white/75 text-sm mb-4">
            Prepared by {branding?.consultant_name} — {branding?.company_name}
          </p>
          <p className="text-white/60 text-xs">
            This is a preview excerpt.{" "}
            {fullReportPublished
              ? "The full report is available below."
              : "The full report is coming soon."}
          </p>
        </div>
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-32 -mt-32 blur-3xl" />
      </div>

      {/* Financial highlights — safe scalar summary only */}
      {fm && (fm.capex_total || fm.total_annual_revenue || fm.payback_years) && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            {
              label: "Total CAPEX",
              value: formatCurrency(fm.capex_total ?? 0),
              icon: BarChart3,
              show: fm.capex_total != null,
            },
            {
              label: "Annual Revenue",
              value: formatCurrency(fm.total_annual_revenue ?? 0),
              icon: TrendingUp,
              show: fm.total_annual_revenue != null,
            },
            {
              label: "Payback Period",
              value: `${fm.payback_years ?? 0} years`,
              icon: CheckCircle,
              show: fm.payback_years != null,
            },
          ]
            .filter((item) => item.show)
            .map(({ label, value, icon: Icon }) => (
              <div
                key={label}
                className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 flex items-center gap-4"
              >
                <div className="p-2.5 rounded-xl bg-brand-50">
                  <Icon className="size-5 text-brand-700" />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    {label}
                  </p>
                  <p className="text-xl font-bold text-foreground mt-0.5">
                    {value}
                  </p>
                </div>
              </div>
            ))}
        </div>
      )}

      {/* Excerpt sections — content is already truncated server-side */}
      {excerptSections.map((es) => {
        const content = excerptContent[es.key];
        if (!content) return null;

        // The view already truncated to word_limit words; we detect whether
        // the original was cut by checking if the word count equals the limit.
        const wordCount = content.trim().split(/\s+/).length;
        const wasCut = wordCount >= es.word_limit;

        return (
          <section
            key={es.key}
            className="bg-white rounded-xl border border-slate-200 shadow-sm p-8"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
                <FileText className="size-4 text-muted-foreground" />
              </div>
              <h2 className="text-xl font-bold text-foreground">{es.title}</h2>
            </div>
            <div className="relative">
              <MarkdownRenderer content={content} />
              {wasCut && (
                <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-white to-transparent pointer-events-none" />
              )}
            </div>
            {wasCut && (
              <p className="text-xs text-muted-foreground mt-4 text-center">
                Preview truncated to {es.word_limit} words
              </p>
            )}
          </section>
        );
      })}

      {/* Unlock CTA */}
      <div className="rounded-2xl border-2 border-dashed border-brand-200 bg-brand-50/40 p-8 text-center">
        <Lock className="size-8 text-brand-300 mx-auto mb-3" />
        <h3 className="text-lg font-bold text-foreground mb-2">
          Get the full feasibility report
        </h3>
        <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
          The complete report includes detailed financial projections, market
          analysis, technical specifications, risk assessment, and actionable
          recommendations.
        </p>
        {fullReportPublished ? (
          <Button asChild>
            <a href={`/project/${projectId}/report`}>View Full Report →</a>
          </Button>
        ) : (
          <p className="text-sm text-muted-foreground font-medium">
            Full report coming soon — your consultant is finalising it.
          </p>
        )}
      </div>

      {/* Footer */}
      <footer className="py-8 border-t border-border text-center">
        <p className="text-xs text-muted-foreground">
          © {new Date().getFullYear()} {branding?.company_name}. All rights
          reserved.
          <br />
          Confidential Business Intelligence Report — Excerpt Preview.
        </p>
      </footer>
    </div>
  );
}
