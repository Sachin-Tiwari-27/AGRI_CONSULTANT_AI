"use client";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader, CardFooter } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Card";
import { ReportEditor } from "@/components/report/ReportEditor";
import { MarkdownRenderer } from "@/components/ui/MarkdownRenderer";
import { AsyncFeedback } from "@/components/ui/AsyncFeedback";
import {
  Video,
  Send,
  Zap,
  FileText,
  CheckCircle,
  AlertTriangle,
  ExternalLink,
  Calendar,
  MapPin,
  Wheat,
  Users,
  DollarSign,
  Clock,
  TrendingUp,
  BarChart3,
  ChevronDown,
  ChevronRight,
  Activity,
  CloudRain,
  Trash2,
} from "lucide-react";
import { formatDate, formatCurrency } from "@/lib/utils";
import type { Project, Report, AIFlag, ReportSectionKey } from "@/types";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

const QUESTION_LABELS: Record<string, string> = {
  q1: "Company Name / Legal Entity",
  q2: "Primary Contact Person",
  q3: "Email / WhatsApp",
  q4: "GPS coordinates or Google Maps link",
  q5: "Total land area available (sqm)",
  q6: "Primary water source",
  q7: "Estimated water availability (litres/day)",
  q8: "Water analysis report available?",
  q9: "Upload water analysis report",
  q10: "Power source",
  q11: "Available power capacity (KVA)",
  q12: "Internet connectivity at site",
  q13: "Can a 40ft container truck reach?",
  q14: "Target crops",
  q15: "Specify other crops",
  q16: "Desired technology level",
  q17: "Agro-tourism / farm experience planned?",
  q18: "Primary target market",
  q19: "On-site cold storage required?",
  q20: "Allocated budget for Phase 1",
  q21: "Target construction start date",
  q22: "Any other information",
};

interface Props {
  project: Project & {
    questionnaire_submissions: Array<{
      id: string;
      round: number;
      submitted_at: string | null;
      token: string;
      answers: Record<string, unknown>;
    }>;
    ai_flags: AIFlag[];
  };
  report: Report | null;
  userId: string;
}

const CHART_COLORS = [
  "#1A5C38",
  "#2E7D52",
  "#4CAF82",
  "#7DD3B0",
  "#A8E6CA",
  "#D4F5E9",
];

export function ProjectWorkspace({
  project: initial,
  report: initialReport,
  userId,
}: Props) {
  const [project, setProject] = useState(initial);
  const [report, setReport] = useState(initialReport);
  const [activeTab, setActiveTab] = useState<
    "overview" | "questionnaire" | "analysis" | "report"
  >("overview");
  const [loading, setLoading] = useState<string | null>(null);
  const [actionStatus, setActionStatus] = useState<
    Record<
      | "sendQuestionnaire"
      | "clarificationCheck"
      | "followUpSend"
      | "reportGeneration"
      | "analysisFetch",
      {
        state: "idle" | "loading" | "success" | "error";
        message: string | null;
      }
    >
  >({
    sendQuestionnaire: { state: "idle", message: null },
    clarificationCheck: { state: "idle", message: null },
    followUpSend: { state: "idle", message: null },
    reportGeneration: { state: "idle", message: null },
    analysisFetch: { state: "idle", message: null },
  });
  const [flags, setFlags] = useState<AIFlag[]>(initial.ai_flags || []);
  const [expandedAnswers, setExpandedAnswers] = useState<string | null>(null);
  const [analysisData, setAnalysisData] = useState<{
    climateData: string;
    marketResearch: string;
  } | null>(null);
  const feedbackRef = useRef<HTMLDivElement>(null);

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
  const latestAsyncMessage =
    Object.values(actionStatus)
      .map((item) => item.message)
      .filter(Boolean)
      .at(-1) || "";

  function updateActionStatus(
    action: keyof typeof actionStatus,
    state: "idle" | "loading" | "success" | "error",
    message: string | null = null,
  ) {
    setActionStatus((prev) => ({
      ...prev,
      [action]: { state, message },
    }));
    if ((state === "success" || state === "error") && message) {
      setTimeout(() => feedbackRef.current?.focus(), 0);
    }
  }

  const recommendedAction = (() => {
    if (!submissions.length) {
      return {
        title: "Send the initial questionnaire",
        description:
          "Kick off data collection so the client can provide baseline farm details.",
        buttonLabel: "Send questionnaire",
        action: sendQuestionnaire,
        disabled: actionStatus.sendQuestionnaire.state === "loading",
      };
    }
    if (!latestSubmission) {
      return {
        title: "Wait for questionnaire submission",
        description:
          "The form link has been sent. Follow up with the client if no response arrives soon.",
        buttonLabel: "Review questionnaire tab",
        action: () => setActiveTab("questionnaire"),
        disabled: false,
      };
    }
    if (!flags.length || pendingFlags.length > 0) {
      return {
        title: "Run AI clarification check",
        description:
          "Detect missing critical inputs before analysis and report drafting.",
        buttonLabel: "Run check",
        action: runClarificationCheck,
        disabled: actionStatus.clarificationCheck.state === "loading",
      };
    }
    if (acceptedFlags.length > 0) {
      return {
        title: "Send follow-up clarification",
        description:
          "Request only the accepted clarification questions from the client.",
        buttonLabel: "Send follow-up",
        action: sendFollowUp,
        disabled: actionStatus.followUpSend.state === "loading",
      };
    }
    if (!report) {
      return {
        title: "Generate feasibility report draft",
        description:
          "Generate the AI draft now that questionnaire and clarifications are complete.",
        buttonLabel: "Generate report",
        action: () => generateReport(),
        disabled: actionStatus.reportGeneration.state === "loading",
      };
    }
    return {
      title: "Review and refine draft report",
      description:
        "Open the report tab to finalize narrative, numbers, and recommendations.",
      buttonLabel: "Open report",
      action: () => setActiveTab("report"),
      disabled: false,
    };
  })();

  async function sendQuestionnaire() {
    setLoading("send_q");
    updateActionStatus("sendQuestionnaire", "loading");
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
      updateActionStatus(
        "sendQuestionnaire",
        "success",
        `Questionnaire sent to ${project.client_email}.`,
      );
    } catch {
      updateActionStatus(
        "sendQuestionnaire",
        "error",
        "Failed to send questionnaire. Please try again.",
      );
    } finally {
      setLoading(null);
    }
  }

  async function runClarificationCheck() {
    if (!latestSubmission) return;
    setLoading("clarify");
    updateActionStatus("clarificationCheck", "loading");
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
      setFlags(data.flags || []);
      setActiveTab("questionnaire");
      updateActionStatus(
        "clarificationCheck",
        "success",
        `Clarification check completed. ${data.flags?.length || 0} potential gaps found.`,
      );
    } catch {
      updateActionStatus(
        "clarificationCheck",
        "error",
        "Clarification check failed. Please retry in a moment.",
      );
    } finally {
      setLoading(null);
    }
  }

  async function sendFollowUp() {
    if (!acceptedFlags.length) return;
    setLoading("followup");
    updateActionStatus("followUpSend", "loading");
    try {
      const res = await fetch("/api/questionnaire/followup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: project.id, acceptedFlags }),
      });
      if (!res.ok) throw new Error("Failed");
      setProject((p) => ({ ...p, status: "clarification_sent" }));
      updateActionStatus(
        "followUpSend",
        "success",
        `Follow-up sent to ${project.client_email} with ${acceptedFlags.length} question(s).`,
      );
    } catch {
      updateActionStatus(
        "followUpSend",
        "error",
        "Failed to send follow-up. Please retry.",
      );
    } finally {
      setLoading(null);
    }
  }

  async function generateReport(specificSection?: ReportSectionKey) {
    const loadingKey = specificSection ? `report_${specificSection}` : "report";
    setLoading(loadingKey);
    if (!specificSection) {
      updateActionStatus("reportGeneration", "loading");
    }
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
        throw new Error(err.details || err.error || "Failed");
      }

      const pRes = await fetch(`/api/projects/${project.id}`);
      const updated = await pRes.json();
      if (updated.reports?.[0]) setReport(updated.reports[0]);
      setProject((p) => ({ ...p, status: "report_draft" }));
      setActiveTab("report");
      if (!specificSection) {
        updateActionStatus(
          "reportGeneration",
          "success",
          "Report generation completed. Review the draft sections.",
        );
      }
    } catch (err: unknown) {
      if (!specificSection) {
        const errorMessage =
          err instanceof Error ? err.message : "Unknown error";
        updateActionStatus(
          "reportGeneration",
          "error",
          `Report generation failed: ${errorMessage}`,
        );
      }
    } finally {
      setLoading(null);
    }
  }

  async function acceptFlag(flagId: string) {
    setLoading(`flag_accept_${flagId}`);
    try {
      const res = await fetch(`/api/ai/flags/${flagId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "accepted" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to accept flag");

      setFlags((f) => f.map((x) => (x.id === flagId ? data.flag : x)));
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Unknown error";
      alert(`Failed to accept flag: ${message}`);
    } finally {
      setLoading(null);
    }
  }

  async function dismissFlag(flagId: string) {
    setLoading(`flag_dismiss_${flagId}`);
    try {
      const res = await fetch(`/api/ai/flags/${flagId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "dismissed" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to dismiss flag");

      setFlags((f) => f.map((x) => (x.id === flagId ? data.flag : x)));
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Unknown error";
      alert(`Failed to dismiss flag: ${message}`);
    } finally {
      setLoading(null);
    }
  }

  async function deleteFlag(flagId: string) {
    setLoading(`flag_delete_${flagId}`);
    try {
      const res = await fetch(`/api/ai/flags/${flagId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete flag");

      setFlags((f) => f.filter((x) => x.id !== flagId));
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Unknown error";
      alert(`Failed to delete flag: ${message}`);
    } finally {
      setLoading(null);
    }
  }

  async function fetchAnalysisData() {
    setLoading("analysisData");
    updateActionStatus("analysisFetch", "loading");
    try {
      const res = await fetch(`/api/analysis/data/${project.id}`);
      if (!res.ok) throw new Error("Fetch failed");
      setAnalysisData(await res.json());
      updateActionStatus(
        "analysisFetch",
        "success",
        "Latest market and climate data fetched successfully.",
      );
    } catch {
      updateActionStatus(
        "analysisFetch",
        "error",
        "Failed to fetch analysis data. Please retry.",
      );
    } finally {
      setLoading(null);
    }
  }

  function renderActionFeedback(
    action: keyof typeof actionStatus,
    className = "mt-2",
  ) {
    const status = actionStatus[action];
    if (
      !status.message ||
      status.state === "loading" ||
      status.state === "idle"
    ) {
      return null;
    }
    return (
      <AsyncFeedback
        className={className}
        message={status.message}
        tone={status.state === "error" ? "error" : "success"}
      />
    );
  }

  const TABS: {
    id: "overview" | "questionnaire" | "analysis" | "report";
    label: string;
    badge?: number;
  }[] = [
    { id: "overview", label: "Overview" },
    {
      id: "questionnaire",
      label: "Questionnaire",
      badge: pendingFlags.length || undefined,
    },
    { id: "analysis", label: "Analysis" },
    { id: "report", label: "Report" },
  ];

  // Chart data
  const cropChartData =
    report?.financial_model?.crops?.map((c) => ({
      name: c.name,
      revenue: c.annual_revenue,
    })) || [];

  const costPieData = report?.financial_model
    ? [
        { name: "CAPEX", value: report.financial_model.capex_total },
        { name: "Pre-startup", value: report.financial_model.pre_startup_cost },
        {
          name: "Grow Cost/yr",
          value: report.financial_model.growing_cost_annual,
        },
        {
          name: "Manpower/yr",
          value: report.financial_model.manpower_cost_annual,
        },
      ].filter((d) => d.value > 0)
    : [];

  return (
    <div className="px-8 py-6">
      <div aria-live="polite" className="sr-only">
        {latestAsyncMessage}
      </div>
      <div
        ref={feedbackRef}
        tabIndex={-1}
        className="mb-4 rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
      >
        {Object.entries(actionStatus)
          .filter(
            ([, value]) =>
              value.message &&
              (value.state === "success" || value.state === "error"),
          )
          .slice(-1)
          .map(([key, value]) => (
            <AsyncFeedback
              key={key}
              message={value.message!}
              tone={value.state === "error" ? "error" : "success"}
            />
          ))}
      </div>
      <Card className="mb-6 border-green-200 bg-green-50/60">
        <CardBody className="flex items-center justify-between gap-4 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-green-700">
              Next recommended action
            </p>
            <h3 className="text-sm font-semibold text-slate-900 mt-1">
              {recommendedAction.title}
            </h3>
            <p className="text-xs text-slate-600 mt-1">
              {recommendedAction.description}
            </p>
          </div>
          <Button
            size="sm"
            onClick={recommendedAction.action}
            disabled={recommendedAction.disabled}
          >
            {recommendedAction.buttonLabel}
          </Button>
        </CardBody>
      </Card>
      {/* Tab bar */}
      <div className="flex gap-1 border-b border-slate-200 mb-6">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 text-sm font-medium rounded-t-lg border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === tab.id
                ? "border-green-700 text-green-800"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {tab.label}
            {tab.badge ? (
              <span className="bg-amber-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
                {tab.badge}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW TAB ──────────────────────────────────────── */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-3 gap-5">
          {/* Left: project details */}
          <div className="col-span-2 space-y-4">
            {/* Pipeline */}
            <Card>
              <CardHeader>
                <h3 className="font-semibold text-slate-900 text-sm">
                  Project pipeline
                </h3>
              </CardHeader>
              <CardBody className="py-6 px-4">
                <div className="relative flex items-center justify-between w-full">
                  {/* Background track line */}
                  <div className="absolute left-8 right-8 top-1/2 -translate-y-1/2 h-1 bg-slate-100 rounded-full z-0" />

                  {[
                    {
                      key: "call",
                      label: "Call",
                      done: [
                        "call_completed",
                        "questionnaire_sent",
                        "questionnaire_submitted",
                        "analysis_running",
                        "report_draft",
                        "report_published",
                        "completed",
                      ].includes(project.status),
                    },
                    {
                      key: "q",
                      label: "Questionnaire",
                      done: [
                        "questionnaire_submitted",
                        "analysis_running",
                        "report_draft",
                        "report_published",
                        "completed",
                      ].includes(project.status),
                    },
                    {
                      key: "ai",
                      label: "Analysis",
                      done: [
                        "report_draft",
                        "report_published",
                        "completed",
                      ].includes(project.status),
                    },
                    {
                      key: "rep",
                      label: "Report",
                      done: ["report_published", "completed"].includes(
                        project.status,
                      ),
                    },
                    {
                      key: "pay",
                      label: "Delivered",
                      done: project.status === "completed",
                    },
                  ].map((step, i, arr) => {
                    const isLastDone = step.done && !arr[i + 1]?.done;
                    return (
                      <div
                        key={step.key}
                        className="relative z-10 flex flex-col items-center gap-2"
                      >
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold text-sm border-2 transition-all ${
                            step.done
                              ? isLastDone
                                ? "bg-green-600 border-green-600 text-white shadow-md shadow-green-200"
                                : "bg-green-100 border-green-600 text-green-700"
                              : "bg-white border-slate-300 text-slate-400"
                          }`}
                        >
                          {step.done ? (
                            isLastDone ? (
                              i + 1
                            ) : (
                              <CheckCircle className="w-4 h-4 text-inherit" />
                            )
                          ) : (
                            i + 1
                          )}
                        </div>
                        <span
                          className={`text-[11px] uppercase tracking-wider font-semibold ${
                            step.done
                              ? isLastDone
                                ? "text-green-700"
                                : "text-slate-700"
                              : "text-slate-400"
                          }`}
                        >
                          {step.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </CardBody>
            </Card>

            {/* Actions */}
            <Card>
              <CardHeader>
                <h3 className="font-semibold text-slate-900 text-sm">
                  Actions
                </h3>
              </CardHeader>
              <CardBody className="space-y-3">
                {/* Schedule call */}
                {project.meet_link ? (
                  <a
                    href={project.meet_link}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-3 p-3 rounded-lg bg-blue-50 border border-blue-200 hover:bg-blue-100 transition-colors"
                  >
                    <Video className="w-4 h-4 text-blue-700" />
                    <div>
                      <p className="text-sm font-medium text-blue-800">
                        Open Google Meet
                      </p>
                      {project.meet_scheduled_at && (
                        <p className="text-xs text-blue-600">
                          {formatDate(project.meet_scheduled_at)}
                        </p>
                      )}
                    </div>
                    <ExternalLink className="w-3.5 h-3.5 text-blue-500 ml-auto" />
                  </a>
                ) : (
                  <ScheduleCallCard
                    projectId={project.id}
                    onScheduled={(link) =>
                      setProject((p) => ({
                        ...p,
                        meet_link: link,
                        status: "call_scheduled",
                      }))
                    }
                  />
                )}

                {/* Send questionnaire */}
                <div>
                  <div className="flex items-center justify-between p-3 rounded-lg border border-slate-200">
                    <div className="flex items-center gap-3">
                      <Send className="w-4 h-4 text-slate-500" />
                      <div>
                        <p className="text-sm font-medium text-slate-800">
                          Send questionnaire
                        </p>
                        <p className="text-xs text-slate-500">
                          {latestSubmission
                            ? `Submitted ${formatDate(latestSubmission.submitted_at!)}`
                            : submissions.length > 0
                              ? "Sent — awaiting response"
                              : "Not sent yet"}
                        </p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={sendQuestionnaire}
                      loading={loading === "send_q"}
                      disabled={!!latestSubmission || loading === "send_q"}
                    >
                      Send
                    </Button>
                  </div>
                  {renderActionFeedback("sendQuestionnaire")}
                </div>

                {/* AI clarification */}
                {latestSubmission && (
                  <div>
                    <div className="flex items-center justify-between p-3 rounded-lg border border-slate-200">
                      <div className="flex items-center gap-3">
                        <Zap className="w-4 h-4 text-purple-500" />
                        <div>
                          <p className="text-sm font-medium text-slate-800">
                            Run AI gap check
                          </p>
                          <p className="text-xs text-slate-500">
                            {flags.length > 0
                              ? `${pendingFlags.length} gaps pending review`
                              : "Check questionnaire for missing data"}
                          </p>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={runClarificationCheck}
                        loading={loading === "clarify"}
                        disabled={loading === "clarify"}
                      >
                        Run
                      </Button>
                    </div>
                    {renderActionFeedback("clarificationCheck")}
                  </div>
                )}

                {/* Generate report */}
                {latestSubmission && (
                  <div>
                    <div className="flex items-center justify-between p-3 rounded-lg border border-slate-200">
                      <div className="flex items-center gap-3">
                        <FileText className="w-4 h-4 text-green-600" />
                        <div>
                          <p className="text-sm font-medium text-slate-800">
                            Generate feasibility report
                          </p>
                          <p className="text-xs text-slate-500">
                            {report
                              ? "Report exists — regenerate sections"
                              : "AI-draft all sections from project data"}
                          </p>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => generateReport()}
                        loading={loading === "report"}
                        disabled={loading === "report"}
                      >
                        {report ? "Regenerate" : "Generate"}
                      </Button>
                    </div>
                    {renderActionFeedback("reportGeneration")}
                  </div>
                )}
              </CardBody>
            </Card>
          </div>

          {/* Right: project info */}
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <h3 className="font-semibold text-slate-900 text-sm">
                  Project details
                </h3>
              </CardHeader>
              <CardBody className="space-y-3">
                {[
                  { icon: Users, label: "Client", value: project.client_name },
                  {
                    icon: MapPin,
                    label: "Location",
                    value: project.region
                      ? `${project.region}, ${project.country}`
                      : "—",
                  },
                  {
                    icon: Wheat,
                    label: "Crops",
                    value: project.crop_types?.join(", ") || "—",
                  },
                  {
                    icon: DollarSign,
                    label: "Budget",
                    value: project.budget_range || "—",
                  },
                  {
                    icon: Clock,
                    label: "Created",
                    value: formatDate(project.created_at),
                  },
                ].map(({ icon: Icon, label, value }) => (
                  <div key={label} className="flex items-start gap-3">
                    <Icon className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs text-slate-500">{label}</p>
                      <p className="text-sm text-slate-800">{value}</p>
                    </div>
                  </div>
                ))}
              </CardBody>
            </Card>

            {project.consultant_notes && (
              <Card>
                <CardHeader>
                  <h3 className="font-semibold text-slate-900 text-sm">
                    Call notes
                  </h3>
                </CardHeader>
                <CardBody>
                  <p className="text-sm text-slate-600 whitespace-pre-wrap">
                    {project.consultant_notes}
                  </p>
                </CardBody>
              </Card>
            )}
          </div>
        </div>
      )}

      {/* ── QUESTIONNAIRE TAB ─────────────────────────────────── */}
      {activeTab === "questionnaire" && (
        <div className="max-w-3xl space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Questionnaire Operations
            </h2>
            <p className="text-sm text-slate-500">
              Track submissions, run clarification checks, and request follow-up
              details.
            </p>
          </div>
          {/* Quick Actions Header for Questionnaire */}
          <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-slate-200 shadow-sm mb-2">
            <div className="flex items-center gap-3">
              <Badge
                variant={
                  project.status === "questionnaire_sent" ? "amber" : "green"
                }
              >
                Status: {project.status.replace(/_/g, " ")}
              </Badge>
              {latestSubmission && (
                <span className="text-xs text-slate-500">
                  Last submission: {formatDate(latestSubmission.submitted_at!)}
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={sendQuestionnaire}
                loading={loading === "send_q"}
                disabled={loading === "send_q"}
              >
                <Send className="w-3.5 h-3.5 mr-1" />
                {submissions.length > 0 ? "Resend Link" : "Send Questionnaire"}
              </Button>
              {latestSubmission && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={runClarificationCheck}
                  loading={loading === "clarify"}
                  disabled={loading === "clarify"}
                >
                  <Zap className="w-3.5 h-3.5 mr-1" /> Run AI Gap Check
                </Button>
              )}
            </div>
          </div>

          {submissions.length === 0 ? (
            <Card>
              <CardBody className="text-center py-12">
                <p className="text-slate-500 text-sm">
                  No questionnaire activity yet.
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  Send the initial form to start collecting project inputs.
                </p>
                <Button
                  className="mt-4"
                  onClick={sendQuestionnaire}
                  loading={loading === "send_q"}
                  disabled={loading === "send_q"}
                >
                  Send questionnaire
                </Button>
                {renderActionFeedback("sendQuestionnaire", "mt-3")}
              </CardBody>
            </Card>
          ) : (
            <>
              {submissions.map((s) => (
                <Card key={s.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm text-slate-900">
                          {s.round === 1
                            ? "Initial questionnaire"
                            : `Follow-up (round ${s.round})`}
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {s.submitted_at
                            ? `Submitted ${formatDate(s.submitted_at)}`
                            : "Awaiting response"}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={s.submitted_at ? "green" : "amber"}>
                          {s.submitted_at ? "Submitted" : "Pending"}
                        </Badge>
                        {s.submitted_at &&
                          s.answers &&
                          Object.keys(s.answers).length > 0 && (
                            <button
                              onClick={() =>
                                setExpandedAnswers(
                                  expandedAnswers === s.id ? null : s.id,
                                )
                              }
                              className="flex items-center gap-1 text-xs text-green-700 hover:text-green-800 font-medium"
                            >
                              {expandedAnswers === s.id ? (
                                <ChevronDown className="w-3 h-3" />
                              ) : (
                                <ChevronRight className="w-3 h-3" />
                              )}
                              Answers ({Object.keys(s.answers).length})
                            </button>
                          )}
                      </div>
                    </div>
                  </CardHeader>

                  {/* Answers panel */}
                  {expandedAnswers === s.id && s.answers && (
                    <CardBody className="border-t border-slate-100 bg-slate-50/50">
                      <div className="space-y-2">
                        {Object.entries(s.answers).map(([key, val]) => (
                          <div
                            key={key}
                            className="grid grid-cols-5 gap-2 text-sm"
                          >
                            <span className="col-span-2 text-slate-500 font-medium text-xs break-words">
                              {QUESTION_LABELS[key] || key.replace(/_/g, " ")}
                            </span>
                            <span className="col-span-3 text-slate-800">
                              {Array.isArray(val)
                                ? (val as string[]).join(", ")
                                : String(val ?? "—")}
                            </span>
                          </div>
                        ))}
                      </div>
                    </CardBody>
                  )}

                  <CardFooter>
                    <a
                      href={`/q/${s.token}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-green-700 hover:underline flex items-center gap-1"
                    >
                      <ExternalLink className="w-3 h-3" /> View client portal
                    </a>
                  </CardFooter>
                </Card>
              ))}

              {/* AI flags */}
              {flags.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-500" />
                    AI gap flags ({pendingFlags.length} pending)
                  </h3>
                  <div className="space-y-2">
                    {flags.map((flag) => (
                      <Card key={flag.id}>
                        <CardBody className="py-3">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                                  {flag.field_name}
                                </span>
                                <Badge
                                  variant={
                                    flag.severity === "required"
                                      ? "red"
                                      : "amber"
                                  }
                                >
                                  {flag.severity}
                                </Badge>
                                {flag.status !== "pending" && (
                                  <Badge
                                    variant={
                                      flag.status === "accepted"
                                        ? "green"
                                        : "gray"
                                    }
                                  >
                                    {flag.status}
                                  </Badge>
                                )}
                              </div>
                              <p className="text-sm text-slate-700">
                                {flag.reason}
                              </p>
                              <p className="text-xs text-slate-500 mt-1 italic">
                                Suggested: &quot;{flag.suggested_question}&quot;
                              </p>
                            </div>
                            {flag.status === "pending" && (
                              <div className="flex gap-2 flex-shrink-0">
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  onClick={() => acceptFlag(flag.id)}
                                  loading={loading === `flag_accept_${flag.id}`}
                                >
                                  Accept
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => dismissFlag(flag.id)}
                                  loading={
                                    loading === `flag_dismiss_${flag.id}`
                                  }
                                >
                                  Dismiss
                                </Button>
                                <Button
                                  size="sm"
                                  variant="danger"
                                  onClick={() => deleteFlag(flag.id)}
                                  loading={loading === `flag_delete_${flag.id}`}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  Delete
                                </Button>
                              </div>
                            )}
                            {flag.status !== "pending" && (
                              <div className="flex gap-2 flex-shrink-0">
                                <Button
                                  size="sm"
                                  variant="danger"
                                  onClick={() => deleteFlag(flag.id)}
                                  loading={loading === `flag_delete_${flag.id}`}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  Delete
                                </Button>
                              </div>
                            )}
                          </div>
                        </CardBody>
                      </Card>
                    ))}
                  </div>

                  {/* Batch follow-up button */}
                  {acceptedFlags.length > 0 && (
                    <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold text-amber-900">
                          {acceptedFlags.length} question
                          {acceptedFlags.length > 1 ? "s" : ""} ready to send
                        </p>
                        <p className="text-xs text-amber-700 mt-0.5">
                          Send a single follow-up email to{" "}
                          {project.client_email} with all accepted questions.
                        </p>
                      </div>
                      <Button
                        size="sm"
                        onClick={sendFollowUp}
                        loading={loading === "followup"}
                        disabled={loading === "followup"}
                        className="flex-shrink-0"
                      >
                        <Send className="w-3.5 h-3.5" /> Send Follow-up
                      </Button>
                    </div>
                  )}
                </div>
              )}
              {renderActionFeedback("clarificationCheck")}
              {renderActionFeedback("followUpSend")}
            </>
          )}
        </div>
      )}

      {/* ── ANALYSIS TAB ──────────────────────────────────────── */}
      {activeTab === "analysis" && (
        <div className="space-y-5">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Analysis Workspace
            </h2>
            <p className="text-sm text-slate-500">
              Review financial insights, live context data, and AI-generated
              feasibility outputs.
            </p>
          </div>
          {!latestSubmission ? (
            <Card>
              <CardBody className="text-center py-12">
                <p className="text-slate-500 text-sm">
                  Analysis becomes available after questionnaire submission.
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  Ask the client to submit the form, then return here.
                </p>
              </CardBody>
            </Card>
          ) : report ? (
            <>
              {/* Financial summary cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  {
                    label: "Total CAPEX",
                    value: formatCurrency(report.financial_model.capex_total),
                    icon: DollarSign,
                    color: "text-blue-600 bg-blue-50",
                  },
                  {
                    label: "Annual Revenue",
                    value: formatCurrency(
                      report.financial_model.total_annual_revenue,
                    ),
                    icon: TrendingUp,
                    color: "text-green-700 bg-green-50",
                  },
                  {
                    label: "EBITDA",
                    value: formatCurrency(report.financial_model.ebitda),
                    icon: BarChart3,
                    color: "text-purple-600 bg-purple-50",
                  },
                  {
                    label: "Payback Period",
                    value: `${report.financial_model.payback_years} Years`,
                    icon: Clock,
                    color: "text-amber-600 bg-amber-50",
                  },
                ].map(({ label, value, icon: Icon, color }) => (
                  <Card key={label} className="border-slate-200">
                    <CardBody className="flex items-center gap-3 py-4">
                      <div className={`p-2.5 rounded-xl ${color}`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 font-medium">
                          {label}
                        </p>
                        <p className="text-lg font-bold text-slate-900">
                          {value}
                        </p>
                      </div>
                    </CardBody>
                  </Card>
                ))}
              </div>

              {/* Charts row */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {cropChartData.length > 0 && (
                  <Card>
                    <CardHeader>
                      <h3 className="font-semibold text-slate-900 text-sm">
                        Crop revenue breakdown
                      </h3>
                    </CardHeader>
                    <CardBody>
                      <ResponsiveContainer width="100%" height={220}>
                        <BarChart
                          data={cropChartData}
                          margin={{ top: 4, right: 8, left: 0, bottom: 4 }}
                        >
                          <CartesianGrid
                            strokeDasharray="3 3"
                            stroke="#f1f5f9"
                          />
                          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                          <YAxis
                            tick={{ fontSize: 11 }}
                            tickFormatter={(v: any) =>
                              `${(Number(v ?? 0) / 1000).toFixed(0)}K`
                            }
                          />
                          <Tooltip
                            formatter={(v: any) =>
                              formatCurrency(Number(v ?? 0))
                            }
                          />
                          <Bar
                            dataKey="revenue"
                            fill="#1A5C38"
                            radius={[4, 4, 0, 0]}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardBody>
                  </Card>
                )}

                {costPieData.length > 0 && (
                  <Card>
                    <CardHeader>
                      <h3 className="font-semibold text-slate-900 text-sm">
                        Cost & investment breakdown
                      </h3>
                    </CardHeader>
                    <CardBody>
                      <ResponsiveContainer width="100%" height={220}>
                        <PieChart>
                          <Pie
                            data={costPieData}
                            cx="50%"
                            cy="50%"
                            outerRadius={80}
                            dataKey="value"
                            label={({ name }) => name}
                          >
                            {costPieData.map((_, i) => (
                              <Cell
                                key={i}
                                fill={CHART_COLORS[i % CHART_COLORS.length]}
                              />
                            ))}
                          </Pie>
                          <Tooltip
                            formatter={(v: any) =>
                              formatCurrency(Number(v ?? 0))
                            }
                          />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    </CardBody>
                  </Card>
                )}
              </div>

              {/* Technical analysis excerpt */}
              {report.sections.technical_analysis && (
                <Card>
                  <CardHeader className="flex items-center justify-between">
                    <h3 className="font-semibold text-slate-900 text-sm">
                      Technical analysis
                    </h3>
                    <Badge variant="purple">AI generated</Badge>
                  </CardHeader>
                  <CardBody>
                    <MarkdownRenderer
                      content={report.sections.technical_analysis.content}
                      className="max-h-64 overflow-y-auto"
                    />
                  </CardBody>
                </Card>
              )}

              {/* Regenerate */}
              <div className="flex justify-end">
                <Button
                  variant="secondary"
                  onClick={() => generateReport()}
                  loading={loading === "report"}
                  size="sm"
                >
                  <Zap className="w-4 h-4" /> Regenerate report
                </Button>
              </div>

              {/* Climate and Market Data Live */}
              <div className="mt-8">
                <Card>
                  <CardHeader className="flex items-center justify-between border-b pb-4">
                    <div>
                      <h3 className="font-semibold text-slate-900 text-sm">
                        Live Context Data
                      </h3>
                      <p className="text-xs text-slate-500 font-normal">
                        Market prices and real historical climate data
                      </p>
                    </div>
                    {!analysisData &&
                      !report?.sections?.context_market_data && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={fetchAnalysisData}
                          loading={loading === "analysisData"}
                          disabled={loading === "analysisData"}
                        >
                          Fetch Market & Climate Data
                        </Button>
                      )}
                  </CardHeader>
                  {(analysisData || report?.sections?.context_market_data) && (
                    <CardBody className="max-h-[600px] overflow-y-auto space-y-8 text-sm text-slate-700 bg-slate-50/50 p-6">
                      <div className="space-y-4">
                        <div className="flex items-center gap-2 pb-2 border-b border-slate-200">
                          <Activity className="w-5 h-5 text-blue-600" />
                          <h4 className="font-bold text-slate-900 text-lg">
                            Live Market Research
                          </h4>
                        </div>
                        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                          <MarkdownRenderer
                            content={
                              analysisData?.marketResearch ||
                              report?.sections?.context_market_data?.content ||
                              ""
                            }
                          />
                        </div>
                      </div>
                      <div className="space-y-4">
                        <div className="flex items-center gap-2 pb-2 border-b border-slate-200">
                          <CloudRain className="w-5 h-5 text-indigo-600" />
                          <h4 className="font-bold text-slate-900 text-lg">
                            Historical Climate Data (Monthly Avg 2020-2025)
                          </h4>
                        </div>
                        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm overflow-x-auto overflow-y-hidden">
                          <MarkdownRenderer
                            content={
                              analysisData?.climateData ||
                              report?.sections?.context_climate_data?.content ||
                              ""
                            }
                          />
                        </div>
                      </div>
                    </CardBody>
                  )}
                </Card>
              </div>
            </>
          ) : (
            <>
              <Card>
                <CardHeader>
                  <h3 className="font-semibold text-slate-900 text-sm">
                    AI analysis
                  </h3>
                </CardHeader>
                <CardBody className="space-y-4">
                  <p className="text-sm text-slate-600">
                    The analysis engine runs automatically when you generate the
                    report. It covers technical feasibility, climate risk,
                    financial projections, and live market research.
                  </p>
                  <Button
                    onClick={() => generateReport()}
                    loading={loading === "report"}
                    disabled={loading === "report"}
                  >
                    <Zap className="w-4 h-4" /> Run analysis & generate report
                  </Button>
                </CardBody>
              </Card>

              {/* Climate and Market Data Live (Unpublished State) */}
              <Card className="mt-8 bg-slate-50/50">
                <CardHeader className="flex items-center justify-between border-b pb-4">
                  <div>
                    <h3 className="font-semibold text-slate-900 text-sm">
                      Live Context Data
                    </h3>
                    <p className="text-xs text-slate-500 font-normal mt-0.5">
                      Explore market info and climate data without generating
                    </p>
                  </div>
                  {!analysisData &&
                    (!report || !report.sections?.context_market_data) && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={fetchAnalysisData}
                        loading={loading === "analysisData"}
                        disabled={loading === "analysisData"}
                      >
                        Fetch Market & Climate Data
                      </Button>
                    )}
                </CardHeader>
                {(analysisData ||
                  (report && report.sections?.context_market_data)) && (
                  <CardBody className="max-h-[600px] overflow-y-auto space-y-8 text-sm text-slate-700 bg-slate-50/50 p-6">
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 pb-2 border-b border-slate-200">
                        <Activity className="w-5 h-5 text-blue-600" />
                        <h4 className="font-bold text-slate-900 text-lg">
                          Market Research
                        </h4>
                      </div>
                      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                        <MarkdownRenderer
                          content={
                            analysisData?.marketResearch ||
                            report?.sections?.context_market_data?.content ||
                            ""
                          }
                        />
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 pb-2 border-b border-slate-200">
                        <CloudRain className="w-5 h-5 text-indigo-600" />
                        <h4 className="font-bold text-slate-900 text-lg">
                          Historical Climate Data (Avg 2020-2025)
                        </h4>
                      </div>
                      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm overflow-x-auto overflow-y-hidden">
                        <MarkdownRenderer
                          content={
                            analysisData?.climateData ||
                            report?.sections?.context_climate_data?.content ||
                            ""
                          }
                        />
                      </div>
                    </div>
                  </CardBody>
                )}
              </Card>
            </>
          )}
          {renderActionFeedback("analysisFetch")}
        </div>
      )}

      {/* ── REPORT TAB ────────────────────────────────────────── */}
      {activeTab === "report" && (
        <div className="max-w-3xl space-y-6">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Report Builder
            </h2>
            <p className="text-sm text-slate-500">
              Generate and refine sections into a client-ready feasibility
              report.
            </p>
          </div>
          {!report ? (
            <div className="space-y-6">
              {/* Report Preparation Header */}
              <div className="bg-gradient-to-r from-green-700 to-green-600 rounded-2xl p-6 text-white shadow-lg flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold">
                    Feasibility Report Status
                  </h2>
                  <p className="text-green-50/80 text-sm mt-1">
                    {latestSubmission
                      ? "Questionnaire data received. AI draft is ready to be generated."
                      : "Awaiting questionnaire submission before report generation."}
                  </p>
                </div>
                {latestSubmission && (
                  <Button
                    variant="secondary"
                    className="bg-white text-green-700 hover:bg-green-50 border-none shadow-sm"
                    onClick={() => generateReport()}
                    loading={loading === "report"}
                    disabled={loading === "report"}
                  >
                    <Zap className="w-4 h-4 mr-2" /> Generate Full Report
                  </Button>
                )}
              </div>

              {/* Report Skeleton / Sections List */}
              <div className="grid gap-4">
                {[
                  {
                    key: "executive_summary",
                    title: "Executive Summary",
                    desc: "High-level project overview and strategic rationale.",
                  },
                  {
                    key: "market_analysis",
                    title: "Market & Economic Analysis",
                    desc: "Local demand, pricing strategy, and competitive landscape.",
                  },
                  {
                    key: "technical_analysis",
                    title: "Technical Feasibility",
                    desc: "Climate compatibility, technology selection, and water/power analysis.",
                  },
                  {
                    key: "financial_projection",
                    title: "Financial Projections",
                    desc: "CAPEX, Operating costs, Revenue forecasts, and ROI/Payback.",
                  },
                  {
                    key: "risk_mitigation",
                    title: "Risk Assessment",
                    desc: "Climate, operational, and commercial risks with mitigation plans.",
                  },
                  {
                    key: "conclusion",
                    title: "Conclusion & Recommendations",
                    desc: "Final feasibility verdict and suggested next steps.",
                  },
                ].map((sec) => (
                  <Card
                    key={sec.key}
                    className="group hover:border-green-200 transition-colors"
                  >
                    <CardBody className="flex items-center justify-between p-4">
                      <div className="flex gap-4 items-center">
                        <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-green-50 group-hover:text-green-600 transition-colors">
                          <FileText className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="text-sm font-semibold text-slate-900">
                            {sec.title}
                          </h4>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {sec.desc}
                          </p>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() =>
                          generateReport(sec.key as ReportSectionKey)
                        }
                        disabled={!latestSubmission}
                        loading={loading === `report_${sec.key}`}
                      >
                        {latestSubmission
                          ? "Generate Section"
                          : "Awaiting Data"}
                      </Button>
                    </CardBody>
                  </Card>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-lg font-bold text-slate-900">
                  Report Draft
                </h2>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => generateReport()}
                    loading={loading === "report"}
                    disabled={loading === "report"}
                  >
                    <Zap className="w-3.5 h-3.5 mr-1" /> Regenerate All
                  </Button>
                </div>
              </div>
              <ReportEditor
                report={report}
                projectId={project.id}
                onUpdate={setReport}
              />
            </div>
          )}
          {renderActionFeedback("reportGeneration")}
        </div>
      )}
    </div>
  );
}

// ── Inline schedule call card ─────────────────────────────────────────
function ScheduleCallCard({
  projectId,
  onScheduled,
}: {
  projectId: string;
  onScheduled: (link: string) => void;
}) {
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function schedule() {
    if (!date || !time) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const scheduledAt = new Date(`${date}T${time}:00`).toISOString();
      const res = await fetch("/api/calendar/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, scheduledAt }),
      });
      const data = await res.json();
      if (data.error === "google_not_connected") {
        setErrorMsg(
          "Your Google account is not connected. Please sign in with Google to enable calendar invites.",
        );
        return;
      }
      if (!res.ok) {
        setErrorMsg(
          data.error ||
            "Failed to schedule. Make sure your Google account has calendar permissions.",
        );
        return;
      }
      if (data.meetLink) onScheduled(data.meetLink);
    } catch {
      setErrorMsg("Unexpected error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-3 rounded-lg border border-slate-200">
      <div className="flex items-center gap-3 mb-3">
        <Calendar className="w-4 h-4 text-slate-500" />
        <p className="text-sm font-medium text-slate-800">
          Schedule intro call (Google Meet)
        </p>
      </div>
      <div className="flex gap-2">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="flex-1 px-3 py-1.5 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-green-500"
        />
        <input
          type="time"
          value={time}
          onChange={(e) => setTime(e.target.value)}
          className="w-28 px-3 py-1.5 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-green-500"
        />
        <Button
          size="sm"
          onClick={schedule}
          loading={loading}
          disabled={!date || !time}
        >
          Schedule
        </Button>
      </div>
      {errorMsg && (
        <p className="mt-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {errorMsg}
        </p>
      )}
    </div>
  );
}
