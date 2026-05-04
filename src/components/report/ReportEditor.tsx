"use client";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/FormFields";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { MarkdownRenderer } from "@/components/ui/MarkdownRenderer";
import { PaymentGateModal } from "@/components/report/PaymentGateModal";
import { createClient } from "@/lib/supabase/client";
import {
  CheckCircle, Edit3, RefreshCw, ChevronDown, ChevronUp,
  Sparkles, Lock, Send, Download, DollarSign, Unlock,
  AlertCircle, CreditCard, CheckCircle2,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import type { Report, ReportSectionKey, Project } from "@/types";

const SECTION_TITLES: Record<string, string> = {
  executive_summary: "Executive Summary",
  market_analysis: "Market Analysis",
  business_model: "Business Model",
  financial_projection: "Financial Projection",
  risk_mitigation: "Risk & Mitigation",
  technical_analysis: "Technical Analysis",
  conclusion: "Conclusion",
};

interface Props {
  report: Report;
  project: Project;
  projectId: string;
  onUpdate: (report: Report) => void;
  onProjectUpdate: (patch: Partial<Project>) => void;
}

export function ReportEditor({ report, project, projectId, onUpdate, onProjectUpdate }: Props) {
  const [expandedSection, setExpandedSection] = useState<string | null>("executive_summary");
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [regenerating, setRegenerating] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [showPaymentGate, setShowPaymentGate] = useState(false);
  const [markingPaid, setMarkingPaid] = useState(false);
  const [markPaidNote, setMarkPaidNote] = useState("");
  const [showMarkPaid, setShowMarkPaid] = useState(false);

  const supabase = createClient();
  const sectionKeys = Object.keys(SECTION_TITLES).filter(k => report.sections[k as ReportSectionKey]);
  const allApproved = sectionKeys.every(k => report.sections[k as ReportSectionKey]?.approved);

  const currency = (project as any).currency || "USD";
  const reportPrice = (project as any).report_price;
  const paymentCollected = (project as any).payment_collected;
  const isCompleted = project.status === 'completed';
  const isPublished = report.status === "published";

  // Payment preference from profile (passed via project or fetched)
  // We show the gate if: published but no price set and preference is project_basis
  // OR if not yet published at all

  async function saveSection(key: string) {
    setSaving(true);
    const updated = {
      ...report.sections,
      [key]: {
        ...report.sections[key as ReportSectionKey],
        content: editContent,
        ai_generated: false,
        last_edited_at: new Date().toISOString(),
      },
    };
    await supabase.from("reports").update({ sections: updated }).eq("project_id", projectId);
    onUpdate({ ...report, sections: updated as typeof report.sections });
    setEditingSection(null);
    setSaving(false);
  }

  async function approveSection(key: string) {
    const updated = {
      ...report.sections,
      [key]: { ...report.sections[key as ReportSectionKey], approved: true },
    };
    await supabase.from("reports").update({ sections: updated }).eq("project_id", projectId);
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
      const { data } = await supabase.from("reports").select("*").eq("project_id", projectId).single();
      if (data) onUpdate(data as Report);
    } finally {
      setRegenerating(null);
    }
  }

  // ── Publish flow ──────────────────────────────────────────────────
  function handlePublishClick() {
    // If already published with a price set, just re-publish (resend email)
    if (isPublished && reportPrice !== null && reportPrice !== undefined) {
      publishReport(null);
      return;
    }
    // Show payment gate modal
    setShowPaymentGate(true);
  }

  async function handlePaymentGateConfirm(price: number, cur: string, chargeClient: boolean) {
    // 1. Save the price to the project
    const priceRes = await fetch(`/api/projects/${projectId}/report-price`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ price, currency: cur, chargeClient }),
    });
    if (!priceRes.ok) throw new Error("Failed to set price");
    onProjectUpdate({ report_price: price, currency: cur });

    // 2. Then publish
    setShowPaymentGate(false);
    await publishReport(price);
  }

  async function publishReport(price: number | null) {
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
        payment_collected: data.payment_collected
      } as any);

      if (data.warnings?.length > 0) {
        alert(data.warnings.join("\n"));
      }
    } catch {
      alert("Failed to publish report. Please check your connection.");
    } finally {
      setSaving(false);
    }
  }

  // ── Manual payment collection ─────────────────────────────────────
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
      const res = await fetch("/api/report/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });
      if (!res.ok) throw new Error("Failed to send");
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

  return (
    <>
      {/* Payment gate modal */}
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
        {/* ── Publish / status bar ─────────────────────────────── */}
        <Card>
          <CardBody className="py-3">
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1">
                {/* Status line */}
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-medium text-slate-900">
                    {isPublished ? "Report published" : "Review all sections before publishing"}
                  </p>
                  {/* Price badge */}
                  {reportPrice !== null && reportPrice !== undefined && (
                    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
                      reportPrice === 0
                        ? 'bg-blue-50 text-blue-700 border border-blue-200'
                        : 'bg-green-50 text-green-700 border border-green-200'
                    }`}>
                      {reportPrice === 0
                        ? <><Unlock className="w-3 h-3" /> Free access</>
                        : <><DollarSign className="w-3 h-3" /> {formatCurrency(reportPrice, currency)}</>
                      }
                    </span>
                  )}
                  {/* Payment collected badge */}
                  {paymentCollected && (
                    <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <CheckCircle2 className="w-3 h-3" /> Paid
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  {sectionKeys.filter(k => report.sections[k as ReportSectionKey]?.approved).length} of {sectionKeys.length} sections approved
                </p>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-2 flex-shrink-0 flex-wrap justify-end">
                {isPublished ? (
                  <>
                    {/* Mark paid button — show if price > 0 and not yet completed */}
                    {reportPrice > 0 && !isCompleted && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setShowMarkPaid(s => !s)}
                      >
                        <CreditCard className="w-3.5 h-3.5" />
                        Mark as paid
                      </Button>
                    )}
                    <div className="flex items-center gap-2 text-sm text-green-700 font-medium">
                      <Lock className="w-4 h-4" /> Published
                    </div>
                    <Button variant="outline" size="sm" onClick={resendNotification} loading={saving}>
                      <Send className="w-3.5 h-3.5" /> Resend email
                    </Button>
                    <Button variant="outline" size="sm" onClick={downloadPdf} loading={downloading}>
                      <Download className="w-3.5 h-3.5" /> Download PDF
                    </Button>
                    <Button size="sm" variant="secondary" onClick={handlePublishClick} loading={saving}>
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
                    <Lock className="w-3.5 h-3.5" />
                    Publish report
                  </Button>
                )}
              </div>
            </div>

            {/* Mark paid inline form */}
            {showMarkPaid && (
              <div className="mt-4 pt-4 border-t border-slate-100 flex items-end gap-3">
                <div className="flex-1">
                  <label className="text-xs font-medium text-slate-600 block mb-1.5">
                    Collection note (optional)
                  </label>
                  <input
                    type="text"
                    value={markPaidNote}
                    onChange={e => setMarkPaidNote(e.target.value)}
                    placeholder="e.g. Bank transfer received · Ref TXN-2025-001"
                    className="w-full text-sm px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
                <Button size="sm" onClick={handleMarkPaid} loading={markingPaid} className="flex-shrink-0">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Confirm payment
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setShowMarkPaid(false)} className="flex-shrink-0">
                  Cancel
                </Button>
              </div>
            )}

            {/* Not approved warning */}
            {!allApproved && !isPublished && (
              <div className="mt-3 flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                Approve all sections before publishing. Click each section and hit "Approve".
              </div>
            )}
          </CardBody>
        </Card>

        {/* ── Section cards ─────────────────────────────────────── */}
        {sectionKeys.map(key => {
          const section = report.sections[key as ReportSectionKey]!;
          const isExpanded = expandedSection === key;
          const isEditing = editingSection === key;

          return (
            <Card key={key}>
              <CardHeader className="py-3">
                <button
                  className="flex items-center justify-between w-full text-left"
                  onClick={() => setExpandedSection(isExpanded ? null : key)}
                >
                  <div className="flex items-center gap-3">
                    {section.approved ? (
                      <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                    ) : (
                      <div className="w-4 h-4 rounded-full border-2 border-slate-300 flex-shrink-0" />
                    )}
                    <span className="font-medium text-sm text-slate-900">{SECTION_TITLES[key]}</span>
                    {section.ai_generated && (
                      <span className="flex items-center gap-1 text-xs text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full">
                        <Sparkles className="w-3 h-3" /> AI draft
                      </span>
                    )}
                  </div>
                  {isExpanded
                    ? <ChevronUp className="w-4 h-4 text-slate-400" />
                    : <ChevronDown className="w-4 h-4 text-slate-400" />}
                </button>
              </CardHeader>

              {isExpanded && (
                <CardBody>
                  {isEditing ? (
                    <div className="space-y-3">
                      <Textarea
                        value={editContent}
                        onChange={e => setEditContent(e.target.value)}
                        className="min-h-[300px] font-mono text-xs"
                      />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => saveSection(key)} loading={saving}>Save</Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditingSection(null)}>Cancel</Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <MarkdownRenderer content={section.content} />
                      <div className="flex gap-2 pt-2 border-t border-slate-100">
                        <Button size="sm" variant="secondary"
                          onClick={() => { setEditingSection(key); setEditContent(section.content); }}>
                          <Edit3 className="w-3 h-3" /> Edit
                        </Button>
                        <Button size="sm" variant="ghost" loading={regenerating === key}
                          onClick={() => regenerateSection(key)}>
                          <RefreshCw className="w-3 h-3" /> Regenerate
                        </Button>
                        {!section.approved && (
                          <Button size="sm" variant="outline" onClick={() => approveSection(key)}
                            className="ml-auto border-green-300 text-green-700 hover:bg-green-50">
                            <CheckCircle className="w-3 h-3" /> Approve
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </CardBody>
              )}
            </Card>
          );
        })}
      </div>
    </>
  );
}
