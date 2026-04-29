"use client";
import { useRef, useState, useCallback } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader, CardFooter } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Card";
import { ReportEditor } from "@/components/report/ReportEditor";
import { MarkdownRenderer } from "@/components/ui/MarkdownRenderer";
import { ToastProvider, toast } from "@/components/ui/Toast";
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
  Plus,
  X,
  ChevronUp,
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

// Analysis Section Import
import { AnalysisTab } from "@/components/analysis/AnalysisTab";

const QUESTION_LABELS: Record<string, string> = {
  q1: "Legal Entity / Company Name",
  q2: "Primary Contact Person",
  q3: "Email / WhatsApp",
  q4: "GPS Coordinates or Google Maps Link",
  q5: "Total Land Area (sqm)",
  q6: "Primary Water Source",
  q7: "Water Availability (litres/day)",
  q8: "Water Analysis Report Available?",
  q9: "Water Analysis Report Upload",
  q10: "Power Source",
  q11: "Available Power Capacity (KVA)",
  q12: "Internet Connectivity at Site",
  q13: "Can a 40ft Container Truck Reach Site?",
  q14: "Target Crops",
  q15: "Other Crops (specify)",
  q16: "Desired Technology Level",
  q17: "Agro-Tourism / Farm Experience Planned?",
  q18: "Primary Target Market",
  q19: "On-Site Cold Storage Required?",
  q20: "Budget for Phase 1",
  q21: "Target Construction Start Date",
  q22: "Other Information / Requirements",
};

// Group answers by category for better display
const ANSWER_SECTIONS = [
  {
    title: "Client & Site Identity",
    icon: Users,
    keys: ["q1", "q2", "q3", "q4", "q5"],
  },
  {
    title: "Infrastructure & Utilities",
    icon: Zap,
    keys: ["q6", "q7", "q8", "q9", "q10", "q11", "q12", "q13"],
  },
  {
    title: "Crops & Technology",
    icon: Wheat,
    keys: ["q14", "q15", "q16", "q17"],
  },
  {
    title: "Commercial & Logistics",
    icon: DollarSign,
    keys: ["q18", "q19", "q20", "q21", "q22"],
  },
];

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

// Pipeline stages
const PIPELINE_STEPS = [
  {
    key: "call",
    label: "Intro Call",
    doneStatuses: [
      "call_completed",
      "questionnaire_sent",
      "questionnaire_submitted",
      "clarification_sent",
      "analysis_running",
      "report_draft",
      "report_published",
      "completed",
    ],
  },
  {
    key: "q",
    label: "Questionnaire",
    doneStatuses: [
      "questionnaire_submitted",
      "clarification_sent",
      "analysis_running",
      "report_draft",
      "report_published",
      "completed",
    ],
  },
  {
    key: "ai",
    label: "Analysis",
    doneStatuses: [
      "analysis_running",
      "report_draft",
      "report_published",
      "completed",
    ],
  },
  {
    key: "rep",
    label: "Report",
    doneStatuses: ["report_published", "completed"],
  },
  { key: "pay", label: "Delivered", doneStatuses: ["completed"] },
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
  const [flags, setFlags] = useState<AIFlag[]>(initial.ai_flags || []);
  const [expandedSubmission, setExpandedSubmission] = useState<string | null>(
    null,
  );
  const [analysisData, setAnalysisData] = useState<{
    climateData: string;
    marketResearch: string;
  } | null>(null);

  // Manual gap form state
  const [showAddGapForm, setShowAddGapForm] = useState(false);
  const [newGap, setNewGap] = useState({
    field_name: "",
    reason: "",
    suggested_question: "",
    severity: "recommended" as "required" | "recommended",
  });

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

  // ── Actions ──────────────────────────────────────────────────────────

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
    } catch (e: unknown) {
      toast.error(
        e instanceof Error ? e.message : "Failed to send questionnaire",
      );
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
        // Merge: keep existing, add new ones by id
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
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Gap check failed");
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
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to send follow-up");
    } finally {
      setLoading(null);
    }
  }

  async function generateReport(specificSection?: ReportSectionKey) {
    if (!latestSubmission) {
      toast.error("Please collect questionnaire data before generating a report.");
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
      // Refresh report
      const pRes = await fetch(`/api/projects/${project.id}`);
      const updated = await pRes.json();
      if (updated.reports?.[0]) setReport(updated.reports[0]);
      setProject((p) => ({ ...p, status: "report_draft" }));
      setActiveTab("report");
      if (!specificSection) {
        toast.success(
          "Report draft generated — review sections in the Report tab",
        );
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Report generation failed");
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
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to accept gap");
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
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to dismiss gap");
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
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to delete gap");
    } finally {
      setLoading(null);
    }
  }

  async function addManualGap() {
    if (!newGap.field_name || !newGap.reason || !newGap.suggested_question) {
      toast.error("Please fill in all fields");
      return;
    }
    setLoading("add_gap");
    try {
      const res = await fetch("/api/ai/flags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: project.id,
          submissionId: latestSubmission?.id,
          ...newGap,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setFlags((f) => [...f, data.flag]);
      setNewGap({
        field_name: "",
        reason: "",
        suggested_question: "",
        severity: "recommended",
      });
      setShowAddGapForm(false);
      toast.success("Custom gap added");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to add gap");
    } finally {
      setLoading(null);
    }
  }

  async function fetchAnalysisData() {
    setLoading("analysisData");
    try {
      const res = await fetch(`/api/analysis/data/${project.id}`);
      if (!res.ok) throw new Error("Fetch failed");
      setAnalysisData(await res.json());
      toast.success("Market and climate data loaded");
    } catch (e: unknown) {
      toast.error(
        e instanceof Error ? e.message : "Failed to fetch analysis data",
      );
    } finally {
      setLoading(null);
    }
  }

  const recommendedAction = (() => {
    if (!submissions.length) {
      return {
        title: "Send the initial questionnaire",
        description:
          "Kick off data collection so the client can provide baseline farm details.",
        buttonLabel: "Send Questionnaire",
        action: sendQuestionnaire,
        disabled: loading === "send_q",
      };
    }
    if (!latestSubmission) {
      return {
        title: "Awaiting questionnaire submission",
        description:
          "The form link has been sent. Follow up with the client if no response arrives.",
        buttonLabel: "View Questionnaire Tab",
        action: () => setActiveTab("questionnaire"),
        disabled: false,
      };
    }
    if (!flags.length) {
      return {
        title: "Run AI gap check",
        description:
          "Detect missing critical inputs before analysis and report drafting.",
        buttonLabel: "Run Gap Check",
        action: runClarificationCheck,
        disabled: loading === "clarify",
      };
    }
    if (pendingFlags.length > 0) {
      return {
        title: `Review ${pendingFlags.length} flagged gap(s)`,
        description:
          "Accept or dismiss AI-identified data gaps before proceeding.",
        buttonLabel: "Review Gaps",
        action: () => setActiveTab("questionnaire"),
        disabled: false,
      };
    }
    if (acceptedFlags.length > 0) {
      return {
        title: "Send follow-up clarification",
        description:
          "Request the accepted clarification questions from the client.",
        buttonLabel: "Send Follow-up",
        action: sendFollowUp,
        disabled: loading === "followup",
      };
    }
    if (!report) {
      return {
        title: "Generate feasibility report draft",
        description: "All data collected — generate the AI draft report now.",
        buttonLabel: "Generate Report",
        action: () => generateReport(),
        disabled: loading === "report",
      };
    }
    return {
      title: "Review and refine draft report",
      description:
        "Open the report tab to finalise narrative, numbers, and publish.",
      buttonLabel: "Open Report",
      action: () => setActiveTab("report"),
      disabled: false,
    };
  })();

  const TABS = [
    { id: "overview" as const, label: "Overview" },
    {
      id: "questionnaire" as const,
      label: "Questionnaire",
      badge: pendingFlags.length || undefined,
    },
    { 
      id: "analysis" as const, 
      label: "Analysis",
      disabled: !latestSubmission && !report 
    },
    { 
      id: "report" as const, 
      label: "Report",
      disabled: !latestSubmission && !report
    },
  ];

  const currency =
    ((project as Record<string, unknown>).currency as string) || "USD";

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
          name: "Growing/yr",
          value: report.financial_model.growing_cost_annual,
        },
        {
          name: "Manpower/yr",
          value: report.financial_model.manpower_cost_annual,
        },
      ].filter((d) => d.value > 0)
    : [];

  return (
    <>
      <ToastProvider />
      <div className="px-8 py-6">
        {/* ── Next action banner ──────────────────────────────────── */}
        <Card className="mb-6 border-green-200 bg-gradient-to-r from-green-50 to-emerald-50">
          <CardBody className="flex items-center justify-between gap-4 py-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-green-700">
                Next Recommended Step
              </p>
              <h3 className="text-sm font-semibold text-slate-900 mt-1">
                {recommendedAction.title}
              </h3>
              <p className="text-xs text-slate-600 mt-0.5">
                {recommendedAction.description}
              </p>
            </div>
            <Button
              size="sm"
              onClick={recommendedAction.action}
              disabled={recommendedAction.disabled}
              loading={
                recommendedAction.disabled &&
                (loading === "send_q" ||
                  loading === "clarify" ||
                  loading === "followup" ||
                  loading === "report")
              }
            >
              {recommendedAction.buttonLabel}
            </Button>
          </CardBody>
        </Card>

        {/* ── Tabs ───────────────────────────────────────────────── */}
        <div className="flex gap-1 border-b border-slate-200 mb-6">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => !tab.disabled && setActiveTab(tab.id)}
              disabled={tab.disabled}
              className={`px-4 py-2.5 text-sm font-medium rounded-t-lg border-b-2 transition-colors flex items-center gap-2 ${
                tab.disabled 
                  ? "opacity-40 cursor-not-allowed border-transparent text-slate-400"
                  : activeTab === tab.id
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

        {/* ══════════════════════════════════════════════════════════
            OVERVIEW TAB
        ══════════════════════════════════════════════════════════ */}
        {activeTab === "overview" && (
          <div className="grid grid-cols-3 gap-5">
            <div className="col-span-2 space-y-4">
              {/* Pipeline */}
              <Card>
                <CardHeader>
                  <h3 className="font-semibold text-slate-900 text-sm">
                    Project Pipeline
                  </h3>
                </CardHeader>
                <CardBody className="py-6 px-4">
                  <div className="relative flex items-center justify-between w-full">
                    <div className="absolute left-8 right-8 top-1/2 -translate-y-1/2 h-1 bg-slate-100 rounded-full z-0" />
                    {PIPELINE_STEPS.map((step, i, arr) => {
                      const done = step.doneStatuses.includes(project.status);
                      const isActive =
                        done &&
                        !arr[i + 1]?.doneStatuses.includes(project.status);
                      return (
                        <div
                          key={step.key}
                          className="relative z-10 flex flex-col items-center gap-2"
                        >
                          <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold text-sm border-2 transition-all ${
                              isActive
                                ? "bg-green-600 border-green-600 text-white shadow-md shadow-green-200"
                                : done
                                  ? "bg-green-100 border-green-600 text-green-700"
                                  : "bg-white border-slate-300 text-slate-400"
                            }`}
                          >
                            {done ? (
                              isActive ? (
                                i + 1
                              ) : (
                                <CheckCircle className="w-4 h-4" />
                              )
                            ) : (
                              i + 1
                            )}
                          </div>
                          <span
                            className={`text-[11px] uppercase tracking-wider font-semibold ${
                              isActive
                                ? "text-green-700"
                                : done
                                  ? "text-slate-700"
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
                  {/* Google Meet link or schedule */}
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

                  {/* Questionnaire */}
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
                      disabled={!!latestSubmission}
                    >
                      Send
                    </Button>
                  </div>

                  {/* AI gap check */}
                  {latestSubmission && (
                    <div className="flex items-center justify-between p-3 rounded-lg border border-slate-200">
                      <div className="flex items-center gap-3">
                        <Zap className="w-4 h-4 text-purple-500" />
                        <div>
                          <p className="text-sm font-medium text-slate-800">
                            Run AI gap check
                          </p>
                          <p className="text-xs text-slate-500">
                            {flags.length > 0
                              ? `${pendingFlags.length} gap(s) pending review`
                              : "Check questionnaire for missing data"}
                          </p>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={runClarificationCheck}
                        loading={loading === "clarify"}
                      >
                        Run
                      </Button>
                    </div>
                  )}

                  {/* Generate report */}
                  {latestSubmission && (
                    <div className="flex items-center justify-between p-3 rounded-lg border border-slate-200">
                      <div className="flex items-center gap-3">
                        <FileText className="w-4 h-4 text-green-600" />
                        <div>
                          <p className="text-sm font-medium text-slate-800">
                            Generate feasibility report
                          </p>
                          <p className="text-xs text-slate-500">
                            {report
                              ? "Report exists — regenerate all sections"
                              : "AI-draft all sections from project data"}
                          </p>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => generateReport()}
                        loading={loading === "report"}
                      >
                        {report ? "Regenerate" : "Generate"}
                      </Button>
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
                    Project Details
                  </h3>
                </CardHeader>
                <CardBody className="space-y-3">
                  {[
                    {
                      icon: Users,
                      label: "Client",
                      value: project.client_name,
                    },
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
                      value: project.budget_range
                        ? `${project.budget_range} ${currency}`
                        : "—",
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
                      Call Notes
                    </h3>
                  </CardHeader>
                  <CardBody>
                    <p className="text-sm text-slate-600 whitespace-pre-wrap leading-relaxed">
                      {project.consultant_notes}
                    </p>
                  </CardBody>
                </Card>
              )}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════
            QUESTIONNAIRE TAB
        ══════════════════════════════════════════════════════════ */}
        {activeTab === "questionnaire" && (
          <div className="max-w-3xl space-y-5">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  Questionnaire & Data Review
                </h2>
                <p className="text-sm text-slate-500 mt-0.5">
                  Review client answers, identify gaps, and request
                  clarifications.
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={sendQuestionnaire}
                  loading={loading === "send_q"}
                  disabled={loading === "send_q"}
                >
                  <Send className="w-3.5 h-3.5" />
                  {submissions.length > 0 ? "Resend Link" : "Send Form"}
                </Button>
                {latestSubmission && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={runClarificationCheck}
                    loading={loading === "clarify"}
                  >
                    <Zap className="w-3.5 h-3.5" /> AI Gap Check
                  </Button>
                )}
              </div>
            </div>

            {/* Submissions */}
            {submissions.length === 0 ? (
              <Card>
                <CardBody className="text-center py-12">
                  <Send className="w-8 h-8 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-500 text-sm font-medium">
                    No questionnaire sent yet
                  </p>
                  <p className="text-xs text-slate-400 mt-1 mb-4">
                    Send the initial form to start collecting project inputs
                    from the client.
                  </p>
                  <Button
                    onClick={sendQuestionnaire}
                    loading={loading === "send_q"}
                  >
                    <Send className="w-4 h-4" /> Send Questionnaire
                  </Button>
                </CardBody>
              </Card>
            ) : (
              submissions.map((s) => {
                const answerCount = Object.keys(s.answers || {}).length;
                const isExpanded = expandedSubmission === s.id;

                return (
                  <Card
                    key={s.id}
                    className={s.submitted_at ? "border-green-200" : ""}
                  >
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-sm text-slate-900">
                            {s.round === 1
                              ? "Initial Questionnaire"
                              : `Follow-up Round ${s.round}`}
                          </p>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {s.submitted_at
                              ? `Submitted ${formatDate(s.submitted_at)} · ${answerCount} answers`
                              : "Awaiting response from client"}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={s.submitted_at ? "green" : "amber"}>
                            {s.submitted_at ? "Submitted" : "Pending"}
                          </Badge>
                          {s.submitted_at && answerCount > 0 && (
                            <button
                              onClick={() =>
                                setExpandedSubmission(isExpanded ? null : s.id)
                              }
                              className="flex items-center gap-1 text-xs text-green-700 hover:text-green-800 font-medium px-2 py-1 rounded-lg hover:bg-green-50 transition-colors"
                            >
                              {isExpanded ? (
                                <ChevronUp className="w-3 h-3" />
                              ) : (
                                <ChevronDown className="w-3 h-3" />
                              )}
                              {isExpanded ? "Hide" : "View"} Answers
                            </button>
                          )}
                        </div>
                      </div>
                    </CardHeader>

                    {/* ── Grouped answers display ─────────────────── */}
                    {isExpanded && s.answers && (
                      <CardBody className="border-t border-slate-100 bg-slate-50/30 p-0">
                        {ANSWER_SECTIONS.map((section) => {
                          const sectionAnswers = section.keys
                            .filter(
                              (k) =>
                                s.answers[k] !== undefined &&
                                s.answers[k] !== "",
                            )
                            .map((k) => ({
                              key: k,
                              label: QUESTION_LABELS[k] || k,
                              value: s.answers[k],
                            }));

                          if (sectionAnswers.length === 0) return null;

                          const SectionIcon = section.icon;
                          return (
                            <div
                              key={section.title}
                              className="border-b border-slate-100 last:border-0"
                            >
                              <div className="flex items-center gap-2 px-6 py-3 bg-slate-50">
                                <SectionIcon className="w-4 h-4 text-slate-400" />
                                <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                                  {section.title}
                                </p>
                              </div>
                              <div className="px-6 py-3 space-y-0">
                                {sectionAnswers.map(({ key, label, value }) => (
                                  <div
                                    key={key}
                                    className="grid grid-cols-5 gap-4 py-2.5 border-b border-slate-50 last:border-0"
                                  >
                                    <span className="col-span-2 text-xs font-medium text-slate-500 pt-0.5">
                                      {label}
                                    </span>
                                    <span className="col-span-3 text-sm text-slate-800 font-medium">
                                      {Array.isArray(value)
                                        ? (value as string[]).join(", ")
                                        : value === true
                                          ? "✓ Yes"
                                          : value === false
                                            ? "✗ No"
                                            : String(value ?? "—")}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })}

                        {/* Any answers not in sections */}
                        {(() => {
                          const knownKeys = ANSWER_SECTIONS.flatMap(
                            (s) => s.keys,
                          );
                          const extra = Object.entries(s.answers).filter(
                            ([k]) =>
                              !knownKeys.includes(k) &&
                              s.answers[k] !== undefined,
                          );
                          if (!extra.length) return null;
                          return (
                            <div>
                              <div className="flex items-center gap-2 px-6 py-3 bg-slate-50 border-b border-slate-100">
                                <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                                  Additional Answers
                                </p>
                              </div>
                              <div className="px-6 py-3 space-y-0">
                                {extra.map(([k, v]) => (
                                  <div
                                    key={k}
                                    className="grid grid-cols-5 gap-4 py-2.5 border-b border-slate-50 last:border-0"
                                  >
                                    <span className="col-span-2 text-xs font-medium text-slate-500">
                                      {k}
                                    </span>
                                    <span className="col-span-3 text-sm text-slate-800">
                                      {String(v)}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })()}
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
                );
              })
            )}

            {/* ── AI Flags / Gaps ───────────────────────────────── */}
            {(latestSubmission || flags.length > 0) && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-500" />
                    Data Gaps
                    {flags.length > 0 && (
                      <span className="text-xs text-slate-500 font-normal">
                        ({pendingFlags.length} pending · {acceptedFlags.length}{" "}
                        accepted ·{" "}
                        {flags.filter((f) => f.status === "dismissed").length}{" "}
                        dismissed)
                      </span>
                    )}
                  </h3>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowAddGapForm((v) => !v)}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Custom Gap
                  </Button>
                </div>

                {/* Manual gap form */}
                {showAddGapForm && (
                  <Card className="border-dashed border-amber-300 bg-amber-50/30">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-slate-800">
                          Add Custom Data Gap
                        </p>
                        <button onClick={() => setShowAddGapForm(false)}>
                          <X className="w-4 h-4 text-slate-400" />
                        </button>
                      </div>
                    </CardHeader>
                    <CardBody className="space-y-3">
                      <div>
                        <label className="text-xs font-medium text-slate-600 block mb-1">
                          Field / Topic <span className="text-red-500">*</span>
                        </label>
                        <input
                          className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-green-500"
                          placeholder="e.g. Water TDS/EC reading, Land ownership documents"
                          value={newGap.field_name}
                          onChange={(e) =>
                            setNewGap((g) => ({
                              ...g,
                              field_name: e.target.value,
                            }))
                          }
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-slate-600 block mb-1">
                          Why is this needed?{" "}
                          <span className="text-red-500">*</span>
                        </label>
                        <textarea
                          rows={2}
                          className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
                          placeholder="Explain why this information is critical for the analysis..."
                          value={newGap.reason}
                          onChange={(e) =>
                            setNewGap((g) => ({ ...g, reason: e.target.value }))
                          }
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-slate-600 block mb-1">
                          Question to ask client{" "}
                          <span className="text-red-500">*</span>
                        </label>
                        <textarea
                          rows={2}
                          className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
                          placeholder="Could you please provide the latest water analysis report showing EC, pH and TDS values?"
                          value={newGap.suggested_question}
                          onChange={(e) =>
                            setNewGap((g) => ({
                              ...g,
                              suggested_question: e.target.value,
                            }))
                          }
                        />
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex gap-2">
                          {(["required", "recommended"] as const).map((sev) => (
                            <button
                              key={sev}
                              type="button"
                              onClick={() =>
                                setNewGap((g) => ({ ...g, severity: sev }))
                              }
                              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                                newGap.severity === sev
                                  ? sev === "required"
                                    ? "bg-red-100 border-red-400 text-red-700"
                                    : "bg-amber-100 border-amber-400 text-amber-700"
                                  : "bg-white border-slate-300 text-slate-500 hover:border-slate-400"
                              }`}
                            >
                              {sev === "required"
                                ? "🔴 Required"
                                : "🟡 Recommended"}
                            </button>
                          ))}
                        </div>
                        <div className="ml-auto flex gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setShowAddGapForm(false)}
                          >
                            Cancel
                          </Button>
                          <Button
                            size="sm"
                            onClick={addManualGap}
                            loading={loading === "add_gap"}
                          >
                            <Plus className="w-3.5 h-3.5" /> Add Gap
                          </Button>
                        </div>
                      </div>
                    </CardBody>
                  </Card>
                )}

                {flags.length === 0 && (
                  <Card>
                    <CardBody className="text-center py-8">
                      <p className="text-sm text-slate-500">
                        No gaps flagged yet.{" "}
                        {latestSubmission
                          ? "Run the AI gap check or add a custom gap above."
                          : "Send the questionnaire first."}
                      </p>
                    </CardBody>
                  </Card>
                )}

                {/* Pending gaps */}
                {pendingFlags.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                      Pending Review ({pendingFlags.length})
                    </p>
                    {pendingFlags.map((flag) => (
                      <FlagCard
                        key={flag.id}
                        flag={flag}
                        loading={loading}
                        onAccept={() => acceptFlag(flag.id)}
                        onDismiss={() => dismissFlag(flag.id)}
                        onDelete={() => deleteFlag(flag.id)}
                      />
                    ))}
                  </div>
                )}

                {/* Accepted gaps */}
                {acceptedFlags.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                      Accepted — To Send ({acceptedFlags.length})
                    </p>
                    {acceptedFlags.map((flag) => (
                      <FlagCard
                        key={flag.id}
                        flag={flag}
                        loading={loading}
                        onDelete={() => deleteFlag(flag.id)}
                      />
                    ))}
                  </div>
                )}

                {/* Dismissed */}
                {flags.filter((f) => f.status === "dismissed").length > 0 && (
                  <details className="cursor-pointer">
                    <summary className="text-xs font-semibold text-slate-400 uppercase tracking-wide py-1">
                      Dismissed (
                      {flags.filter((f) => f.status === "dismissed").length})
                    </summary>
                    <div className="space-y-2 mt-2">
                      {flags
                        .filter((f) => f.status === "dismissed")
                        .map((flag) => (
                          <FlagCard
                            key={flag.id}
                            flag={flag}
                            loading={loading}
                            onDelete={() => deleteFlag(flag.id)}
                          />
                        ))}
                    </div>
                  </details>
                )}

                {/* Follow-up CTA */}
                {acceptedFlags.length > 0 && (
                  <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-amber-900">
                        {acceptedFlags.length} question
                        {acceptedFlags.length > 1 ? "s" : ""} ready to send
                      </p>
                      <p className="text-xs text-amber-700 mt-0.5">
                        Send a follow-up email to {project.client_email} with
                        all accepted questions.
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
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════
            ANALYSIS TAB
        ══════════════════════════════════════════════════════════ */}
        {activeTab === "analysis" && (
          <AnalysisTab
            project={project}
            report={report}
            currency={currency}
            onGenerateReport={() => generateReport()}
            loadingReport={loading === "report"}
          />
        )}

        {/* ══════════════════════════════════════════════════════════
            REPORT TAB
        ══════════════════════════════════════════════════════════ */}
        {activeTab === "report" && (
          <div className="max-w-3xl space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                Report Builder
              </h2>
              <p className="text-sm text-slate-500">
                Generate, edit, and publish the client-ready feasibility report.
              </p>
            </div>

            {!report ? (
              <div className="space-y-5">
                <div className="bg-gradient-to-r from-green-700 to-green-600 rounded-2xl p-6 text-white shadow-lg flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold">Feasibility Report</h2>
                    <p className="text-green-50/80 text-sm mt-1">
                      {latestSubmission
                        ? "Questionnaire data received — generate the AI draft now."
                        : "Send and collect the questionnaire before generating."}
                    </p>
                  </div>
                  {latestSubmission && (
                    <Button
                      variant="secondary"
                      className="bg-white text-green-700 hover:bg-green-50 border-none shadow-sm"
                      onClick={() => generateReport()}
                      loading={loading === "report"}
                    >
                      <Zap className="w-4 h-4 mr-2" /> Generate Full Report
                    </Button>
                  )}
                </div>

                {/* Section skeleton */}
                <div className="grid gap-3">
                  {[
                    {
                      key: "executive_summary",
                      title: "Executive Summary",
                      desc: "High-level overview and strategic rationale.",
                    },
                    {
                      key: "market_analysis",
                      title: "Market & Economic Analysis",
                      desc: "Demand, pricing strategy, and competitive landscape.",
                    },
                    {
                      key: "technical_analysis",
                      title: "Technical Feasibility",
                      desc: "Climate, technology selection, water & power analysis.",
                    },
                    {
                      key: "financial_projection",
                      title: "Financial Projections",
                      desc: "CAPEX, operating costs, revenue forecasts, ROI.",
                    },
                    {
                      key: "risk_mitigation",
                      title: "Risk Assessment",
                      desc: "Climate, operational, and commercial risks.",
                    },
                    {
                      key: "conclusion",
                      title: "Conclusion & Recommendations",
                      desc: "Feasibility verdict and next steps.",
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
                <div className="flex items-center justify-between">
                  <p className="text-sm text-slate-500">
                    {
                      Object.keys(report.sections).filter(
                        (k) =>
                          ![
                            "context_market_data",
                            "context_climate_data",
                          ].includes(k),
                      ).length
                    }{" "}
                    sections generated
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => generateReport()}
                    loading={loading === "report"}
                  >
                    <Zap className="w-3.5 h-3.5 mr-1" /> Regenerate All
                  </Button>
                </div>
                <ReportEditor
                  report={report}
                  projectId={project.id}
                  onUpdate={setReport}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}

// ── Flag Card sub-component ───────────────────────────────────────────
function FlagCard({
  flag,
  loading,
  onAccept,
  onDismiss,
  onDelete,
}: {
  flag: AIFlag;
  loading: string | null;
  onAccept?: () => void;
  onDismiss?: () => void;
  onDelete: () => void;
}) {
  const isLoading = loading === `flag_${flag.id}`;
  return (
    <Card className={flag.status === "dismissed" ? "opacity-50" : ""}>
      <CardBody className="py-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="text-xs font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                {flag.field_name}
              </span>
              <Badge variant={flag.severity === "required" ? "red" : "amber"}>
                {flag.severity}
              </Badge>
              {flag.status !== "pending" && (
                <Badge variant={flag.status === "accepted" ? "green" : "gray"}>
                  {flag.status}
                </Badge>
              )}
              {flag.status === "pending" && (
                <span
                  className={`text-[10px] font-semibold uppercase tracking-wider flex items-center gap-1.5 ${
                    flag.is_manual ? "text-slate-400" : "text-purple-500"
                  }`}
                >
                  <span
                    className={`w-1 h-1 rounded-full ${flag.is_manual ? "bg-slate-300" : "bg-purple-400"}`}
                  />
                  {flag.is_manual ? "Consultant-added" : "AI-raised Gap"}
                </span>
              )}
            </div>
            <p className="text-sm text-slate-700 leading-relaxed">
              {flag.reason}
            </p>
            <p className="text-xs text-slate-500 mt-1 italic">
              Ask: &quot;{flag.suggested_question}&quot;
            </p>
          </div>
          <div className="flex gap-1.5 flex-shrink-0">
            {flag.status === "pending" && onAccept && (
              <Button
                size="sm"
                variant="secondary"
                onClick={onAccept}
                loading={isLoading}
                disabled={isLoading}
              >
                Accept
              </Button>
            )}
            {flag.status === "pending" && onDismiss && (
              <Button
                size="sm"
                variant="ghost"
                onClick={onDismiss}
                loading={isLoading}
                disabled={isLoading}
              >
                Dismiss
              </Button>
            )}
            <Button
              size="sm"
              variant="danger"
              onClick={onDelete}
              loading={isLoading}
              disabled={isLoading}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}

// ── Live Context Data component ───────────────────────────────────────
function LiveContextData({
  projectId,
  existingMarket,
  existingClimate,
  analysisData,
  onFetch,
  loading,
}: {
  projectId: string;
  existingMarket?: string;
  existingClimate?: string;
  analysisData: { climateData: string; marketResearch: string } | null;
  onFetch: () => void;
  loading: boolean;
}) {
  const marketContent = analysisData?.marketResearch || existingMarket;
  const climateContent = analysisData?.climateData || existingClimate;
  const hasData = !!(marketContent || climateContent);

  return (
    <Card>
      <CardHeader className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-slate-900 text-sm">
            Live Context Data
          </h3>
          <p className="text-xs text-slate-500 font-normal mt-0.5">
            Real-time market prices and historical climate data for this
            location
          </p>
        </div>
        {!hasData && (
          <Button
            size="sm"
            variant="outline"
            onClick={onFetch}
            loading={loading}
          >
            Fetch Market & Climate Data
          </Button>
        )}
      </CardHeader>
      {hasData && (
        <CardBody className="max-h-[500px] overflow-y-auto space-y-6 bg-slate-50/50">
          {marketContent && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Activity className="w-4 h-4 text-blue-600" />
                <h4 className="font-semibold text-slate-900 text-sm">
                  Live Market Research
                </h4>
              </div>
              <div className="bg-white p-4 rounded-xl border border-slate-200">
                <MarkdownRenderer content={marketContent} />
              </div>
            </div>
          )}
          {climateContent && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <CloudRain className="w-4 h-4 text-indigo-600" />
                <h4 className="font-semibold text-slate-900 text-sm">
                  Historical Climate Data (Monthly Avg 2022–2025)
                </h4>
              </div>
              <div className="bg-white p-4 rounded-xl border border-slate-200 overflow-x-auto">
                <MarkdownRenderer content={climateContent} />
              </div>
            </div>
          )}
          {!loading && (
            <Button
              size="sm"
              variant="outline"
              onClick={onFetch}
              loading={loading}
              className="w-full"
            >
              Refresh Data
            </Button>
          )}
        </CardBody>
      )}
    </Card>
  );
}

// ── Schedule call card ────────────────────────────────────────────────
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
          "Your Google account is not connected. Sign in with Google to enable calendar invites.",
        );
        return;
      }
      if (!res.ok) {
        setErrorMsg(
          data.error ||
            "Failed to schedule. Check Google Calendar permissions.",
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
