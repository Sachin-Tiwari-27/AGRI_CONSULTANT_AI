"use client";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { ReportEditor } from "@/components/report/ReportEditor";
import { MarkdownRenderer } from "@/components/ui/MarkdownRenderer";
import {
  Zap,
  FileText,
  CheckCircle,
  Lock,
  Send,
  Download,
  Eye,
  RefreshCw,
  BarChart3,
  TrendingUp,
  Clock,
  DollarSign,
  ChevronRight,
  Sparkles,
  Globe,
  AlertCircle,
  BookOpen,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import type { Report, ReportSectionKey, Project } from "@/types";

const SECTIONS = [
  {
    key: "executive_summary" as ReportSectionKey,
    title: "Executive Summary",
    desc: "High-level overview and strategic rationale.",
    icon: BookOpen,
  },
  {
    key: "market_analysis" as ReportSectionKey,
    title: "Market & Economic Analysis",
    desc: "Demand, pricing strategy, and competitive landscape.",
    icon: Globe,
  },
  {
    key: "business_model" as ReportSectionKey,
    title: "Business Model",
    desc: "Revenue streams, distribution, operations.",
    icon: BarChart3,
  },
  {
    key: "financial_projection" as ReportSectionKey,
    title: "Financial Projections",
    desc: "CAPEX, operating costs, revenue forecasts, ROI.",
    icon: TrendingUp,
  },
  {
    key: "risk_mitigation" as ReportSectionKey,
    title: "Risk Assessment",
    desc: "Climate, operational, and commercial risks.",
    icon: AlertCircle,
  },
  {
    key: "conclusion" as ReportSectionKey,
    title: "Conclusion & Recommendations",
    desc: "Feasibility verdict and next steps.",
    icon: CheckCircle,
  },
];

interface Props {
  project: Project;
  report: Report | null;
  hasSubmission: boolean;
  loading: string | null;
  onGenerateReport: (section?: ReportSectionKey) => void;
  onUpdateReport: (r: Report) => void;
}

export function ReportTab({
  project,
  report,
  hasSubmission,
  loading,
  onGenerateReport,
  onUpdateReport,
}: Props) {
  const [view, setView] = useState<"builder" | "preview">("builder");
  const currency = (project as any).currency || "USD";
  const fm = report?.financial_model;

  const generatedCount = report
    ? Object.keys(report.sections).filter(
        (k) =>
          ![
            "context_market_data",
            "context_climate_data",
            "technical_analysis",
          ].includes(k),
      ).length
    : 0;
  const approvedCount = report
    ? SECTIONS.filter((s) => report.sections[s.key]?.approved).length
    : 0;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            Report Builder
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Generate, edit, and publish the client-ready feasibility report.
          </p>
        </div>
        {report && (
          <div className="flex items-center gap-2">
            <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
              {(["builder", "preview"] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium capitalize transition-all ${
                    view === v
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onGenerateReport()}
              loading={loading === "report"}
            >
              <RefreshCw className="w-3.5 h-3.5" /> Regenerate All
            </Button>
          </div>
        )}
      </div>

      {/* No report yet */}
      {!report && (
        <div className="space-y-5">
          {/* Hero generate card */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-green-900 p-8">
            <div className="absolute top-0 right-0 w-64 h-64 bg-green-500/10 rounded-full -mr-20 -mt-20 blur-3xl" />
            <div className="relative z-10 flex items-center justify-between gap-8">
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 bg-green-500/20 rounded-lg flex items-center justify-center">
                    <Sparkles className="w-4 h-4 text-green-400" />
                  </div>
                  <span className="text-xs font-bold uppercase tracking-widest text-green-400">
                    AI Report Generator
                  </span>
                </div>
                <h3 className="text-2xl font-bold text-white mb-2">
                  Feasibility Report
                </h3>
                <p className="text-slate-300 text-sm max-w-md">
                  {hasSubmission
                    ? "Questionnaire data received. Generate the full AI-drafted feasibility report now — all 6 sections in one click."
                    : "Collect the questionnaire first to enable report generation."}
                </p>
              </div>
              <Button
                onClick={() => onGenerateReport()}
                loading={loading === "report"}
                disabled={!hasSubmission}
                className="flex-shrink-0 bg-green-600 hover:bg-green-500 border-green-500 text-white"
                size="lg"
              >
                <Zap className="w-5 h-5" /> Generate Full Report
              </Button>
            </div>
          </div>

          {/* Section skeleton */}
          <div className="grid gap-3">
            {SECTIONS.map((sec) => {
              const Icon = sec.icon;
              return (
                <div
                  key={sec.key}
                  className="group bg-white rounded-xl border border-slate-200 hover:border-green-200 hover:shadow-sm transition-all p-4 flex items-center gap-4"
                >
                  <div className="w-10 h-10 rounded-xl bg-slate-50 group-hover:bg-green-50 flex items-center justify-center text-slate-400 group-hover:text-green-600 transition-colors flex-shrink-0">
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-sm font-semibold text-slate-900">
                      {sec.title}
                    </h4>
                    <p className="text-xs text-slate-500 mt-0.5">{sec.desc}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => onGenerateReport(sec.key)}
                    disabled={!hasSubmission}
                    loading={loading === `report_${sec.key}`}
                  >
                    {hasSubmission ? "Generate Section" : "Awaiting Data"}
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Report exists */}
      {report && (
        <div className="space-y-4">
          {/* Status bar */}
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-center gap-6">
              <div className="flex-1 grid grid-cols-3 gap-4">
                <StatusPill
                  label="Sections"
                  value={`${generatedCount} / ${SECTIONS.length}`}
                  active={generatedCount === SECTIONS.length}
                />
                <StatusPill
                  label="Approved"
                  value={`${approvedCount} / ${SECTIONS.length}`}
                  active={approvedCount === SECTIONS.length}
                />
                <StatusPill
                  label="Status"
                  value={report.status === "published" ? "Published" : "Draft"}
                  active={report.status === "published"}
                />
              </div>
              {fm && (
                <div className="flex gap-4 border-l border-slate-100 pl-6">
                  <KpiPill
                    label="CAPEX"
                    value={formatCurrency(fm.capex_total, currency)}
                  />
                  <KpiPill
                    label="Revenue/yr"
                    value={formatCurrency(fm.total_annual_revenue, currency)}
                  />
                  <KpiPill label="Payback" value={`${fm.payback_years} yrs`} />
                </div>
              )}
            </div>
          </div>

          {view === "builder" ? (
            <ReportEditor
              report={report}
              projectId={project.id}
              onUpdate={onUpdateReport}
            />
          ) : (
            <ReportPreview report={report} currency={currency} />
          )}
        </div>
      )}
    </div>
  );
}

function StatusPill({
  label,
  value,
  active,
}: {
  label: string;
  value: string;
  active: boolean;
}) {
  return (
    <div className="text-center">
      <p className="text-xs text-slate-500">{label}</p>
      <p
        className={`text-sm font-semibold mt-0.5 ${active ? "text-green-700" : "text-slate-700"}`}
      >
        {value}
      </p>
    </div>
  );
}

function KpiPill({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
        {label}
      </p>
      <p className="text-sm font-bold text-slate-900 mt-0.5">{value}</p>
    </div>
  );
}

function ReportPreview({
  report,
  currency,
}: {
  report: Report;
  currency: string;
}) {
  const sectionKeys = SECTIONS.map((s) => s.key).filter(
    (k) => report.sections[k],
  );
  return (
    <div className="space-y-6">
      {/* Branding header */}
      <div
        className="rounded-2xl p-8 text-white"
        style={{
          background: `linear-gradient(135deg, ${report.branding.primary_color}, ${report.branding.secondary_color})`,
        }}
      >
        <p className="text-xs font-bold uppercase tracking-widest opacity-70 mb-2">
          Feasibility Report — Preview
        </p>
        <h1 className="text-2xl font-bold mb-1">
          Agricultural Project Synthesis
        </h1>
        <p className="text-white/70 text-sm">
          By {report.branding.consultant_name} · {report.branding.company_name}
        </p>
        <div
          className={`inline-flex items-center gap-2 mt-4 px-3 py-1.5 rounded-full text-xs font-semibold ${
            report.status === "published" ? "bg-white/20" : "bg-white/10"
          }`}
        >
          {report.status === "published" ? (
            <Lock className="w-3 h-3" />
          ) : (
            <Eye className="w-3 h-3" />
          )}
          {report.status === "published" ? "Published" : "Draft"}
        </div>
      </div>

      {/* Sections */}
      {sectionKeys.map((key) => {
        const section = report.sections[key];
        if (!section) return null;
        const meta = SECTIONS.find((s) => s.key === key);
        const Icon = meta?.icon || FileText;
        return (
          <Card key={key}>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center ${section.approved ? "bg-green-50 text-green-600" : "bg-slate-50 text-slate-500"}`}
                >
                  {section.approved ? (
                    <CheckCircle className="w-4 h-4" />
                  ) : (
                    <Icon className="w-4 h-4" />
                  )}
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    {meta?.title || key}
                  </p>
                  {section.approved && (
                    <p className="text-xs text-green-600 font-medium">
                      Approved
                    </p>
                  )}
                </div>
                {section.ai_generated && (
                  <span className="ml-auto flex items-center gap-1 text-xs text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full">
                    <Sparkles className="w-3 h-3" /> AI
                  </span>
                )}
              </div>
            </CardHeader>
            <CardBody>
              <MarkdownRenderer content={section.content} />
            </CardBody>
          </Card>
        );
      })}
    </div>
  );
}
