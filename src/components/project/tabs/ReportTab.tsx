"use client";
import { useState, useRef } from "react";
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
  Sparkles,
  Globe,
  AlertCircle,
  BookOpen,
  Loader2,
  Users,
  Settings,
  Target,
  Megaphone,
  Calendar,
  ShieldCheck,
  Heart,
  Calculator,
  ChevronDown,
  ChevronUp,
  PaperclipIcon,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import {
  REPORT_SECTIONS,
  REPORT_APPENDICES,
  type SectionConfig,
} from "@/lib/report-section-config";
import type { Report, ReportSectionKey, Project } from "@/types";

// Icon map for section keys
const SECTION_ICONS: Record<string, React.ElementType> = {
  executive_summary: BookOpen,
  introduction: FileText,
  project_overview: Users,
  market_analysis: Globe,
  target_market: Target,
  competitive_analysis: TrendingUp,
  business_model: BarChart3,
  revenue_streams: DollarSign,
  marketing_sales_plan: Megaphone,
  proposed_machinery: Settings,
  proposed_timelines: Calendar,
  quality_assurance: ShieldCheck,
  financial_projection: Calculator,
  risk_mitigation: AlertCircle,
  benefits_impact: Sparkles,
  csr: Heart,
  conclusion: CheckCircle,
};

interface Props {
  project: Project;
  report: Report | null;
  hasSubmission: boolean;
  loading: string | null;
  onGenerateReport: (section?: ReportSectionKey) => void;
  onUpdateReport: (r: Report) => void;
  onUpdateProject: (patch: Partial<Project>) => void;
}

export function ReportTab({
  project,
  report,
  hasSubmission,
  loading,
  onGenerateReport,
  onUpdateReport,
  onUpdateProject,
}: Props) {
  const [view, setView] = useState<"builder" | "preview">("builder");
  const [streamingSection, setStreamingSection] = useState<string | null>(null);
  const [streamingReport, setStreamingReport] = useState<Report | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [showAppendices, setShowAppendices] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const currency = (project as any).currency || "USD";
  const fm = report?.financial_model;
  const displayReport = streamingReport ?? report;

  // Count completed main sections (exclude appendices and context)
  const mainSectionKeys = REPORT_SECTIONS.map((s) => s.key);
  const generatedCount = displayReport
    ? mainSectionKeys.filter((k) => !!displayReport.sections[k]?.content).length
    : 0;
  const approvedCount = displayReport
    ? mainSectionKeys.filter((k) => displayReport.sections[k]?.approved).length
    : 0;

  // Auto-populated appendices
  const appendixAutoKeys = REPORT_APPENDICES.filter((a) => a.autoPopulated).map(
    (a) => a.key,
  );
  const appendixFilledCount = displayReport
    ? REPORT_APPENDICES.filter(
        (a) =>
          displayReport.sections[a.key]?.content &&
          !displayReport.sections[a.key]?.is_placeholder,
      ).length
    : 0;

  // ── Streaming generate ──────────────────────────────────────────────
  async function generateReportStreaming(specificSection?: ReportSectionKey) {
    if (!hasSubmission) {
      alert("Please collect questionnaire data first.");
      return;
    }

    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setIsStreaming(true);
    setStreamingSection(null);
    setStreamingReport(report ? { ...report } : null);

    try {
      const res = await fetch("/api/report/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: project.id,
          sectionsToGenerate: specificSection ? [specificSection] : undefined,
          stream: true,
        }),
        signal: abortRef.current.signal,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed");
      }

      const contentType = res.headers.get("content-type") || "";

      if (contentType.includes("text/event-stream")) {
        const reader = res.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            try {
              const event = JSON.parse(line.slice(6));
              if (event.type === "generating")
                setStreamingSection(event.section);
              if (event.type === "section_complete") {
                setStreamingSection(null);
                setStreamingReport((prev) => {
                  const base = prev ?? ({ ...report, sections: {} } as Report);
                  return {
                    ...base,
                    sections: {
                      ...base.sections,
                      [event.section]: {
                        key: event.section,
                        content: event.content,
                        ai_generated: true,
                        last_edited_at: new Date().toISOString(),
                        approved: false,
                      },
                    },
                  };
                });
              }
              if (event.type === "complete") {
                const pRes = await fetch(`/api/projects/${project.id}`);
                const updated = await pRes.json();
                const finalReport = updated.reports?.[0] ?? null;
                if (finalReport) {
                  onUpdateReport(finalReport);
                  setStreamingReport(null);
                }
                onUpdateProject({ status: "report_draft" });
                setIsStreaming(false);
                setStreamingSection(null);
              }
            } catch {}
          }
        }
      } else {
        const pRes = await fetch(`/api/projects/${project.id}`);
        const updated = await pRes.json();
        if (updated.reports?.[0]) onUpdateReport(updated.reports[0]);
        onUpdateProject({ status: "report_draft" });
        setIsStreaming(false);
        setStreamingSection(null);
      }
    } catch (err: any) {
      if (err.name === "AbortError") return;
      alert(err.message || "Report generation failed");
      setIsStreaming(false);
      setStreamingSection(null);
      setStreamingReport(null);
    }
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            Report Builder
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Generate, edit, and publish the {REPORT_SECTIONS.length}-section
            feasibility report.
          </p>
        </div>
        {displayReport && (
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
              {(["builder", "preview"] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium capitalize transition-all ${view === v ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                >
                  {v}
                </button>
              ))}
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => generateReportStreaming()}
              loading={isStreaming}
              disabled={isStreaming}
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${isStreaming ? "animate-spin" : ""}`}
              />
              {isStreaming ? "Generating…" : "Regenerate All"}
            </Button>
          </div>
        )}
      </div>

      {/* No report + not streaming */}
      {!displayReport && !isStreaming && (
        <div className="space-y-5">
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-green-900 p-8">
            <div className="absolute top-0 right-0 w-64 h-64 bg-green-500/10 rounded-full -mr-20 -mt-20 blur-3xl" />
            <div className="relative z-10 flex items-center justify-between gap-8 flex-wrap">
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 bg-green-500/20 rounded-lg flex items-center justify-center">
                    <Sparkles className="w-4 h-4 text-green-400" />
                  </div>
                  <span className="text-xs font-bold uppercase tracking-widest text-green-400">
                    AI Report Generator — {REPORT_SECTIONS.length} Sections
                  </span>
                </div>
                <h3 className="text-2xl font-bold text-white mb-2">
                  Feasibility Report
                </h3>
                <p className="text-slate-300 text-sm max-w-md">
                  {hasSubmission
                    ? "Sections appear in real-time as they complete. Matches the Zaher Farm professional report format."
                    : "Collect the questionnaire first to enable report generation."}
                </p>
              </div>
              <Button
                onClick={() => generateReportStreaming()}
                loading={isStreaming}
                disabled={!hasSubmission || isStreaming}
                className="flex-shrink-0 bg-green-600 hover:bg-green-500 border-green-500 text-white"
                size="lg"
              >
                <Zap className="w-5 h-5" />
                {isStreaming ? "Generating…" : "Generate Full Report"}
              </Button>
            </div>
          </div>

          {/* Section grid preview */}
          <div className="grid gap-3">
            {REPORT_SECTIONS.map((sec) => {
              const Icon = SECTION_ICONS[sec.key] || FileText;
              return (
                <div
                  key={sec.key}
                  className="group bg-white rounded-xl border border-slate-200 hover:border-green-200 hover:shadow-sm transition-all p-4 flex items-center gap-4"
                >
                  <div className="w-10 h-10 rounded-xl bg-slate-50 group-hover:bg-green-50 flex items-center justify-center text-slate-400 group-hover:text-green-600 transition-colors flex-shrink-0">
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-semibold text-slate-900">
                      {sec.title}
                    </h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {sec.description}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {sec.hasPlaceholders && (
                      <span className="text-[10px] text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full whitespace-nowrap">
                        Has placeholders
                      </span>
                    )}
                    {sec.autoPopulated && (
                      <span className="text-[10px] text-blue-600 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded-full whitespace-nowrap">
                        Auto-populated
                      </span>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => generateReportStreaming(sec.key)}
                      disabled={!hasSubmission || isStreaming}
                      loading={isStreaming && streamingSection === sec.key}
                    >
                      Generate
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Streaming progress (no report yet) */}
      {isStreaming && !displayReport && (
        <div className="space-y-3">
          {REPORT_SECTIONS.map((sec) => {
            const isActive = streamingSection === sec.key;
            const isDone = !!streamingReport?.sections[sec.key]?.content;
            return (
              <div
                key={sec.key}
                className={`rounded-xl border p-4 transition-all ${
                  isDone
                    ? "border-green-200 bg-green-50/30"
                    : isActive
                      ? "border-emerald-300 bg-emerald-50/20 ring-1 ring-emerald-200"
                      : "border-slate-200 bg-white opacity-50"
                }`}
              >
                <div className="flex items-center gap-3">
                  {isDone ? (
                    <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                  ) : isActive ? (
                    <Loader2 className="w-4 h-4 text-emerald-500 animate-spin flex-shrink-0" />
                  ) : (
                    <div className="w-4 h-4 rounded-full border-2 border-slate-300 flex-shrink-0" />
                  )}
                  <span className="text-sm font-medium text-slate-800 truncate">
                    {sec.title}
                  </span>
                  {isActive && (
                    <span className="text-xs text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full flex-shrink-0">
                      Generating…
                    </span>
                  )}
                  {isDone && (
                    <span className="text-xs text-green-600 bg-green-100 px-2 py-0.5 rounded-full flex-shrink-0">
                      Complete
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Report exists */}
      {displayReport && (
        <div className="space-y-4">
          {/* Status bar */}
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-center gap-6 flex-wrap">
              <div className="flex-1 grid grid-cols-3 gap-4 min-w-[280px]">
                <StatusPill
                  label="Sections"
                  value={`${generatedCount} / ${REPORT_SECTIONS.length}`}
                  active={generatedCount === REPORT_SECTIONS.length}
                />
                <StatusPill
                  label="Approved"
                  value={`${approvedCount} / ${REPORT_SECTIONS.length}`}
                  active={approvedCount === REPORT_SECTIONS.length}
                />
                <StatusPill
                  label="Status"
                  value={
                    displayReport.status === "published" ? "Published" : "Draft"
                  }
                  active={displayReport.status === "published"}
                />
              </div>
              {fm && (
                <div className="flex gap-4 border-l border-slate-100 pl-6 flex-wrap">
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
            <>
              <ReportEditor
                report={displayReport}
                project={project}
                projectId={project.id}
                onUpdate={onUpdateReport}
                onProjectUpdate={onUpdateProject}
                streamingSection={streamingSection}
              />

              {/* Appendices panel */}
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <button
                  onClick={() => setShowAppendices((s) => !s)}
                  className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <PaperclipIcon className="w-4 h-4 text-slate-500" />
                    <div className="text-left">
                      <p className="text-sm font-semibold text-slate-900">
                        Appendices
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {appendixFilledCount} of {REPORT_APPENDICES.length}{" "}
                        completed · 4 auto-populated · 5 need consultant input
                      </p>
                    </div>
                  </div>
                  {showAppendices ? (
                    <ChevronUp className="w-4 h-4 text-slate-400" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-slate-400" />
                  )}
                </button>

                {showAppendices && (
                  <div className="border-t border-slate-100 divide-y divide-slate-50">
                    {REPORT_APPENDICES.map((appendix) => {
                      const section = displayReport.sections[appendix.key];
                      const hasContent =
                        !!section?.content && !(section as any).is_placeholder;

                      return (
                        <div
                          key={appendix.key}
                          className="px-5 py-3 flex items-center gap-3"
                        >
                          <div
                            className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                              hasContent
                                ? "bg-green-100"
                                : appendix.placeholder
                                  ? "bg-amber-100"
                                  : "bg-blue-100"
                            }`}
                          >
                            {hasContent ? (
                              <CheckCircle className="w-3.5 h-3.5 text-green-600" />
                            ) : appendix.placeholder ? (
                              <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
                            ) : (
                              <Sparkles className="w-3.5 h-3.5 text-blue-500" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-800 truncate">
                              {appendix.title}
                            </p>
                            <p className="text-xs text-slate-500">
                              {hasContent
                                ? "Content available"
                                : appendix.autoPopulated
                                  ? "Auto-populated from project data"
                                  : appendix.placeholder
                                    ? "Awaiting consultant upload"
                                    : ""}
                            </p>
                          </div>
                          <span
                            className={`text-[10px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap flex-shrink-0 ${
                              hasContent
                                ? "bg-green-50 text-green-700"
                                : appendix.autoPopulated
                                  ? "bg-blue-50 text-blue-700"
                                  : "bg-amber-50 text-amber-700"
                            }`}
                          >
                            {hasContent
                              ? "Done"
                              : appendix.autoPopulated
                                ? "Auto"
                                : "Add content"}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          ) : (
            <ReportPreview report={displayReport} currency={currency} />
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
  return (
    <div className="space-y-6">
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
          className={`inline-flex items-center gap-2 mt-4 px-3 py-1.5 rounded-full text-xs font-semibold ${report.status === "published" ? "bg-white/20" : "bg-white/10"}`}
        >
          {report.status === "published" ? (
            <Lock className="w-3 h-3" />
          ) : (
            <Eye className="w-3 h-3" />
          )}
          {report.status === "published" ? "Published" : "Draft"}
        </div>
      </div>

      {REPORT_SECTIONS.map((sec) => {
        const section = report.sections[sec.key];
        if (!section?.content) return null;
        const Icon = SECTION_ICONS[sec.key] || FileText;
        return (
          <Card key={sec.key}>
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
                    {sec.title}
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
