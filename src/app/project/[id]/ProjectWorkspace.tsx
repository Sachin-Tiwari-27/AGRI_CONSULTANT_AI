"use client";
import { useState } from "react";
import { toast } from "@/components/ui/toast";
import { OverviewTab } from "@/components/project/tabs/OverviewTab";
import { QuestionnaireTab } from "@/components/project/tabs/QuestionnaireTab";
import { AnalysisTab } from "@/components/project/tabs/AnalysisTab";
import { ReportTab } from "@/components/project/tabs/ReportTab";
import { LogTab } from "@/components/project/tabs/LogTab";
import { ArtifactsTab } from "@/components/project/tabs/ArtifactsTab";
import { QuestionnairePreviewModal } from "@/components/questionnaire/QuestionnairePreviewModal";
import type {
  Project,
  Report,
  AIFlag,
  ReportSectionKey,
  QuestionnaireTemplate,
  PersonalisationDiff,
} from "@/types";

const DEFAULT_TEMPLATE: QuestionnaireTemplate = {
  id: "default",
  consultant_id: "",
  name: "Project Scoping Questionnaire",
  sections: [
    { id: "s1", title: "Investor & Site Profile", order: 1 },
    { id: "s2", title: "Infrastructure & Utilities", order: 2 },
    { id: "s3", title: "Project Vision & Crops", order: 3 },
    { id: "s4", title: "Commercial & Logistics", order: 4 },
  ],
  questions: [
    {
      id: "q1",
      section_id: "s1",
      label: "Legal entity or company name",
      type: "text",
      required: true,
      order: 1,
    },
    {
      id: "q2",
      section_id: "s1",
      label: "Primary contact person",
      type: "text",
      required: true,
      order: 2,
    },
    {
      id: "q3",
      section_id: "s1",
      label: "Email / WhatsApp",
      type: "text",
      required: true,
      order: 3,
    },
    {
      id: "q4",
      section_id: "s1",
      label: "GPS coordinates or Google Maps link",
      type: "gps",
      required: true,
      order: 4,
    },
    {
      id: "q5",
      section_id: "s1",
      label: "Total land area available (sqm)",
      type: "number",
      required: true,
      order: 5,
    },
    {
      id: "q6",
      section_id: "s2",
      label: "Primary water source",
      type: "select",
      required: true,
      order: 1,
      options: [
        { value: "deep_well", label: "Deep well" },
        { value: "desalination", label: "Desalination plant" },
        { value: "tanker", label: "Water tanker" },
        { value: "government", label: "Government supply" },
      ],
    },
    {
      id: "q7",
      section_id: "s2",
      label: "Estimated water availability (litres/day)",
      type: "number",
      required: true,
      order: 2,
    },
    {
      id: "q8",
      section_id: "s2",
      label: "Water analysis report available?",
      type: "boolean",
      required: true,
      order: 3,
    },
    {
      id: "q9",
      section_id: "s2",
      label: "Upload water analysis report (if available)",
      type: "file_upload",
      required: false,
      order: 4,
      conditions: [{ question_id: "q8", operator: "is_true", value: "true" }],
    },
    {
      id: "q10",
      section_id: "s2",
      label: "Power source",
      type: "select",
      required: true,
      order: 5,
      options: [
        { value: "grid", label: "Government grid" },
        { value: "generator", label: "Diesel generator" },
        { value: "solar", label: "Solar/hybrid" },
      ],
    },
    {
      id: "q11",
      section_id: "s2",
      label: "Available power capacity (KVA)",
      type: "number",
      required: false,
      order: 6,
    },
    {
      id: "q12",
      section_id: "s2",
      label: "Internet connectivity at site",
      type: "select",
      required: true,
      order: 7,
      options: [
        { value: "4g_5g", label: "4G / 5G available" },
        { value: "weak", label: "Weak signal" },
        { value: "none", label: "No signal" },
      ],
    },
    {
      id: "q13",
      section_id: "s2",
      label: "Can a 40ft container truck reach the site?",
      type: "boolean",
      required: true,
      order: 8,
    },
    {
      id: "q14",
      section_id: "s3",
      label: "Target crops",
      type: "multiselect",
      required: true,
      order: 1,
      options: [
        { value: "cherry_tomato", label: "Cherry Tomatoes" },
        { value: "beef_tomato", label: "Beef Tomatoes" },
        { value: "capsicum", label: "Bell Peppers" },
        { value: "cucumber", label: "Cucumbers" },
        { value: "lettuce", label: "Lettuce" },
        { value: "herbs", label: "Herbs" },
        { value: "strawberry", label: "Strawberries" },
        { value: "fig", label: "Figs" },
        { value: "other", label: "Other" },
      ],
    },
    {
      id: "q15",
      section_id: "s3",
      label: "Specify other crops",
      type: "text",
      required: false,
      order: 2,
      conditions: [
        { question_id: "q14", operator: "contains", value: "other" },
      ],
    },
    {
      id: "q16",
      section_id: "s3",
      label: "Desired technology level",
      type: "select",
      required: true,
      order: 3,
      options: [
        { value: "standard", label: "Standard" },
        { value: "advanced", label: "Advanced" },
        { value: "elite", label: "Elite" },
      ],
    },
    {
      id: "q17",
      section_id: "s3",
      label: "Is agro-tourism / farm experience planned?",
      type: "boolean",
      required: true,
      order: 4,
    },
    {
      id: "q18",
      section_id: "s4",
      label: "Primary target market",
      type: "multiselect",
      required: true,
      order: 1,
      options: [
        { value: "local_retail", label: "Local retail" },
        { value: "supermarkets", label: "Supermarkets" },
        { value: "restaurants", label: "Restaurants & hotels" },
        { value: "export_uae", label: "Export to UAE" },
        { value: "export_gcc", label: "Export to GCC" },
      ],
    },
    {
      id: "q19",
      section_id: "s4",
      label: "On-site cold storage required?",
      type: "boolean",
      required: true,
      order: 2,
    },
    {
      id: "q20",
      section_id: "s4",
      label: "Allocated budget for Phase 1",
      type: "text",
      required: true,
      order: 3,
    },
    {
      id: "q21",
      section_id: "s4",
      label: "Target construction start date",
      type: "date",
      required: false,
      order: 4,
    },
    {
      id: "q22",
      section_id: "s4",
      label: "Any other information or specific requirements",
      type: "textarea",
      required: false,
      order: 5,
    },
  ],
  created_at: new Date().toISOString(),
};

type TabId =
  | "overview"
  | "questionnaire"
  | "analysis"
  | "report"
  | "artifacts"
  | "log";

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
  { id: "artifacts", label: "Artifacts" },
  { id: "log", label: "Activity log" },
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
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewTemplate, setPreviewTemplate] =
    useState<QuestionnaireTemplate | null>(null);
  const [previewDiff, setPreviewDiff] = useState<PersonalisationDiff | null>(
    null,
  );
  const [previewRound, setPreviewRound] = useState(1);

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

  function patchProject(patch: Partial<Project>) {
    setProject((p) => ({ ...p, ...patch }));
  }

  async function refreshProject() {
    const pRes = await fetch(`/api/projects/${project.id}`);
    if (pRes.ok) setProject(await pRes.json());
  }

  async function sendQuestionnaire() {
    setLoading("send_q");
    try {
      const round =
        submissions.length > 0
          ? Math.max(...submissions.map((s) => s.round)) + 1
          : 1;
      if (round > 1) {
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
        await refreshProject();
        toast.success(`Questionnaire resent to ${project.client_email}`);
        setLoading(null);
        return;
      }
      let diff: PersonalisationDiff | null = null;
      const callBrief = (project as any).call_brief;
      if (callBrief) {
        try {
          const pRes = await fetch("/api/questionnaire/personalize", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              projectId: project.id,
              template: DEFAULT_TEMPLATE,
            }),
          });
          if (pRes.ok) {
            const pData = await pRes.json();
            diff = pData.diff || null;
          }
        } catch {}
      }
      setPreviewTemplate(DEFAULT_TEMPLATE);
      setPreviewDiff(diff);
      setPreviewRound(round);
      setPreviewOpen(true);
    } catch (e: any) {
      toast.error(e.message || "Failed to prepare questionnaire");
    } finally {
      setLoading(null);
    }
  }

  async function handlePreviewSent() {
    setPreviewOpen(false);
    await refreshProject();
    toast.success(`Questionnaire sent to ${project.client_email}`);
  }

  async function uploadTranscript(text: string) {
    setLoading("transcript");
    try {
      const res = await fetch("/api/ai/transcript", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: project.id, text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      patchProject({ call_brief: data.brief } as any);
      toast.success("Transcript analysed — call brief extracted");
    } catch (e: any) {
      toast.error(e.message || "Failed to process transcript");
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
        return [
          ...prev,
          ...(data.flags || []).filter((f: AIFlag) => !existingIds.has(f.id)),
        ];
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
      patchProject({ status: "clarification_sent" });
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
      patchProject({ status: "report_draft" });
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

  const analysisEnabled = !!(latestSubmission || report);
  const reportEnabled = !!(latestSubmission || report);

  function navigateTo(tab: TabId) {
    if (tab === "analysis" && !analysisEnabled) return;
    if (tab === "report" && !reportEnabled) return;
    setActiveTab(tab);
  }

  return (
    <>
      {previewOpen && previewTemplate && (
        <QuestionnairePreviewModal
          projectId={project.id}
          template={previewTemplate}
          diff={previewDiff}
          round={previewRound}
          onClose={() => setPreviewOpen(false)}
          onSent={handlePreviewSent}
        />
      )}

      {/* ── FIX PR-2: Tab nav is sticky below the 73px TopBar ────────────
          top-[73px] matches TopBar height (py-5 × 2 = 40px + h1 line 33px).
          bg-white + z-[5] ensure it sits above scrolled content but below
          the TopBar's z-10. -mx-8 / px-8 extend the background edge-to-edge.
      ──────────────────────────────────────────────────────────────────── */}
      <div className="sticky top-[73px] z-[5] bg-white border-b border-slate-200 -mx-8 px-8 mb-6">
        <div className="flex gap-1 overflow-x-auto py-0 pt-2">
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
                className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap flex-shrink-0 ${
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
      </div>

      {/* Tab content — scroll-mt accounts for both TopBar and sticky tab nav */}
      <div className="px-8 pb-8 scroll-mt-[133px]">
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
            onUploadTranscript={uploadTranscript}
            onScheduled={(link) =>
              patchProject({ meet_link: link, status: "call_scheduled" })
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
            onUpdateProject={patchProject}
          />
        )}
        {activeTab === "artifacts" && <ArtifactsTab projectId={project.id} />}
        {activeTab === "log" && <LogTab projectId={project.id} />}
      </div>
    </>
  );
}
