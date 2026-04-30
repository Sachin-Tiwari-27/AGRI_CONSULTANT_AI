"use client";
import { useState } from "react";
import { ToastProvider, toast } from "@/components/ui/Toast";
import { OverviewTab } from "@/components/project/tabs/OverviewTab";
import { QuestionnaireTab } from "@/components/project/tabs/QuestionnaireTab";
import { AnalysisTab } from "@/components/project/tabs/AnalysisTab";
import { ReportTab } from "@/components/project/tabs/ReportTab";
import { StatusBadge } from "@/components/ui/Card";
import type { Project, Report, AIFlag, ReportSectionKey } from "@/types";

type TabId = "overview" | "questionnaire" | "analysis" | "report";

interface Submission {
  id: string;
  round: number;
  submitted_at: string | null;
  token: string;
  answers: Record<string, unknown>;
}

interface Props {
  project: Project & {
    questionnaire_submissions: Submission[];
    ai_flags: AIFlag[];
  };
  report: Report | null;
  userId: string;
}

const TABS: { id: TabId; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "questionnaire", label: "Questionnaire" },
  { id: "analysis", label: "Analysis" },
  { id: "report", label: "Report" },
];

export function ProjectWorkspace({
  project: initial,
  report: initialReport,
  userId,
}: Props) {
  const [project, setProject] = useState(initial);
  const [report, setReport] = useState(initialReport);
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [loading, setLoading] = useState<string | null>(null);
  const [flags, setFlags] = useState<AIFlag[]>(initial.ai_flags || []);

  const submissions = project.questionnaire_submissions || [];
  const latestSubmission = submissions
    .filter((s) => s.submitted_at)
    .sort(
      (a, b) =>
        new Date(b.submitted_at!).getTime() -
        new Date(a.submitted_at!).getTime(),
    )[0];
  const pendingFlags = flags.filter((f) => f.status === "pending");
  const acceptedFlags = flags.filter((f) => f.status === "accepted");
  const currency = (project as any).currency || "USD";

  // ── Actions ──────────────────────────────────────────────────────

  async function sendQuestionnaire() {
    setLoading("send_q");
    try {
      const res = await fetch("/api/questionnaire/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: project.id,
          templateId: null,
          round: 1,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setProject((p) => ({ ...p, status: "questionnaire_sent" }));
      toast.success(`Questionnaire sent to ${project.client_email}`);
    } catch (e: any) {
      toast.error(e.message || "Failed to send questionnaire");
    } finally {
      setLoading(null);
    }
  }

  async function runClarificationCheck() {
    if (!latestSubmission) return;
    setLoading("clarify");
    try {
      const res = await fetch("/api/ai/clarify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: project.id,
          submissionId: latestSubmission.id,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Check failed");
      setFlags((prev) => {
        const existingIds = new Set(prev.map((f) => f.id));
        const newFlags = (data.flags || []).filter(
          (f: AIFlag) => !existingIds.has(f.id),
        );
        return [...prev, ...newFlags];
      });
      toast.success(
        `Gap check complete — ${data.flags?.length || 0} potential gaps found`,
      );
      setActiveTab("questionnaire");
    } catch (e: any) {
      toast.error(e.message || "Gap check failed");
    } finally {
      setLoading(null);
    }
  }

  async function sendFollowUp() {
    if (!acceptedFlags.length) return;
    setLoading("followup");
    try {
      const res = await fetch("/api/questionnaire/followup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: project.id, acceptedFlags }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Failed");
      }
      setProject((p) => ({ ...p, status: "clarification_sent" }));
      toast.success(
        `Follow-up sent to ${project.client_email} with ${acceptedFlags.length} question(s)`,
      );
    } catch (e: any) {
      toast.error(e.message || "Failed to send follow-up");
    } finally {
      setLoading(null);
    }
  }

  async function generateReport(specificSection?: ReportSectionKey) {
    if (!latestSubmission) {
      toast.error(
        "Please collect questionnaire data before generating a report.",
      );
      return;
    }
    const loadingKey = specificSection ? `report_${specificSection}` : "report";
    setLoading(loadingKey);
    try {
      const res = await fetch("/api/report/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: project.id,
          sectionsToGenerate: specificSection ? [specificSection] : undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.details || err.error || "Generation failed");
      }
      const pRes = await fetch(`/api/projects/${project.id}`);
      const updated = await pRes.json();
      if (updated.reports?.[0]) setReport(updated.reports[0]);
      setProject((p) => ({ ...p, status: "report_draft" }));
      setActiveTab("report");
      if (!specificSection)
        toast.success(
          "Report draft generated — review sections in the Report tab",
        );
    } catch (e: any) {
      toast.error(e.message || "Report generation failed");
    } finally {
      setLoading(null);
    }
  }

  async function acceptFlag(flagId: string) {
    setLoading(`flag_${flagId}`);
    try {
      const res = await fetch(`/api/ai/flags/${flagId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "accepted" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setFlags((f) => f.map((x) => (x.id === flagId ? data.flag : x)));
    } catch (e: any) {
      toast.error(e.message || "Failed to accept gap");
    } finally {
      setLoading(null);
    }
  }

  async function dismissFlag(flagId: string) {
    setLoading(`flag_${flagId}`);
    try {
      const res = await fetch(`/api/ai/flags/${flagId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "dismissed" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setFlags((f) => f.map((x) => (x.id === flagId ? data.flag : x)));
    } catch (e: any) {
      toast.error(e.message || "Failed to dismiss gap");
    } finally {
      setLoading(null);
    }
  }

  async function deleteFlag(flagId: string) {
    setLoading(`flag_${flagId}`);
    try {
      const res = await fetch(`/api/ai/flags/${flagId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setFlags((f) => f.filter((x) => x.id !== flagId));
      toast.success("Gap removed");
    } catch (e: any) {
      toast.error(e.message || "Failed to delete gap");
    } finally {
      setLoading(null);
    }
  }

  async function addFlag(gap: {
    field_name: string;
    reason: string;
    suggested_question: string;
    severity: "required" | "recommended";
  }) {
    setLoading("add_gap");
    try {
      const res = await fetch("/api/ai/flags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: project.id,
          submissionId: latestSubmission?.id,
          ...gap,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setFlags((f) => [...f, data.flag]);
      toast.success("Custom gap added");
      return true;
    } catch (e: any) {
      toast.error(e.message || "Failed to add gap");
      return false;
    } finally {
      setLoading(null);
    }
  }

  // ── Tab gating ────────────────────────────────────────────────────
  const analysisEnabled = !!(latestSubmission || report);
  const reportEnabled = !!(latestSubmission || report);

  function navigateTo(tab: TabId) {
    if (tab === "analysis" && !analysisEnabled) return;
    if (tab === "report" && !reportEnabled) return;
    setActiveTab(tab);
  }

  return (
    <>
      <ToastProvider />
      <div className="px-8 py-6">
        {/* Tab bar */}
        <div className="flex gap-1 border-b border-slate-200 mb-6">
          {TABS.map((tab) => {
            const disabled =
              (tab.id === "analysis" && !analysisEnabled) ||
              (tab.id === "report" && !reportEnabled);
            const badge =
              tab.id === "questionnaire" && pendingFlags.length > 0
                ? pendingFlags.length
                : undefined;
            return (
              <button
                key={tab.id}
                onClick={() => !disabled && navigateTo(tab.id)}
                disabled={disabled}
                className={`px-4 py-2.5 text-sm font-medium rounded-t-lg border-b-2 transition-colors flex items-center gap-2 ${
                  disabled
                    ? "opacity-40 cursor-not-allowed border-transparent text-slate-400"
                    : activeTab === tab.id
                      ? "border-green-700 text-green-800"
                      : "border-transparent text-slate-500 hover:text-slate-700"
                }`}
              >
                {tab.label}
                {badge ? (
                  <span className="bg-amber-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
                    {badge}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>

        {/* Tab content */}
        {activeTab === "overview" && (
          <OverviewTab
            project={project}
            report={report}
            hasSubmission={!!latestSubmission}
            pendingFlagsCount={pendingFlags.length}
            acceptedFlagsCount={acceptedFlags.length}
            loading={loading}
            onSendQuestionnaire={sendQuestionnaire}
            onRunClarify={runClarificationCheck}
            onSendFollowUp={sendFollowUp}
            onGenerateReport={generateReport}
            onScheduled={(link) =>
              setProject((p) => ({
                ...p,
                meet_link: link,
                status: "call_scheduled",
              }))
            }
            onNavigate={navigateTo}
          />
        )}

        {activeTab === "questionnaire" && (
          <QuestionnaireTab
            project={project}
            submissions={submissions}
            flags={flags}
            loading={loading}
            onSendQuestionnaire={sendQuestionnaire}
            onRunClarify={runClarificationCheck}
            onSendFollowUp={sendFollowUp}
            onAcceptFlag={acceptFlag}
            onDismissFlag={dismissFlag}
            onDeleteFlag={deleteFlag}
            onAddFlag={addFlag}
          />
        )}

        {activeTab === "analysis" && (
          <AnalysisTab
            project={project}
            report={report}
            currency={currency}
            onGenerateReport={() => generateReport()}
            loadingReport={loading === "report"}
          />
        )}

        {activeTab === "report" && (
          <ReportTab
            project={project}
            report={report}
            hasSubmission={!!latestSubmission}
            loading={loading}
            onGenerateReport={generateReport}
            onUpdateReport={setReport}
          />
        )}
      </div>
    </>
  );
}
