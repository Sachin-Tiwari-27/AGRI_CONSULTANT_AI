"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MarkdownRenderer } from "@/components/ui/markdown-renderer";
import { ReportEditor } from "@/components/report/ReportEditor";
import { PaymentGateModal } from "@/components/report/PaymentGateModal";
import { ReportPublishBar } from "@/components/report/ReportPublishBar";
import { ReportSidebarSection } from "@/components/report/ReportSidebarSection";
import { DocxImportModal } from "@/components/report/DocxImportModal";
import { createClient } from "@/lib/supabase/client";
import {
  REPORT_SECTIONS,
  REPORT_APPENDICES,
} from "@/lib/report-section-config";
import { toast } from "@/components/ui/toast";
import {
  Zap,
  CheckCircle,
  Send,
  Download,
  RefreshCw,
  Sparkles,
  AlertCircle,
  Loader2,
  ChevronRight,
  FileText,
  PaperclipIcon,
  Upload,
  Eye,
  MoreHorizontal,
  FileDown,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Report, ReportSectionKey, Project } from "@/types";

const SECTION_TITLES: Record<string, string> = Object.fromEntries(
  REPORT_SECTIONS.map((s) => [s.key, s.title]),
);
const ORDERED_KEYS = REPORT_SECTIONS.map((s) => s.key) as ReportSectionKey[];

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
  const [activeSection, setActiveSection] = useState<ReportSectionKey | null>(
    null,
  );
  const [streamingSection, setStreaming] = useState<string | null>(null);
  const [streamingReport, setStreamReport] = useState<Report | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [showPaymentGate, setShowPaymentGate] = useState(false);
  const [showDocxImport, setShowDocxImport] = useState(false);
  const [exportingDocx, setExportingDocx] = useState(false);
  const [publishingExcerpt, setPublishingExcerpt] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sectionInstructions, setSectionInstructions] = useState<
    Record<string, string>
  >((project as any).section_instructions || {});
  const abortRef = useRef<AbortController | null>(null);
  const supabase = createClient();

  const currency = (project as any).currency || "USD";
  const displayReport = streamingReport ?? report;
  const reportPrice = (project as any).report_price;
  const isPublished = report?.status === "published";
  const excerptStatus = (report as any)?.excerpt_status ?? "none";
  const excerptPublished = excerptStatus === "published";

  const sectionKeys = ORDERED_KEYS.filter((k) => displayReport?.sections[k]);
  const generatedCount = sectionKeys.filter(
    (k) => !!displayReport?.sections[k]?.content,
  ).length;
  const progress =
    ORDERED_KEYS.length > 0
      ? Math.round((generatedCount / ORDERED_KEYS.length) * 100)
      : 0;

  useEffect(() => {
    fetch(`/api/report/instructions?projectId=${project.id}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.section_instructions)
          setSectionInstructions(data.section_instructions);
      })
      .catch(() => {});
  }, [project.id]);

  const handleInstructionSaved = useCallback(
    (sectionKey: string, instruction: string) => {
      setSectionInstructions((prev) => {
        const next = { ...prev };
        if (instruction) next[sectionKey] = instruction;
        else delete next[sectionKey];
        return next;
      });
    },
    [],
  );

  const prevReportRef = useRef<string | null>(null);
  if (displayReport && displayReport.project_id !== prevReportRef.current) {
    prevReportRef.current = displayReport.project_id;
    const first = ORDERED_KEYS.find((k) => displayReport.sections[k]?.content);
    if (first && !activeSection) setActiveSection(first);
  }

  // ── Word export ───────────────────────────────────────────────────────────
  async function handleExportWord() {
    if (!displayReport) return;
    setExportingDocx(true);
    try {
      // Dynamic import so the canvas-heavy export lib only loads when needed
      const { exportReportAsDocx } = await import("@/lib/report-docx-export");

      // Load format sections if available for correct ordering
      let formatSections = undefined;
      const formatId = (report as any)?.report_format_id;
      if (formatId) {
        const res = await fetch(`/api/report-formats/${formatId}`);
        if (res.ok) {
          const fmt = await res.json();
          formatSections = fmt.sections;
        }
      }

      await exportReportAsDocx(displayReport, project.title, formatSections);

      // Record export timestamp
      await supabase
        .from("reports")
        .update({ last_docx_exported_at: new Date().toISOString() })
        .eq("project_id", project.id);

      toast.success("Report downloaded as Word document");
    } catch (e: any) {
      toast.error(e.message || "Export failed");
    } finally {
      setExportingDocx(false);
    }
  }

  // ── Excerpt publish ───────────────────────────────────────────────────────
  async function handlePublishExcerpt() {
    setPublishingExcerpt(true);
    try {
      const res = await fetch("/api/report/publish-excerpt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: project.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to publish excerpt");

      onUpdateReport({ ...report!, excerpt_status: "published" } as any);
      toast.success(`Excerpt published — share this link: ${data.excerptUrl}`, {
        description: data.excerptUrl,
      });
    } catch (e: any) {
      toast.error(e.message || "Failed to publish excerpt");
    } finally {
      setPublishingExcerpt(false);
    }
  }

  // ── Streaming generation (unchanged from original) ────────────────────────
  async function generateStreaming(specificSection?: ReportSectionKey) {
    if (!hasSubmission) {
      toast.error("Please collect questionnaire data first.");
      return;
    }
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setIsStreaming(true);
    setStreaming(null);
    setStreamReport(report ? { ...report } : null);

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
        const e = await res.json();
        throw new Error(e.error || "Failed");
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
              if (event.type === "generating") {
                setStreaming(event.section);
                if (!activeSection) setActiveSection(event.section);
              }
              if (event.type === "section_complete") {
                setStreaming(null);
                setStreamReport((prev) => {
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
                setActiveSection((prev) => prev ?? event.section);
              }
              if (event.type === "complete") {
                const pRes = await fetch(`/api/projects/${project.id}`);
                const updated = await pRes.json();
                const final = updated.reports?.[0] ?? null;
                if (final) {
                  onUpdateReport(final);
                  setStreamReport(null);
                }
                onUpdateProject({ status: "report_draft" });
                setIsStreaming(false);
                setStreaming(null);
              }
            } catch {}
          }
        }
      } else {
        const pRes = await fetch(`/api/projects/${project.id}`);
        const upd = await pRes.json();
        if (upd.reports?.[0]) onUpdateReport(upd.reports[0]);
        onUpdateProject({ status: "report_draft" });
        setIsStreaming(false);
        setStreaming(null);
      }
    } catch (err: any) {
      if (err.name === "AbortError") return;
      toast.error(err.message || "Report generation failed");
      setIsStreaming(false);
      setStreaming(null);
      setStreamReport(null);
    }
  }

  // ── Publish helpers (unchanged) ───────────────────────────────────────────
  function handlePublishClick() {
    if (isPublished && reportPrice !== null && reportPrice !== undefined) {
      publishReport(null);
      return;
    }
    setShowPaymentGate(true);
  }

  async function handlePaymentConfirm(
    price: number,
    cur: string,
    chargeClient: boolean,
  ) {
    const res = await fetch(`/api/projects/${project.id}/report-price`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ price, currency: cur, chargeClient }),
    });
    if (!res.ok) throw new Error("Failed to set price");
    onUpdateProject({ report_price: price, currency: cur });
    setShowPaymentGate(false);
    await publishReport(price);
  }

  async function publishReport(_price: number | null) {
    setSaving(true);
    try {
      const res = await fetch("/api/report/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: project.id }),
      });
      if (!res.ok) throw new Error("Failed to publish");
      const data = await res.json();
      onUpdateReport({ ...report!, status: "published" });
      onUpdateProject({
        status: data.status || "report_published",
        payment_collected: data.payment_collected,
      } as any);
      if (data.warnings?.length) toast.error(data.warnings.join("\n"));
    } catch {
      toast.error("Failed to publish report.");
    } finally {
      setSaving(false);
    }
  }

  async function downloadPdf() {
    try {
      const res = await fetch(`/api/report/download?projectId=${project.id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      window.open(data.url, "_blank", "noopener,noreferrer");
    } catch {
      toast.error("Unable to download PDF right now.");
    }
  }

  // ── Empty state ───────────────────────────────────────────────────────────
  if (!displayReport && !isStreaming) {
    return (
      <div className="max-w-3xl mx-auto">
        <div className="rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-brand-900 p-8 mb-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 bg-brand-500/20 rounded-xl flex items-center justify-center">
              <Sparkles className="size-5 text-brand-400" />
            </div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-brand-400">
              AI Report Generator · {REPORT_SECTIONS.length} sections
            </p>
          </div>
          <h3 className="text-xl font-bold text-white mb-2">
            Generate feasibility report
          </h3>
          <p className="text-slate-300 text-sm mb-6 max-w-md">
            {hasSubmission
              ? "Sections appear in real-time as they complete."
              : "Collect the questionnaire first to enable report generation."}
          </p>
          <div className="flex items-center gap-3">
            <Button
              onClick={() => generateStreaming()}
              loading={isStreaming}
              disabled={!hasSubmission || isStreaming}
              className="bg-brand-600 hover:bg-brand-500 border-brand-500 text-white"
            >
              <Zap className="size-4" /> Generate Full Report
            </Button>
          </div>
        </div>
        <div className="space-y-1.5">
          {REPORT_SECTIONS.map((sec) => (
            <div
              key={sec.key}
              className="flex items-center gap-3 px-4 py-3 rounded-lg border border-border bg-card hover:border-brand-200 transition-colors group"
            >
              <div className="w-6 h-6 rounded-md bg-muted flex items-center justify-center flex-shrink-0">
                <FileText className="size-3.5 text-muted-foreground" />
              </div>
              <p className="text-xs font-medium text-foreground flex-1 truncate">
                {sec.title}
              </p>
              <Button
                size="sm"
                variant="ghost"
                className="opacity-0 group-hover:opacity-100 transition-opacity text-xs"
                onClick={() => generateStreaming(sec.key)}
                disabled={!hasSubmission || isStreaming}
              >
                Generate
              </Button>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Streaming progress ────────────────────────────────────────────────────
  if (isStreaming && !displayReport?.sections) {
    return (
      <div className="max-w-3xl mx-auto space-y-2">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-semibold text-foreground">
            Generating report…
          </p>
          <span className="text-xs text-muted-foreground">
            {generatedCount} / {REPORT_SECTIONS.length} sections
          </span>
        </div>
        <Progress value={progress} className="mb-4" />
        {REPORT_SECTIONS.map((sec) => {
          const isActive = streamingSection === sec.key;
          const isDone = !!streamingReport?.sections[sec.key]?.content;
          return (
            <div
              key={sec.key}
              className={`flex items-center gap-3 px-4 py-2.5 rounded-lg border transition-all ${isDone ? "border-brand-200 bg-brand-50/30" : isActive ? "border-brand-300 bg-brand-50/20 ring-1 ring-brand-200" : "border-border bg-card opacity-40"}`}
            >
              {isDone ? (
                <CheckCircle className="size-4 text-brand-600 flex-shrink-0" />
              ) : isActive ? (
                <Loader2 className="size-4 text-brand-500 animate-spin flex-shrink-0" />
              ) : (
                <div className="size-4 rounded-full border-2 border-border flex-shrink-0" />
              )}
              <span className="text-xs font-medium text-foreground flex-1">
                {sec.title}
              </span>
              {isActive && <Badge variant="green">Generating…</Badge>}
              {isDone && <Badge variant="green">Done</Badge>}
            </div>
          );
        })}
      </div>
    );
  }

  // ── Main report editor layout ─────────────────────────────────────────────
  return (
    <>
      {showPaymentGate && (
        <PaymentGateModal
          projectId={project.id}
          projectTitle={project.title}
          clientEmail={project.client_email}
          currency={currency}
          existingPrice={reportPrice ?? null}
          onConfirm={handlePaymentConfirm}
          onClose={() => setShowPaymentGate(false)}
        />
      )}

      {showDocxImport && (
        <DocxImportModal
          projectId={project.id}
          onClose={() => setShowDocxImport(false)}
          onApplied={async () => {
            setShowDocxImport(false);
            // Refresh report from DB
            const pRes = await fetch(`/api/projects/${project.id}`);
            const updated = await pRes.json();
            if (updated.reports?.[0]) onUpdateReport(updated.reports[0]);
            toast.success("Report updated from Word document");
          }}
        />
      )}

      <div className="flex gap-5 min-h-[calc(100vh-160px)]">
        {/* LEFT: Section sidebar */}
        <div className="w-64 flex-shrink-0 flex flex-col gap-3">
          {/* Publish status bar */}
          <ReportPublishBar
            report={displayReport!}
            project={project}
            totalSections={17}
            publishing={saving}
            onPublish={handlePublishClick}
          />

          {/* Word export / import / excerpt actions */}
          <div className="rounded-xl border border-border bg-card px-3 py-3 space-y-2">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">
              Document actions
            </p>

            {/* Export Word */}
            <Button
              size="sm"
              variant="outline"
              className="w-full justify-start"
              onClick={handleExportWord}
              loading={exportingDocx}
              disabled={!displayReport}
            >
              <FileDown className="size-3.5" />
              {exportingDocx ? "Exporting…" : "Export as Word (.doc)"}
            </Button>

            {/* Import Word */}
            <Button
              size="sm"
              variant="outline"
              className="w-full justify-start"
              onClick={() => setShowDocxImport(true)}
              disabled={!displayReport}
            >
              <Upload className="size-3.5" /> Import from Word
            </Button>

            {/* Excerpt */}
            <div>
              <Button
                size="sm"
                variant={excerptPublished ? "secondary" : "outline"}
                className="w-full justify-start"
                onClick={handlePublishExcerpt}
                loading={publishingExcerpt}
                disabled={!displayReport}
              >
                <Eye className="size-3.5" />
                {excerptPublished ? "Republish excerpt" : "Publish excerpt"}
              </Button>
              {excerptPublished && (
                <a
                  href={`/project/${project.id}/excerpt`}
                  target="_blank"
                  rel="noreferrer"
                  className="block text-[10px] text-brand-700 hover:underline mt-1 px-1"
                >
                  View excerpt →
                </a>
              )}
            </div>

            {/* Download PDF */}
            {isPublished && (
              <Button
                size="sm"
                variant="ghost"
                className="w-full justify-start text-muted-foreground"
                onClick={downloadPdf}
              >
                <Download className="size-3.5" /> Download PDF
              </Button>
            )}
          </div>

          {/* Section list */}
          <div className="rounded-xl border border-border bg-card overflow-hidden flex-1">
            <div className="px-4 py-3 border-b border-border">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                Sections
              </p>
            </div>
            <ScrollArea className="flex-1 min-h-0">
              <div className="p-1">
                {ORDERED_KEYS.map((key) => (
                  <ReportSidebarSection
                    key={key}
                    sectionKey={key}
                    title={SECTION_TITLES[key] || key}
                    section={displayReport?.sections[key]}
                    isActive={activeSection === key}
                    isStreaming={streamingSection === key}
                    hasInstruction={!!sectionInstructions?.[key]}
                    onClick={() => setActiveSection(key as ReportSectionKey)}
                  />
                ))}

                <div className="px-3 pt-3 pb-1">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                    <PaperclipIcon className="size-3" /> Appendices
                  </p>
                </div>
                {REPORT_APPENDICES.map((appendix) => {
                  const section =
                    displayReport?.sections[appendix.key as ReportSectionKey];
                  const hasContent =
                    !!section?.content && !(section as any).is_placeholder;
                  return (
                    <button
                      key={appendix.key}
                      onClick={() =>
                        setActiveSection(appendix.key as ReportSectionKey)
                      }
                      className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-left transition-colors mb-0.5 ${
                        activeSection === appendix.key
                          ? "bg-brand-50 text-brand-800"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      }`}
                    >
                      <div
                        className={`size-2 rounded-full flex-shrink-0 ${hasContent ? "bg-brand-500" : appendix.autoPopulated ? "bg-blue-400" : "bg-amber-400"}`}
                      />
                      <span className="text-[10px] truncate leading-snug">
                        {appendix.title}
                      </span>
                    </button>
                  );
                })}
              </div>
            </ScrollArea>
          </div>
        </div>

        {/* RIGHT: Section editor */}
        <div className="flex-1 min-w-0">
          {activeSection && displayReport ? (
            <ReportEditor
              report={displayReport}
              project={project}
              projectId={project.id}
              onUpdate={onUpdateReport}
              onProjectUpdate={onUpdateProject}
              streamingSection={streamingSection}
              activeSection={activeSection}
              onSectionChange={setActiveSection}
              sectionInstructions={sectionInstructions}
              onInstructionSaved={handleInstructionSaved}
            />
          ) : (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <FileText className="size-10 text-muted-foreground/20 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">
                  Select a section from the sidebar
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
