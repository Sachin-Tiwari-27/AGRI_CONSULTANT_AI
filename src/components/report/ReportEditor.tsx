"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { MarkdownRenderer } from "@/components/ui/MarkdownRenderer";
import { RichEditor } from "@/components/report/RichEditor";
import { PaymentGateModal } from "@/components/report/PaymentGateModal";
import { createClient } from "@/lib/supabase/client";
import { REPORT_SECTIONS } from "@/lib/report-section-config";
import {
  CheckCircle,
  Edit3,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Lock,
  Send,
  Download,
  DollarSign,
  Unlock,
  AlertCircle,
  CreditCard,
  CheckCircle2,
  Loader2,
  Eye,
  EyeOff,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import type { Report, ReportSectionKey, Project } from "@/types";

// Derived from the single source of truth — covers all 17 report sections.
// Adding or reordering sections in report-section-config.ts automatically
// updates the editor, approval progress, and streaming counter.
const SECTION_TITLES: Record<string, string> = Object.fromEntries(
  REPORT_SECTIONS.map((s) => [s.key, s.title]),
);

const ORDERED_SECTION_KEYS = REPORT_SECTIONS.map(
  (s) => s.key,
) as ReportSectionKey[];

interface Props {
  report: Report;
  project: Project;
  projectId: string;
  onUpdate: (report: Report) => void;
  onProjectUpdate: (patch: Partial<Project>) => void;
  streamingSection?: string | null;
}

export function ReportEditor({
  report,
  project,
  projectId,
  onUpdate,
  onProjectUpdate,
  streamingSection = null,
}: Props) {
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [editingSection, setEditingSection] = useState<string | null>(null);
  // editContent is now tracked in a ref to avoid re-renders on every keystroke in RichEditor
  const editContentRef = useRef<string>("");
  const [regenerating, setRegenerating] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [showPaymentGate, setShowPaymentGate] = useState(false);
  const [markingPaid, setMarkingPaid] = useState(false);
  const [markPaidNote, setMarkPaidNote] = useState("");
  const [showMarkPaid, setShowMarkPaid] = useState(false);
  const [previewMode, setPreviewMode] = useState<Record<string, boolean>>({});

  const prevReportIdRef = useRef<string | null>(null);

  // Auto-expand first section when report loads
  useEffect(() => {
    const reportKey = report.id || report.project_id;
    if (reportKey !== prevReportIdRef.current) {
      prevReportIdRef.current = reportKey;
      const firstKey = ORDERED_SECTION_KEYS.find(
        (k) => report.sections[k]?.content,
      );
      if (firstKey) setExpandedSection(firstKey);
    }
  }, [report.id, report.project_id, report.sections]);

  const toggleSection = useCallback((key: string) => {
    setExpandedSection((prev) => (prev === key ? null : key));
  }, []);

  const supabase = createClient();
  const sectionKeys = ORDERED_SECTION_KEYS.filter(
    (k) => report.sections[k as ReportSectionKey],
  );
  const allApproved = sectionKeys.every(
    (k) => report.sections[k as ReportSectionKey]?.approved,
  );

  const currency = (project as any).currency || "USD";
  const reportPrice = (project as any).report_price;
  const paymentCollected = (project as any).payment_collected;
  const isCompleted = project.status === "completed";
  const isPublished = report.status === "published";

  // ── Save section ─────────────────────────────────────────────────────
  async function saveSection(key: string) {
    setSaving(true);
    const updated = {
      ...report.sections,
      [key]: {
        ...report.sections[key as ReportSectionKey],
        content: editContentRef.current,
        ai_generated: false,
        last_edited_at: new Date().toISOString(),
      },
    };
    await supabase
      .from("reports")
      .update({ sections: updated })
      .eq("project_id", projectId);
    onUpdate({ ...report, sections: updated as typeof report.sections });
    setEditingSection(null);
    setExpandedSection(key); // keep section open after save
    setSaving(false);
  }

  async function approveSection(key: string) {
    const updated = {
      ...report.sections,
      [key]: { ...report.sections[key as ReportSectionKey], approved: true },
    };
    await supabase
      .from("reports")
      .update({ sections: updated })
      .eq("project_id", projectId);
    onUpdate({ ...report, sections: updated as typeof report.sections });
  }

  async function regenerateSection(key: string) {
    setRegenerating(key);
    try {
      await fetch("/api/report/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, sectionsToGenerate: [key] }),
      });
      const { data } = await supabase
        .from("reports")
        .select("*")
        .eq("project_id", projectId)
        .single();
      if (data) {
        onUpdate(data as Report);
        setExpandedSection(key);
      }
    } finally {
      setRegenerating(null);
    }
  }

  // ── Publish helpers ───────────────────────────────────────────────────
  function handlePublishClick() {
    if (isPublished && reportPrice !== null && reportPrice !== undefined) {
      publishReport(null);
      return;
    }
    setShowPaymentGate(true);
  }

  async function handlePaymentGateConfirm(
    price: number,
    cur: string,
    chargeClient: boolean,
  ) {
    const priceRes = await fetch(`/api/projects/${projectId}/report-price`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ price, currency: cur, chargeClient }),
    });
    if (!priceRes.ok) throw new Error("Failed to set price");
    onProjectUpdate({ report_price: price, currency: cur });
    setShowPaymentGate(false);
    await publishReport(price);
  }

  async function publishReport(_price: number | null) {
    setSaving(true);
    try {
      const res = await fetch("/api/report/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });
      if (!res.ok) throw new Error("Failed to publish");
      const data = await res.json();
      onUpdate({ ...report, status: "published" });
      onProjectUpdate({
        status: data.status || "report_published",
        payment_collected: data.payment_collected,
      } as any);
      if (data.warnings?.length > 0) alert(data.warnings.join("\n"));
    } catch {
      alert("Failed to publish report.");
    } finally {
      setSaving(false);
    }
  }

  async function handleMarkPaid() {
    setMarkingPaid(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/mark-paid`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: markPaidNote }),
      });
      if (!res.ok) throw new Error("Failed");
      onProjectUpdate({ status: "completed", payment_collected: true } as any);
      setShowMarkPaid(false);
      setMarkPaidNote("");
    } catch {
      alert("Failed to mark as paid.");
    } finally {
      setMarkingPaid(false);
    }
  }

  async function resendNotification() {
    setSaving(true);
    try {
      await fetch("/api/report/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });
      alert("Notification email resent to client.");
    } catch {
      alert("Failed to resend email.");
    } finally {
      setSaving(false);
    }
  }

  async function downloadPdf() {
    setDownloading(true);
    try {
      const res = await fetch(`/api/report/download?projectId=${projectId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to get PDF");
      window.open(data.url, "_blank", "noopener,noreferrer");
    } catch {
      alert("Unable to download PDF right now.");
    } finally {
      setDownloading(false);
    }
  }

  const completedCount = sectionKeys.filter(
    (k) => !!report.sections[k as ReportSectionKey]?.content,
  ).length;

  return (
    <>
      {showPaymentGate && (
        <PaymentGateModal
          projectId={projectId}
          projectTitle={project.title}
          clientEmail={project.client_email}
          currency={currency}
          existingPrice={reportPrice ?? null}
          onConfirm={handlePaymentGateConfirm}
          onClose={() => setShowPaymentGate(false)}
        />
      )}

      <div className="space-y-3">
        {/* Streaming progress */}
        {streamingSection && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-5 py-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 text-emerald-600 animate-spin" />
                <p className="text-sm font-medium text-emerald-800">
                  Generating:{" "}
                  <span className="font-bold">
                    {SECTION_TITLES[streamingSection] ?? streamingSection}
                  </span>
                </p>
              </div>
              <span className="text-xs text-emerald-600 font-medium">
                {completedCount} / {ORDERED_SECTION_KEYS.length} sections
              </span>
            </div>
            <div className="h-1.5 bg-emerald-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                style={{
                  width: `${Math.round((completedCount / ORDERED_SECTION_KEYS.length) * 100)}%`,
                }}
              />
            </div>
          </div>
        )}

        {/* Publish bar */}
        <Card>
          <CardBody className="py-3">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-medium text-slate-900">
                    {isPublished
                      ? "Report published"
                      : "Review all sections before publishing"}
                  </p>
                  {reportPrice !== null && reportPrice !== undefined && (
                    <span
                      className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${
                        reportPrice === 0
                          ? "bg-blue-50 text-blue-700 border-blue-200"
                          : "bg-green-50 text-green-700 border-green-200"
                      }`}
                    >
                      {reportPrice === 0 ? (
                        <>
                          <Unlock className="w-3 h-3" /> Free
                        </>
                      ) : (
                        <>
                          <DollarSign className="w-3 h-3" />{" "}
                          {formatCurrency(reportPrice, currency)}
                        </>
                      )}
                    </span>
                  )}
                  {paymentCollected && (
                    <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <CheckCircle2 className="w-3 h-3" /> Paid
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  {
                    sectionKeys.filter(
                      (k) => report.sections[k as ReportSectionKey]?.approved,
                    ).length
                  }{" "}
                  of {sectionKeys.length} sections approved
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0 flex-wrap justify-end">
                {isPublished ? (
                  <>
                    {reportPrice > 0 && !isCompleted && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setShowMarkPaid((s) => !s)}
                      >
                        <CreditCard className="w-3.5 h-3.5" /> Mark as paid
                      </Button>
                    )}
                    <div className="flex items-center gap-2 text-sm text-green-700 font-medium">
                      <Lock className="w-4 h-4" /> Published
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={resendNotification}
                      loading={saving}
                    >
                      <Send className="w-3.5 h-3.5" /> Resend
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={downloadPdf}
                      loading={downloading}
                    >
                      <Download className="w-3.5 h-3.5" /> PDF
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={handlePublishClick}
                      loading={saving}
                    >
                      <RefreshCw className="w-3.5 h-3.5" /> Republish
                    </Button>
                  </>
                ) : (
                  <Button
                    onClick={handlePublishClick}
                    disabled={!allApproved}
                    loading={saving}
                    size="sm"
                  >
                    <Lock className="w-3.5 h-3.5" /> Publish report
                  </Button>
                )}
              </div>
            </div>

            {showMarkPaid && (
              <div className="mt-4 pt-4 border-t border-slate-100 flex items-end gap-3 flex-wrap">
                <div className="flex-1 min-w-[200px]">
                  <label className="text-xs font-medium text-slate-600 block mb-1.5">
                    Collection note (optional)
                  </label>
                  <input
                    type="text"
                    value={markPaidNote}
                    onChange={(e) => setMarkPaidNote(e.target.value)}
                    placeholder="e.g. Bank transfer received"
                    className="w-full text-sm px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
                <Button
                  size="sm"
                  onClick={handleMarkPaid}
                  loading={markingPaid}
                  className="flex-shrink-0"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" /> Confirm
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowMarkPaid(false)}
                  className="flex-shrink-0"
                >
                  Cancel
                </Button>
              </div>
            )}

            {!allApproved && !isPublished && (
              <div className="mt-3 flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                Approve all sections before publishing.
              </div>
            )}
          </CardBody>
        </Card>

        {/* Section cards */}
        {ORDERED_SECTION_KEYS.map((key) => {
          const section = report.sections[key as ReportSectionKey];
          const isStreaming = streamingSection === key;
          const isExpanded = expandedSection === key;
          const isEditing = editingSection === key;
          const hasContent = !!section?.content;
          const isPreviewing = previewMode[key] ?? false;

          return (
            <Card
              key={key}
              className={
                isStreaming ? "border-emerald-300 ring-1 ring-emerald-200" : ""
              }
            >
              <CardHeader className="py-3">
                <button
                  className="flex items-center justify-between w-full text-left"
                  onClick={() => hasContent && !isEditing && toggleSection(key)}
                  disabled={!hasContent || isEditing}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {section?.approved ? (
                      <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                    ) : isStreaming ? (
                      <Loader2 className="w-4 h-4 text-emerald-500 animate-spin flex-shrink-0" />
                    ) : (
                      <div className="w-4 h-4 rounded-full border-2 border-slate-300 flex-shrink-0" />
                    )}
                    <span className="font-medium text-sm text-slate-900 truncate">
                      {SECTION_TITLES[key] ?? key}
                    </span>
                    {section?.ai_generated && !isStreaming && (
                      <span className="flex items-center gap-1 text-xs text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full flex-shrink-0">
                        <Sparkles className="w-3 h-3" /> AI draft
                      </span>
                    )}
                    {isStreaming && (
                      <span className="flex items-center gap-1 text-xs text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full flex-shrink-0">
                        Generating…
                      </span>
                    )}
                    {!hasContent && !isStreaming && (
                      <span className="text-xs text-slate-400 flex-shrink-0">
                        Not generated
                      </span>
                    )}
                  </div>
                  {hasContent &&
                    !isEditing &&
                    (isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    ))}
                </button>
              </CardHeader>

              {isExpanded && hasContent && (
                <CardBody>
                  {isEditing ? (
                    <div className="space-y-3">
                      {/* Toggle between rich edit and markdown preview */}
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-medium text-slate-600">
                          Editing:
                        </span>
                        <button
                          onClick={() =>
                            setPreviewMode((p) => ({
                              ...p,
                              [key]: !isPreviewing,
                            }))
                          }
                          className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 px-2 py-1 rounded border border-slate-200 hover:bg-slate-50 transition-colors"
                        >
                          {isPreviewing ? (
                            <>
                              <Edit3 className="w-3 h-3" /> Edit
                            </>
                          ) : (
                            <>
                              <Eye className="w-3 h-3" /> Preview
                            </>
                          )}
                        </button>
                      </div>

                      {isPreviewing ? (
                        // Preview mode — rendered markdown
                        <div className="border border-slate-200 rounded-xl px-6 py-5 min-h-[300px] bg-white">
                          <MarkdownRenderer content={editContentRef.current} />
                        </div>
                      ) : (
                        // Rich editor mode — Tiptap
                        <RichEditor
                          content={editContentRef.current}
                          onChange={(md) => {
                            editContentRef.current = md;
                          }}
                          projectId={projectId}
                          placeholder={`Edit ${SECTION_TITLES[key] ?? key}…`}
                        />
                      )}

                      <div className="flex gap-2 pt-1">
                        <Button
                          size="sm"
                          onClick={() => saveSection(key)}
                          loading={saving}
                        >
                          Save changes
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setEditingSection(null);
                            setPreviewMode((p) => ({ ...p, [key]: false }));
                            setExpandedSection(key);
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <MarkdownRenderer content={section!.content} />
                      <div className="flex gap-2 pt-2 border-t border-slate-100 flex-wrap">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            editContentRef.current = section!.content;
                            setEditingSection(key);
                          }}
                        >
                          <Edit3 className="w-3 h-3" /> Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          loading={regenerating === key}
                          onClick={() => regenerateSection(key)}
                        >
                          <RefreshCw className="w-3 h-3" /> Regenerate
                        </Button>
                        {!section?.approved && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => approveSection(key)}
                            className="ml-auto border-green-300 text-green-700 hover:bg-green-50"
                          >
                            <CheckCircle className="w-3 h-3" /> Approve
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </CardBody>
              )}

              {/* Streaming skeleton */}
              {isStreaming && !hasContent && (
                <CardBody>
                  <div className="space-y-2 animate-pulse">
                    {[90, 75, 85, 60].map((w, i) => (
                      <div
                        key={i}
                        className="h-3 bg-slate-100 rounded"
                        style={{ width: `${w}%` }}
                      />
                    ))}
                  </div>
                </CardBody>
              )}
            </Card>
          );
        })}
      </div>
    </>
  );
}
