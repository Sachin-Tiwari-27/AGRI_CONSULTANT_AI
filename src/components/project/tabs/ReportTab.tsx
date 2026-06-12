"use client";

// Changes:
//   1. Sidebar sections now grouped by phase (Foundation / Analysis / Business / Risk / Appendices)
//   2. Format-aware section list — loads from report.format_snapshot if available
//   3. Wider sidebar (280px instead of 256px)
//   4. "Generate all" vs "Regenerate all" split in a cleaner header action bar
//   5. Section list header shows generated/total count
//   6. Streaming progress is now inline in sidebar (no full-page overlay)
//   7. Empty state is a compact card, not a full-page hero

import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
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
import { cn } from "@/lib/utils";
import {
  Zap,
  CheckCircle,
  FileText,
  PaperclipIcon,
  Upload,
  Eye,
  FileDown,
  RefreshCw,
  Sparkles,
  Loader2,
  MoreHorizontal,
  ChevronDown,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Report, ReportSectionKey, Project } from "@/types";
import type { ReportFormatSection } from "@/types/report-format";

// ── Phase group definitions ───────────────────────────────────────────────────
const PHASE_GROUPS = [
  { label: "Foundation", phases: [1] },
  { label: "Analysis", phases: [2] },
  { label: "Business", phases: [3] },
  { label: "Risk & Impact", phases: [4, 5] },
  { label: "Synthesis", phases: [6] },
] as const;

// ── Helpers ───────────────────────────────────────────────────────────────────

function getSectionsByPhaseGroup(
  formatSections: Array<{
    key: string;
    title: string;
    generation_phase?: number;
  }>,
) {
  const groups = PHASE_GROUPS.map((g) => ({
    label: g.label,
    sections: formatSections.filter((s) =>
      (g.phases as readonly number[]).includes(s.generation_phase ?? 3),
    ),
  }));
  return groups.filter((g) => g.sections.length > 0);
}

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
  // Format sections — from report snapshot or fallback to default config
  const [formatSections, setFormatSections] =
    useState<Array<{ key: string; title: string; generation_phase?: number }>>(
      REPORT_SECTIONS,
    );

  const abortRef = useRef<AbortController | null>(null);
  const supabase = createClient();

  const currency = (project as any).currency || "USD";
  const displayReport = streamingReport ?? report;
  const reportPrice = (project as any).report_price;
  const isPublished = report?.status === "published";
  const excerptPublished = (report as any)?.excerpt_status === "published";

  // Load format sections from report snapshot or project format
  useEffect(() => {
    const snapshot = (report as any)?.format_snapshot;
    if (snapshot?.length) {
      setFormatSections(snapshot);
      return;
    }
    const formatId = (project as any)?.report_format_id;
    if (formatId) {
      fetch(`/api/report-formats/${formatId}`)
        .then((r) => r.json())
        .then((fmt) => {
          if (fmt.sections?.length) setFormatSections(fmt.sections);
        })
        .catch(() => {});
    }
  }, [report, project]);

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

  // Auto-select first section with content
  const prevReportRef = useRef<string | null>(null);
  if (displayReport && displayReport.project_id !== prevReportRef.current) {
    prevReportRef.current = displayReport.project_id;
    const first = formatSections.find(
      (s) => displayReport.sections[s.key as ReportSectionKey]?.content,
    );
    if (first && !activeSection)
      setActiveSection(first.key as ReportSectionKey);
  }

  // Stats
  const generatedCount = formatSections.filter(
    (s) => !!displayReport?.sections[s.key as ReportSectionKey]?.content,
  ).length;
  const totalSections = formatSections.length;

  // ── Word export ───────────────────────────────────────────────────────────
  async function handleExportWord() {
    if (!displayReport) return;
    setExportingDocx(true);
    try {
      const { exportReportAsDocx } = await import("@/lib/report-docx-export");
      const snapshot = (report as any)?.format_snapshot;
      await exportReportAsDocx(
        displayReport,
        project.title,
        snapshot ?? undefined,
      );
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
      toast.success(`Excerpt published`, { description: data.excerptUrl });
    } catch (e: any) {
      toast.error(e.message || "Failed to publish excerpt");
    } finally {
      setPublishingExcerpt(false);
    }
  }

  // ── Streaming generation ──────────────────────────────────────────────────
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
                if (!activeSection)
                  setActiveSection(event.section as ReportSectionKey);
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
                setActiveSection(
                  (prev) => prev ?? (event.section as ReportSectionKey),
                );
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

  // ── Publish helpers ───────────────────────────────────────────────────────
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

  // ── Phase group rendering ─────────────────────────────────────────────────
  const phaseGroups = getSectionsByPhaseGroup(formatSections);

  // ── Empty state ───────────────────────────────────────────────────────────
  if (!displayReport && !isStreaming) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="rounded-xl border border-border bg-card p-6 mb-4">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 bg-brand-50 rounded-xl flex items-center justify-center flex-shrink-0">
              <Sparkles className="size-5 text-brand-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-foreground mb-0.5">
                Generate feasibility report
              </p>
              <p className="text-xs text-muted-foreground mb-4">
                {hasSubmission
                  ? `${totalSections} sections · sections appear as they complete`
                  : "Collect the questionnaire first to enable generation"}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={() => generateStreaming()}
                  loading={isStreaming}
                  disabled={!hasSubmission || isStreaming}
                >
                  <Zap className="size-3.5" /> Generate full report
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Section list preview */}
        <div className="space-y-px">
          {phaseGroups.map((group) => (
            <div key={group.label}>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide px-3 py-1.5">
                {group.label}
              </p>
              {group.sections.map((sec) => (
                <div
                  key={sec.key}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-muted/50 transition-colors group"
                >
                  <div className="size-3 rounded-full border-2 border-border flex-shrink-0" />
                  <p className="text-xs text-muted-foreground flex-1 truncate">
                    {sec.title}
                  </p>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="opacity-0 group-hover:opacity-100 text-[11px] h-6 px-2"
                    onClick={() =>
                      generateStreaming(sec.key as ReportSectionKey)
                    }
                    disabled={!hasSubmission || isStreaming}
                  >
                    Generate
                  </Button>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Main layout ───────────────────────────────────────────────────────────
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
            const pRes = await fetch(`/api/projects/${project.id}`);
            const updated = await pRes.json();
            if (updated.reports?.[0]) onUpdateReport(updated.reports[0]);
          }}
        />
      )}

      <div className="flex gap-5 min-h-[calc(100vh-160px)]">
        {/* ── LEFT SIDEBAR (280px) ───────────────────────────────────────── */}
        <div
          className="w-70 flex-shrink-0 flex flex-col gap-2.5"
          style={{ width: 280 }}
        >
          {/* Publish bar */}
          {displayReport && (
            <ReportPublishBar
              report={displayReport}
              project={project}
              totalSections={totalSections}
              publishing={saving}
              onPublish={handlePublishClick}
            />
          )}

          {/* Document actions */}
          <div className="rounded-xl border border-border bg-card px-4 py-3.5 space-y-2">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
              Actions
            </p>

            <Button
              size="sm"
              variant="outline"
              className="w-full justify-start h-10 text-sm font-medium rounded-lg shadow-sm bg-white"
              onClick={handleExportWord}
              loading={exportingDocx}
              disabled={!displayReport}
            >
              <FileDown className="size-4 text-foreground/80" />
              {exportingDocx ? "Exporting…" : "Export Word (.doc)"}
            </Button>

            <Button
              size="sm"
              variant="outline"
              className="w-full justify-start h-10 text-sm font-medium rounded-lg shadow-sm bg-white"
              onClick={() => setShowDocxImport(true)}
              disabled={!displayReport}
            >
              <Upload className="size-4 text-foreground/80" /> Import from Word
            </Button>

            <Button
              size="sm"
              variant="outline"
              className={`w-full justify-start h-10 text-sm font-medium rounded-lg shadow-sm ${
                excerptPublished
                  ? "bg-emerald-50 hover:bg-emerald-100/80 text-emerald-700 border-emerald-200"
                  : "bg-white"
              }`}
              onClick={handlePublishExcerpt}
              loading={publishingExcerpt}
              disabled={!displayReport}
            >
              <Eye
                className={cn(
                  "size-4",
                  excerptPublished ? "text-emerald-700" : "text-foreground/80",
                )}
              />
              {excerptPublished ? "Republish excerpt" : "Publish excerpt"}
            </Button>

            {excerptPublished && (
              <a
                href={`/project/${project.id}/excerpt`}
                target="_blank"
                rel="noreferrer"
                className="block text-xs font-semibold text-emerald-600 hover:text-emerald-700 hover:underline px-1 mt-1"
              >
                View excerpt →
              </a>
            )}
          </div>

          {/* Section list — grouped by phase */}
          <div className="rounded-xl border border-border bg-card overflow-hidden flex-1 flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2.5 border-b border-border flex-shrink-0">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                Sections
              </p>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground tabular-nums">
                  {generatedCount}/{totalSections}
                </span>
                {/* Generate/Regenerate all dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="icon-sm" variant="ghost" className="h-5 w-5">
                      <MoreHorizontal className="size-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem
                      onClick={() => generateStreaming()}
                      disabled={!hasSubmission || isStreaming}
                    >
                      <Zap className="size-3.5" />
                      {generatedCount > 0 ? "Regenerate all" : "Generate all"}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => {
                        const unapproved = formatSections
                          .filter((s) => {
                            const sec =
                              displayReport?.sections[
                                s.key as ReportSectionKey
                              ];
                            return sec?.content && !sec.approved;
                          })
                          .map((s) => s.key as ReportSectionKey);
                        if (unapproved.length)
                          toast.info(
                            `${unapproved.length} sections need review`,
                          );
                        else toast.success("All sections approved");
                      }}
                    >
                      <CheckCircle className="size-3.5" /> Check unapproved
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            <ScrollArea className="flex-1">
              <div className="px-1 py-1">
                {phaseGroups.map((group) => {
                  const groupGenerated = group.sections.filter(
                    (s) =>
                      !!displayReport?.sections[s.key as ReportSectionKey]
                        ?.content,
                  ).length;

                  return (
                    <div key={group.label} className="mb-1">
                      {/* Group label */}
                      <div className="flex items-center justify-between px-2 py-1">
                        <p className="text-[9px] font-semibold text-muted-foreground/70 uppercase tracking-widest">
                          {group.label}
                        </p>
                        <span className="text-[9px] text-muted-foreground/50 tabular-nums">
                          {groupGenerated}/{group.sections.length}
                        </span>
                      </div>

                      {/* Sections in group */}
                      {group.sections.map((sec) => {
                        const isCurrentlyStreaming =
                          streamingSection === sec.key;
                        const sectionData = isCurrentlyStreaming
                          ? streamingReport?.sections[
                              sec.key as ReportSectionKey
                            ]
                          : displayReport?.sections[
                              sec.key as ReportSectionKey
                            ];

                        return (
                          <ReportSidebarSection
                            key={sec.key}
                            sectionKey={sec.key as ReportSectionKey}
                            title={sec.title}
                            section={sectionData}
                            isActive={activeSection === sec.key}
                            isStreaming={isCurrentlyStreaming}
                            hasInstruction={!!sectionInstructions?.[sec.key]}
                            onClick={() =>
                              setActiveSection(sec.key as ReportSectionKey)
                            }
                          />
                        );
                      })}
                    </div>
                  );
                })}

                {/* Appendices */}
                <div className="mb-1">
                  <div className="flex items-center justify-between px-2 py-1">
                    <p className="text-[9px] font-semibold text-muted-foreground/70 uppercase tracking-widest flex items-center gap-1">
                      <PaperclipIcon className="size-2.5" /> Appendices
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
                        className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left transition-colors mb-px border-l-2 ${
                          activeSection === appendix.key
                            ? "bg-brand-50 border-l-brand-400"
                            : "hover:bg-muted/50 border-l-transparent"
                        }`}
                      >
                        <div
                          className={`size-1.5 rounded-full flex-shrink-0 ${
                            hasContent
                              ? "bg-brand-400"
                              : appendix.autoPopulated
                                ? "bg-blue-300"
                                : "bg-amber-300"
                          }`}
                        />
                        <span
                          className={`text-[10px] truncate leading-snug ${
                            activeSection === appendix.key
                              ? "text-brand-700 font-medium"
                              : "text-muted-foreground"
                          }`}
                        >
                          {appendix.title}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </ScrollArea>
          </div>
        </div>

        {/* ── RIGHT: Editor ─────────────────────────────────────────────── */}
        <div className="flex-1 min-w-0">
          {/* Streaming indicator — inline at top of editor, not full-page overlay */}
          {isStreaming && (
            <div className="flex items-center gap-2.5 px-4 py-2.5 mb-3 rounded-xl border border-brand-200 bg-brand-50/50">
              <Loader2 className="size-3.5 text-brand-600 animate-spin flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-brand-800">
                  {streamingSection
                    ? `Generating: ${formatSections.find((s) => s.key === streamingSection)?.title ?? streamingSection}`
                    : "Preparing generation…"}
                </p>
                <p className="text-[10px] text-brand-600 mt-0.5">
                  {generatedCount} of {totalSections} sections complete —
                  sections appear in sidebar as they finish
                </p>
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="text-brand-600 hover:bg-brand-100 flex-shrink-0 h-7 text-xs"
                onClick={() => {
                  abortRef.current?.abort();
                  setIsStreaming(false);
                  setStreaming(null);
                }}
              >
                Cancel
              </Button>
            </div>
          )}

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
            <div className="h-full flex items-center justify-center rounded-xl border border-dashed border-border bg-muted/10">
              <div className="text-center">
                <FileText className="size-8 text-muted-foreground/20 mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">
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
