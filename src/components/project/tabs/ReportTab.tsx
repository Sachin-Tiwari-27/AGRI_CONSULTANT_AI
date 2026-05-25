"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { MarkdownRenderer } from "@/components/ui/markdown-renderer";
import { ReportEditor } from "@/components/report/ReportEditor";
import { PaymentGateModal } from "@/components/report/PaymentGateModal";
import { ReportPublishBar } from "@/components/report/ReportPublishBar";
import { ReportSidebarSection } from "@/components/report/ReportSidebarSection";
import { createClient } from "@/lib/supabase/client";
import {
  REPORT_SECTIONS,
  REPORT_APPENDICES,
} from "@/lib/report-section-config";
import { formatCurrency } from "@/lib/utils";
import {
  Zap,
  CheckCircle,
  Lock,
  Send,
  Download,
  RefreshCw,
  Sparkles,
  AlertCircle,
  Loader2,
  ChevronRight,
  FileText,
  PaperclipIcon,
  Eye,
} from "lucide-react";
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
  const [markingPaid, setMarkingPaid] = useState(false);
  const [markPaidNote, setMarkPaidNote] = useState("");
  const [showMarkPaid, setShowMarkPaid] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sectionInstructions, setSectionInstructions] = useState<Record<string, string>>(
    (project as any).section_instructions || {},
  );
  const abortRef = useRef<AbortController | null>(null);

  const currency = (project as any).currency || "USD";
  const fm = report?.financial_model;
  const displayReport = streamingReport ?? report;
  const reportPrice = (project as any).report_price;
  const paymentCollected = (project as any).payment_collected;
  const isPublished = report?.status === "published";
  const isCompleted = project.status === "completed";

  const sectionKeys = ORDERED_KEYS.filter((k) => displayReport?.sections[k]);
  const generatedCount = sectionKeys.filter(
    (k) => !!displayReport?.sections[k]?.content,
  ).length;
  const approvedCount = sectionKeys.filter(
    (k) => displayReport?.sections[k]?.approved,
  ).length;
  const allApproved =
    sectionKeys.length > 0 &&
    sectionKeys.every((k) => displayReport?.sections[k]?.approved);
  const progress =
    ORDERED_KEYS.length > 0
      ? Math.round((generatedCount / ORDERED_KEYS.length) * 100)
      : 0;

  const previewUrl = `/project/${project.id}/report`;

  // Fetch and sync section instructions
  useEffect(() => {
    fetch(`/api/report/instructions?projectId=${project.id}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.section_instructions) {
          setSectionInstructions(data.section_instructions);
        }
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

  /* ── Auto-select first section when report loads ─────────────── */
  const prevReportRef = useRef<string | null>(null);
  if (displayReport && displayReport.project_id !== prevReportRef.current) {
    prevReportRef.current = displayReport.project_id;
    const first = ORDERED_KEYS.find((k) => displayReport.sections[k]?.content);
    if (first && !activeSection) setActiveSection(first);
  }

  /* ── Streaming generation ────────────────────────────────────── */
  async function generateStreaming(specificSection?: ReportSectionKey) {
    if (!hasSubmission) {
      alert("Please collect questionnaire data first.");
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
                // Auto-advance to first generated section
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
      alert(err.message || "Report generation failed");
      setIsStreaming(false);
      setStreaming(null);
      setStreamReport(null);
    }
  }

  /* ── Publish helpers ─────────────────────────────────────────── */
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
      if (data.warnings?.length) alert(data.warnings.join("\n"));
    } catch {
      alert("Failed to publish report.");
    } finally {
      setSaving(false);
    }
  }

  async function handleMarkPaid() {
    setMarkingPaid(true);
    try {
      const res = await fetch(`/api/projects/${project.id}/mark-paid`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: markPaidNote }),
      });
      if (!res.ok) throw new Error("Failed");
      onUpdateProject({ status: "completed", payment_collected: true } as any);
      setShowMarkPaid(false);
      setMarkPaidNote("");
    } catch {
      alert("Failed to mark as paid.");
    } finally {
      setMarkingPaid(false);
    }
  }

  async function downloadPdf() {
    setDownloading(true);
    try {
      const res = await fetch(`/api/report/download?projectId=${project.id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      window.open(data.url, "_blank", "noopener,noreferrer");
    } catch {
      alert("Unable to download PDF right now.");
    } finally {
      setDownloading(false);
    }
  }

  async function resendNotification() {
    setSaving(true);
    try {
      await fetch("/api/report/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: project.id }),
      });
      alert("Notification email resent to client.");
    } catch {
      alert("Failed to resend email.");
    } finally {
      setSaving(false);
    }
  }

  /* ── Empty state — no report yet ────────────────────────────── */
  if (!displayReport && !isStreaming) {
    return (
      <div className="max-w-3xl mx-auto">
        {/* Hero generate card */}
        <div className="rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-brand-900 p-8 mb-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 bg-brand-500/20 rounded-xl flex items-center justify-center">
              <Sparkles className="size-5 text-brand-400" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-brand-400">
                AI Report Generator · {REPORT_SECTIONS.length} sections
              </p>
            </div>
          </div>
          <h3 className="text-xl font-bold text-white mb-2">
            Generate feasibility report
          </h3>
          <p className="text-slate-300 text-sm mb-6 max-w-md">
            {hasSubmission
              ? "Sections appear in real-time as they complete. Review, edit, and approve before publishing."
              : "Collect the questionnaire first to enable report generation."}
          </p>
          <Button
            onClick={() => generateStreaming()}
            loading={isStreaming}
            disabled={!hasSubmission || isStreaming}
            className="bg-brand-600 hover:bg-brand-500 border-brand-500 text-white"
          >
            <Zap className="size-4" />
            Generate Full Report
          </Button>
        </div>

        {/* Section preview grid */}
        <div className="space-y-1.5">
          {REPORT_SECTIONS.map((sec) => (
            <div
              key={sec.key}
              className="flex items-center gap-3 px-4 py-3 rounded-lg border border-border bg-card hover:border-brand-200 hover:bg-brand-50/30 transition-colors group"
            >
              <div className="w-6 h-6 rounded-md bg-muted flex items-center justify-center flex-shrink-0">
                <FileText className="size-3.5 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-foreground truncate">
                  {sec.title}
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                {sec.hasPlaceholders && (
                  <Badge variant="amber" className="text-[9px]">
                    Placeholders
                  </Badge>
                )}
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
            </div>
          ))}
        </div>
      </div>
    );
  }

  /* ── Streaming progress overlay (no report yet) ──────────────── */
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
              className={`flex items-center gap-3 px-4 py-2.5 rounded-lg border transition-all ${
                isDone
                  ? "border-brand-200 bg-brand-50/30"
                  : isActive
                    ? "border-brand-300 bg-brand-50/20 ring-1 ring-brand-200"
                    : "border-border bg-card opacity-40"
              }`}
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

  /* ── Main split-pane layout ─────────────────────────────────── */
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

      <div className="flex gap-5 min-h-[calc(100vh-160px)]">
        {/* ── LEFT: Section sidebar ─────────────────────────────── */}
        <div className="w-64 flex-shrink-0 flex flex-col gap-3">
          {/* Publish status bar */}
          <ReportPublishBar
            report={displayReport}
            project={project}
            totalSections={17}
            publishing={saving}
            onPublish={handlePublishClick}
          />

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
                    hasInstruction={!!(sectionInstructions?.[key])}
                    onClick={() => setActiveSection(key as ReportSectionKey)}
                  />
                ))}

                {/* Appendices divider */}
                <div className="px-3 pt-3 pb-1">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                    <PaperclipIcon className="size-3" /> Appendices
                  </p>
                </div>
                {REPORT_APPENDICES.map((appendix) => {
                  const section = displayReport?.sections[appendix.key];
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
                        className={`size-2 rounded-full flex-shrink-0 ${
                          hasContent
                            ? "bg-brand-500"
                            : appendix.autoPopulated
                              ? "bg-blue-400"
                              : "bg-amber-400"
                        }`}
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

        {/* ── RIGHT: Section content ───────────────────────────── */}
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
