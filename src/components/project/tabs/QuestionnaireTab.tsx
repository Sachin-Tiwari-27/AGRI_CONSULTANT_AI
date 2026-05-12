"use client";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/Button";
import {
  Card,
  CardBody,
  CardHeader,
  CardFooter,
  Badge,
} from "@/components/ui/Card";
import {
  Send,
  Zap,
  AlertTriangle,
  CheckCircle2,
  X,
  Plus,
  ExternalLink,
  Trash2,
  ChevronDown,
  Users,
  DollarSign,
  Wheat,
  Zap as ZapIcon,
  FileCheck,
  MessageSquare,
  Eye,
  EyeOff,
  Clock,
  RefreshCw,
} from "lucide-react";
import { formatDate } from "@/lib/utils";
import { toast } from "@/components/ui/Toast";
import type { AIFlag, Project, QuestionnaireSendLog } from "@/types";

const QUESTION_LABELS: Record<string, string> = {
  q1: "Legal Entity / Company Name",
  q2: "Primary Contact Person",
  q3: "Email / WhatsApp",
  q4: "GPS Coordinates",
  q5: "Total Land Area (sqm)",
  q6: "Primary Water Source",
  q7: "Water Availability (litres/day)",
  q8: "Water Analysis Available?",
  q9: "Water Analysis Upload",
  q10: "Power Source",
  q11: "Available Power Capacity (KVA)",
  q12: "Internet Connectivity",
  q13: "40ft Container Truck Access?",
  q14: "Target Crops",
  q15: "Other Crops",
  q16: "Technology Level",
  q17: "Agro-Tourism Planned?",
  q18: "Primary Target Market",
  q19: "On-Site Cold Storage?",
  q20: "Phase 1 Budget",
  q21: "Construction Start Date",
  q22: "Other Requirements",
};

const ANSWER_SECTIONS = [
  {
    title: "Client & Site Identity",
    icon: Users,
    keys: ["q1", "q2", "q3", "q4", "q5"],
    color: "bg-blue-50 border-blue-100",
  },
  {
    title: "Infrastructure & Utilities",
    icon: ZapIcon,
    keys: ["q6", "q7", "q8", "q9", "q10", "q11", "q12", "q13"],
    color: "bg-purple-50 border-purple-100",
  },
  {
    title: "Crops & Technology",
    icon: Wheat,
    keys: ["q14", "q15", "q16", "q17"],
    color: "bg-green-50 border-green-100",
  },
  {
    title: "Commercial & Logistics",
    icon: DollarSign,
    keys: ["q18", "q19", "q20", "q21", "q22"],
    color: "bg-amber-50 border-amber-100",
  },
];

interface Submission {
  id: string;
  round: number;
  submitted_at: string | null;
  token: string;
  answers: Record<string, unknown>;
}

interface Props {
  project: Project;
  submissions: Submission[];
  flags: AIFlag[];
  loading: string | null;
  onSendQuestionnaire: () => void;
  onRunClarify: () => void;
  onSendFollowUp: () => void;
  onAcceptFlag: (id: string) => void;
  onDismissFlag: (id: string) => void;
  onDeleteFlag: (id: string) => void;
  onAddFlag: (gap: {
    field_name: string;
    reason: string;
    suggested_question: string;
    severity: "required" | "recommended";
  }) => Promise<boolean>;
}

export function QuestionnaireTab({
  project,
  submissions,
  flags,
  loading,
  onSendQuestionnaire,
  onRunClarify,
  onSendFollowUp,
  onAcceptFlag,
  onDismissFlag,
  onDeleteFlag,
  onAddFlag,
}: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showAddGap, setShowAddGap] = useState(false);
  const [newGap, setNewGap] = useState({
    field_name: "",
    reason: "",
    suggested_question: "",
    severity: "recommended" as "required" | "recommended",
  });
  const [activeSection, setActiveSection] = useState<"submissions" | "gaps">(
    "submissions",
  );
  const [sendLog, setSendLog] = useState<QuestionnaireSendLog[]>([]);
  const [loadingLog, setLoadingLog] = useState(false);

  const latestSubmission = submissions
    .filter((s) => s.submitted_at)
    .sort(
      (a, b) =>
        new Date(b.submitted_at!).getTime() -
        new Date(a.submitted_at!).getTime(),
    )[0];

  const displaySubmissions = Object.values(
    submissions.reduce(
      (acc, sub) => {
        acc[sub.round] = sub;
        return acc;
      },
      {} as Record<number, Submission>,
    ),
  ).sort((a, b) => b.round - a.round);

  const pendingFlags = flags.filter((f) => f.status === "pending");
  const acceptedFlags = flags.filter((f) => f.status === "accepted");
  const dismissedFlags = flags.filter((f) => f.status === "dismissed");

  const completionRate = latestSubmission
    ? Math.round(
        (Object.values(latestSubmission.answers).filter(
          (v) => v !== "" && v !== null && v !== undefined,
        ).length /
          22) *
          100,
      )
    : 0;

  useEffect(() => {
    if (!project.id) return;
    setLoadingLog(true);
    fetch(`/api/projects/${project.id}/send-log`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setSendLog(Array.isArray(data) ? data : []))
      .catch(() => setSendLog([]))
      .finally(() => setLoadingLog(false));
  }, [project.id]);

  function getLogsForRound(round: number): QuestionnaireSendLog[] {
    return sendLog
      .filter((l) => l.round === round)
      .sort(
        (a, b) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime(),
      );
  }

  async function submitGap() {
    if (!newGap.field_name || !newGap.reason || !newGap.suggested_question) {
      toast.error("Please fill in all fields");
      return;
    }
    const success = await onAddFlag(newGap);
    if (success) {
      setNewGap({
        field_name: "",
        reason: "",
        suggested_question: "",
        severity: "recommended",
      });
      setShowAddGap(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* Header strip */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            Questionnaire & Data Review
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Collect client data, identify gaps, and request clarifications.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            size="sm"
            variant="outline"
            onClick={onSendQuestionnaire}
            loading={loading === "send_q"}
          >
            <Send className="w-3.5 h-3.5" />
            {submissions.length > 0 ? "Resend / New Round" : "Send Form"}
          </Button>
          {latestSubmission && (
            <Button
              size="sm"
              variant="secondary"
              onClick={onRunClarify}
              loading={loading === "clarify"}
            >
              <Zap className="w-3.5 h-3.5" /> AI Gap Check
            </Button>
          )}
        </div>
      </div>

      {/* Stats row */}
      {submissions.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            {
              label: "Submissions",
              value: submissions.length,
              icon: FileCheck,
              color: "bg-blue-50 text-blue-700",
            },
            {
              label: "Completion",
              value: latestSubmission ? `${completionRate}%` : "—",
              icon: CheckCircle2,
              color: "bg-green-50 text-green-700",
            },
            {
              label: "Gaps Pending",
              value: pendingFlags.length,
              icon: AlertTriangle,
              color:
                pendingFlags.length > 0
                  ? "bg-amber-50 text-amber-700"
                  : "bg-slate-50 text-slate-500",
            },
            {
              label: "Accepted Gaps",
              value: acceptedFlags.length,
              icon: MessageSquare,
              color:
                acceptedFlags.length > 0
                  ? "bg-purple-50 text-purple-700"
                  : "bg-slate-50 text-slate-500",
            },
          ].map(({ label, value, icon: Icon, color }) => (
            <div
              key={label}
              className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-3"
            >
              <div
                className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${color}`}
              >
                <Icon className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-lg font-bold text-slate-900 leading-none">
                  {value}
                </p>
                <p className="text-xs text-slate-500 mt-0.5 truncate">
                  {label}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Sub-tabs */}
      {submissions.length > 0 && (
        <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
          {[
            { id: "submissions" as const, label: "Submissions" },
            {
              id: "gaps" as const,
              label: "Data Gaps",
              badge: pendingFlags.length || undefined,
            },
          ].map(({ id, label, badge }) => (
            <button
              key={id}
              onClick={() => setActiveSection(id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                activeSection === id
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {label}
              {badge ? (
                <span className="w-4 h-4 rounded-full bg-amber-500 text-white text-[10px] flex items-center justify-center flex-shrink-0">
                  {badge}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      )}

      {/* ── Submissions section ── */}
      {(activeSection === "submissions" || submissions.length === 0) && (
        <div className="space-y-4">
          {submissions.length === 0 ? (
            <EmptyState
              icon={<Send className="w-10 h-10 text-slate-300" />}
              title="No questionnaire sent yet"
              description="Send the initial form to start collecting project inputs from the client."
              action={
                <Button
                  onClick={onSendQuestionnaire}
                  loading={loading === "send_q"}
                >
                  <Send className="w-4 h-4" /> Send Questionnaire
                </Button>
              }
            />
          ) : (
            displaySubmissions.map((sub) => (
              <SubmissionCard
                key={sub.id}
                submission={sub}
                sendLogs={getLogsForRound(sub.round)}
                loadingLog={loadingLog}
                expanded={expandedId === sub.id}
                onToggle={() =>
                  setExpandedId(expandedId === sub.id ? null : sub.id)
                }
              />
            ))
          )}
        </div>
      )}

      {/* ── Gaps section ── */}
      {activeSection === "gaps" && submissions.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <p className="text-sm text-slate-600">
              {flags.length === 0
                ? "No gaps flagged yet. Run the AI gap check or add one manually."
                : `${pendingFlags.length} pending · ${acceptedFlags.length} accepted · ${dismissedFlags.length} dismissed`}
            </p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowAddGap((v) => !v)}
            >
              <Plus className="w-3.5 h-3.5" /> Add Custom Gap
            </Button>
          </div>

          {showAddGap && (
            <Card className="border-dashed border-amber-300 bg-amber-50/20">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-slate-800">
                    Add Custom Data Gap
                  </p>
                  <button onClick={() => setShowAddGap(false)}>
                    <X className="w-4 h-4 text-slate-400" />
                  </button>
                </div>
              </CardHeader>
              <CardBody className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-slate-600 block mb-1">
                    Field / Topic *
                  </label>
                  <input
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-green-500"
                    placeholder="e.g. Water TDS/EC reading"
                    value={newGap.field_name}
                    onChange={(e) =>
                      setNewGap((g) => ({ ...g, field_name: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600 block mb-1">
                    Why is this needed? *
                  </label>
                  <textarea
                    rows={2}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
                    placeholder="Explain why this information is critical..."
                    value={newGap.reason}
                    onChange={(e) =>
                      setNewGap((g) => ({ ...g, reason: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600 block mb-1">
                    Question to ask client *
                  </label>
                  <textarea
                    rows={2}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
                    placeholder="Could you please provide..."
                    value={newGap.suggested_question}
                    onChange={(e) =>
                      setNewGap((g) => ({
                        ...g,
                        suggested_question: e.target.value,
                      }))
                    }
                  />
                </div>
                <div className="flex items-center gap-3 flex-wrap">
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
                        {sev === "required" ? "🔴 Required" : "🟡 Recommended"}
                      </button>
                    ))}
                  </div>
                  <div className="ml-auto flex gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setShowAddGap(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={submitGap}
                      loading={loading === "add_gap"}
                    >
                      <Plus className="w-3.5 h-3.5" /> Add Gap
                    </Button>
                  </div>
                </div>
              </CardBody>
            </Card>
          )}

          {pendingFlags.length > 0 && (
            <div className="space-y-2">
              <SectionLabel color="amber">
                Pending Review ({pendingFlags.length})
              </SectionLabel>
              {pendingFlags.map((flag) => (
                <FlagCard
                  key={flag.id}
                  flag={flag}
                  loading={loading}
                  onAccept={() => onAcceptFlag(flag.id)}
                  onDismiss={() => onDismissFlag(flag.id)}
                  onDelete={() => onDeleteFlag(flag.id)}
                />
              ))}
            </div>
          )}

          {acceptedFlags.length > 0 && (
            <div className="space-y-2">
              <SectionLabel color="purple">
                Accepted — To Send ({acceptedFlags.length})
              </SectionLabel>
              {acceptedFlags.map((flag) => (
                <FlagCard
                  key={flag.id}
                  flag={flag}
                  loading={loading}
                  onDelete={() => onDeleteFlag(flag.id)}
                />
              ))}
              <div className="mt-4 p-4 bg-purple-50 border border-purple-200 rounded-xl flex items-center justify-between gap-4 flex-wrap">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-purple-900">
                    {acceptedFlags.length} question
                    {acceptedFlags.length > 1 ? "s" : ""} ready to send
                  </p>
                  <p className="text-xs text-purple-700 mt-0.5 truncate">
                    Send a follow-up email to {project.client_email} with all
                    accepted questions.
                  </p>
                </div>
                <Button
                  size="sm"
                  onClick={onSendFollowUp}
                  loading={loading === "followup"}
                  disabled={loading === "followup"}
                  className="flex-shrink-0"
                >
                  <Send className="w-3.5 h-3.5" /> Send Follow-up
                </Button>
              </div>
            </div>
          )}

          {dismissedFlags.length > 0 && (
            <details className="cursor-pointer">
              <summary className="text-xs font-semibold text-slate-400 uppercase tracking-wide py-1 list-none flex items-center gap-2">
                <ChevronDown className="w-3.5 h-3.5" /> Dismissed (
                {dismissedFlags.length})
              </summary>
              <div className="space-y-2 mt-2">
                {dismissedFlags.map((flag) => (
                  <FlagCard
                    key={flag.id}
                    flag={flag}
                    loading={loading}
                    onDelete={() => onDeleteFlag(flag.id)}
                    faded
                  />
                ))}
              </div>
            </details>
          )}

          {flags.length === 0 && !showAddGap && (
            <EmptyState
              icon={<AlertTriangle className="w-10 h-10 text-slate-200" />}
              title="No gaps flagged yet"
              description={
                latestSubmission
                  ? "Run the AI gap check to automatically detect missing or insufficient data."
                  : "Send the questionnaire first, then run the gap check."
              }
              action={
                latestSubmission ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={onRunClarify}
                    loading={loading === "clarify"}
                  >
                    <Zap className="w-3.5 h-3.5" /> Run AI Gap Check
                  </Button>
                ) : undefined
              }
            />
          )}
        </div>
      )}
    </div>
  );
}

// ── Submission card ───────────────────────────────────────────────────
function SubmissionCard({
  submission,
  sendLogs,
  loadingLog,
  expanded,
  onToggle,
}: {
  submission: Submission;
  sendLogs: QuestionnaireSendLog[];
  loadingLog: boolean;
  expanded: boolean;
  onToggle: () => void;
}) {
  const [showSendHistory, setShowSendHistory] = useState(false);
  const answerCount = Object.keys(submission.answers || {}).length;
  const latestSend = sendLogs[0];

  return (
    <Card className={submission.submitted_at ? "border-green-200" : ""}>
      <CardHeader>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-sm text-slate-900">
              {submission.round === 1
                ? "Initial Questionnaire"
                : `Follow-up Round ${submission.round}`}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              {submission.submitted_at
                ? `Submitted ${formatDate(submission.submitted_at)} · ${answerCount} answers`
                : "Awaiting response from client"}
            </p>
            {latestSend && (
              <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1 flex-wrap">
                <Clock className="w-3 h-3 flex-shrink-0" />
                {latestSend.is_resend ? "Resent" : "Sent"}{" "}
                {formatDate(latestSend.sent_at)} at{" "}
                {new Date(latestSend.sent_at).toLocaleTimeString("en-GB", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
                {sendLogs.length > 1 && (
                  <button
                    onClick={() => setShowSendHistory((s) => !s)}
                    className="ml-1 text-slate-400 hover:text-slate-600 underline underline-offset-2 whitespace-nowrap"
                  >
                    +{sendLogs.length - 1} more
                  </button>
                )}
              </p>
            )}
            {loadingLog && !latestSend && (
              <p className="text-xs text-slate-300 mt-0.5">
                Loading send history…
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Badge variant={submission.submitted_at ? "green" : "amber"}>
              {submission.submitted_at ? "Submitted" : "Pending"}
            </Badge>
            {submission.submitted_at && answerCount > 0 && (
              <button
                onClick={onToggle}
                className="flex items-center gap-1 text-xs text-green-700 hover:text-green-800 font-medium px-2 py-1 rounded-lg hover:bg-green-50 transition-colors whitespace-nowrap"
              >
                {expanded ? (
                  <EyeOff className="w-3 h-3" />
                ) : (
                  <Eye className="w-3 h-3" />
                )}
                {expanded ? "Hide" : "View"}
              </button>
            )}
          </div>
        </div>

        {showSendHistory && sendLogs.length > 1 && (
          <div className="mt-2 border-t border-slate-100 pt-2 space-y-1">
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
              Send history
            </p>
            {sendLogs.map((log) => (
              <div
                key={log.id}
                className="flex items-center gap-2 text-xs text-slate-500 flex-wrap"
              >
                <RefreshCw className="w-3 h-3 flex-shrink-0" />
                <span>{log.is_resend ? "Resent" : "Sent"}</span>
                <span className="font-medium text-slate-700">
                  {formatDate(log.sent_at)}
                </span>
                <span>
                  at{" "}
                  {new Date(log.sent_at).toLocaleTimeString("en-GB", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
                <span className="text-slate-400 truncate">
                  → {log.recipient}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardHeader>

      {expanded && submission.answers && (
        <CardBody className="border-t border-slate-100 bg-slate-50/30 p-0">
          {ANSWER_SECTIONS.map((section) => {
            const answers = section.keys
              .filter(
                (k) =>
                  submission.answers[k] !== undefined &&
                  submission.answers[k] !== "",
              )
              .map((k) => ({
                key: k,
                label: QUESTION_LABELS[k] || k,
                value: submission.answers[k],
              }));
            if (!answers.length) return null;
            const Icon = section.icon;
            return (
              <div
                key={section.title}
                className="border-b border-slate-100 last:border-0"
              >
                <div
                  className={`flex items-center gap-2 px-6 py-2.5 border-b border-slate-100 ${section.color}`}
                >
                  <Icon className="w-3.5 h-3.5 text-slate-500" />
                  <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                    {section.title}
                  </p>
                </div>
                <div className="px-6 py-2">
                  {answers.map(({ key, label, value }) => (
                    <div
                      key={key}
                      className="grid grid-cols-5 gap-4 py-2 border-b border-slate-50 last:border-0"
                    >
                      <span className="col-span-2 text-xs font-medium text-slate-500 pt-0.5 truncate">
                        {label}
                      </span>
                      <span className="col-span-3 text-sm text-slate-800 font-medium break-words">
                        {Array.isArray(value)
                          ? (value as string[]).join(", ")
                          : value === true
                            ? "✓ Yes"
                            : value === false
                              ? "✗ No"
                              : typeof value === "object" && value !== null
                                ? `[File: ${(value as any).filename ?? "uploaded"}]`
                                : String(value ?? "—")}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </CardBody>
      )}

      <CardFooter>
        <a
          href={`/q/${submission.token}`}
          target="_blank"
          rel="noreferrer"
          className="text-xs text-green-700 hover:underline flex items-center gap-1"
        >
          <ExternalLink className="w-3 h-3" /> View client portal
        </a>
      </CardFooter>
    </Card>
  );
}

// ── Flag card ─────────────────────────────────────────────────────────
// PR-4: Badge row now uses flex-wrap with consistent gap — no orphaned pills
function FlagCard({
  flag,
  loading,
  onAccept,
  onDismiss,
  onDelete,
  faded,
}: {
  flag: AIFlag;
  loading: string | null;
  onAccept?: () => void;
  onDismiss?: () => void;
  onDelete: () => void;
  faded?: boolean;
}) {
  const isLoading = loading === `flag_${flag.id}`;
  return (
    <div
      className={`bg-white rounded-xl border border-slate-200 p-4 transition-opacity ${faded ? "opacity-50" : ""}`}
    >
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex-1 min-w-0">
          {/* PR-4: Badge row uses flex-wrap + gap-1.5 — no mid-badge line breaks */}
          <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
            <span className="text-xs font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded whitespace-nowrap">
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
            <span
              className={`text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 whitespace-nowrap ${
                flag.is_manual ? "text-slate-400" : "text-purple-500"
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${flag.is_manual ? "bg-slate-300" : "bg-purple-400"}`}
              />
              {flag.is_manual ? "Consultant" : "AI-detected"}
            </span>
          </div>
          <p className="text-sm text-slate-700 leading-relaxed">
            {flag.reason}
          </p>
          <div className="mt-1.5 flex items-start gap-1.5">
            <MessageSquare className="w-3 h-3 text-slate-400 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-slate-500 italic">
              "{flag.suggested_question}"
            </p>
          </div>
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
    </div>
  );
}

function SectionLabel({
  children,
  color,
}: {
  children: React.ReactNode;
  color: "amber" | "purple" | "gray";
}) {
  const colors = {
    amber: "text-amber-700",
    purple: "text-purple-700",
    gray: "text-slate-400",
  };
  return (
    <p
      className={`text-xs font-semibold uppercase tracking-wide ${colors[color]}`}
    >
      {children}
    </p>
  );
}

function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl border border-dashed border-slate-300 p-12 text-center">
      <div className="flex justify-center mb-3">{icon}</div>
      <p className="text-sm font-medium text-slate-700">{title}</p>
      <p className="text-xs text-slate-500 mt-1 mb-4 max-w-sm mx-auto">
        {description}
      </p>
      {action}
    </div>
  );
}
