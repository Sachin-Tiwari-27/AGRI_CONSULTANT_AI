"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { EmptyState } from "@/components/ui/status";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  Eye,
  EyeOff,
  Clock,
  RefreshCw,
  MoreHorizontal,
  MessageSquare,
  FileCheck,
  Users,
  Wheat,
  DollarSign,
} from "lucide-react";
import { formatDate } from "@/lib/utils";
import { toast } from "@/components/ui/toast";
import type { AIFlag, Project, QuestionnaireSendLog } from "@/types";

/* ── Question labels ─────────────────────────────────────────────── */
const Q_LABELS: Record<string, string> = {
  q1: "Legal Entity",
  q2: "Primary Contact",
  q3: "Email / WhatsApp",
  q4: "GPS Coordinates",
  q5: "Land Area (sqm)",
  q6: "Water Source",
  q7: "Water Availability",
  q8: "Water Analysis?",
  q9: "Water Upload",
  q10: "Power Source",
  q11: "Power Capacity (KVA)",
  q12: "Internet",
  q13: "40ft Truck Access?",
  q14: "Target Crops",
  q15: "Other Crops",
  q16: "Technology Level",
  q17: "Agro-Tourism?",
  q18: "Target Market",
  q19: "Cold Storage?",
  q20: "Phase 1 Budget",
  q21: "Start Date",
  q22: "Other Notes",
};

const ANSWER_SECTIONS = [
  { title: "Site & Identity", keys: ["q1", "q2", "q3", "q4", "q5"] },
  {
    title: "Infrastructure",
    keys: ["q6", "q7", "q8", "q9", "q10", "q11", "q12", "q13"],
  },
  { title: "Crops & Technology", keys: ["q14", "q15", "q16", "q17"] },
  {
    title: "Commercial & Logistics",
    keys: ["q18", "q19", "q20", "q21", "q22"],
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
  const [activeSection, setActiveSection] = useState<"submissions" | "gaps">(
    "submissions",
  );
  const [sendLog, setSendLog] = useState<QuestionnaireSendLog[]>([]);
  const [newGap, setNewGap] = useState({
    field_name: "",
    reason: "",
    suggested_question: "",
    severity: "recommended" as "required" | "recommended",
  });

  const latestSubmission = submissions
    .filter((s) => s.submitted_at)
    .sort(
      (a, b) =>
        new Date(b.submitted_at!).getTime() -
        new Date(a.submitted_at!).getTime(),
    )[0];

  const byRound = Object.values(
    submissions.reduce(
      (acc, s) => {
        acc[s.round] = s;
        return acc;
      },
      {} as Record<number, Submission>,
    ),
  ).sort((a, b) => b.round - a.round);

  const pending = flags.filter((f) => f.status === "pending");
  const accepted = flags.filter((f) => f.status === "accepted");
  const dismissed = flags.filter((f) => f.status === "dismissed");

  useEffect(() => {
    if (!project.id) return;
    fetch(`/api/projects/${project.id}/send-log`)
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setSendLog(Array.isArray(d) ? d : []))
      .catch(() => setSendLog([]));
  }, [project.id]);

  function logsFor(round: number) {
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
    const ok = await onAddFlag(newGap);
    if (ok) {
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
    <div className="max-w-4xl mx-auto space-y-4">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {submissions.length > 0 && (
            <div className="flex items-center gap-1 bg-muted p-1 rounded-lg">
              {(["submissions", "gaps"] as const).map((id) => (
                <button
                  key={id}
                  onClick={() => setActiveSection(id)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 ${
                    activeSection === id
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {id === "submissions" ? "Submissions" : "Gaps"}
                  {id === "gaps" && pending.length > 0 && (
                    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-[10px] font-semibold text-white">
                      {pending.length}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {latestSubmission && (
            <Button
              size="sm"
              variant="outline"
              onClick={onRunClarify}
              loading={loading === "clarify"}
            >
              <Zap className="size-3.5" /> Gap check
            </Button>
          )}
          <Button
            size="sm"
            onClick={onSendQuestionnaire}
            loading={loading === "send_q"}
          >
            <Send className="size-3.5" />
            {submissions.length > 0 ? "Resend" : "Send form"}
          </Button>
        </div>
      </div>

      {/* ── Submissions ──────────────────────────────────────────── */}
      {(activeSection === "submissions" || submissions.length === 0) && (
        <div className="space-y-3">
          {submissions.length === 0 ? (
            <EmptyState
              icon={<Send className="size-8" />}
              title="No questionnaire sent yet"
              description="Send the initial form to start collecting project inputs from the client."
              action={
                <Button
                  onClick={onSendQuestionnaire}
                  loading={loading === "send_q"}
                >
                  <Send className="size-4" /> Send Questionnaire
                </Button>
              }
            />
          ) : (
            byRound.map((sub) => (
              <SubmissionCard
                key={sub.id}
                submission={sub}
                logs={logsFor(sub.round)}
                expanded={expandedId === sub.id}
                onToggle={() =>
                  setExpandedId(expandedId === sub.id ? null : sub.id)
                }
              />
            ))
          )}
        </div>
      )}

      {/* ── Gaps ─────────────────────────────────────────────────── */}
      {activeSection === "gaps" && submissions.length > 0 && (
        <div className="space-y-4">
          {/* Toolbar */}
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              {flags.length === 0
                ? "No gaps flagged yet."
                : `${pending.length} pending · ${accepted.length} accepted · ${dismissed.length} dismissed`}
            </p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowAddGap((v) => !v)}
            >
              <Plus className="size-3.5" /> Add gap
            </Button>
          </div>

          {/* Add gap form */}
          {showAddGap && (
            <Card>
              <CardContent className="pt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold">Add custom data gap</p>
                  <button onClick={() => setShowAddGap(false)}>
                    <X className="size-3.5 text-muted-foreground hover:text-foreground" />
                  </button>
                </div>
                <input
                  className="w-full h-8 px-3 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="Field / topic *"
                  value={newGap.field_name}
                  onChange={(e) =>
                    setNewGap((g) => ({ ...g, field_name: e.target.value }))
                  }
                />
                <textarea
                  rows={2}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                  placeholder="Why is this needed? *"
                  value={newGap.reason}
                  onChange={(e) =>
                    setNewGap((g) => ({ ...g, reason: e.target.value }))
                  }
                />
                <textarea
                  rows={2}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                  placeholder="Question to ask client *"
                  value={newGap.suggested_question}
                  onChange={(e) =>
                    setNewGap((g) => ({
                      ...g,
                      suggested_question: e.target.value,
                    }))
                  }
                />
                <div className="flex items-center gap-3">
                  <div className="flex gap-1.5">
                    {(["required", "recommended"] as const).map((sev) => (
                      <button
                        key={sev}
                        type="button"
                        onClick={() =>
                          setNewGap((g) => ({ ...g, severity: sev }))
                        }
                        className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors ${
                          newGap.severity === sev
                            ? sev === "required"
                              ? "bg-red-50 border-red-300 text-red-700"
                              : "bg-amber-50 border-amber-300 text-amber-700"
                            : "bg-muted border-border text-muted-foreground"
                        }`}
                      >
                        {sev === "required" ? "Required" : "Recommended"}
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
                      <Plus className="size-3.5" /> Add
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Pending flags */}
          {pending.length > 0 && (
            <div className="space-y-2">
              <p className="text-[11px] font-semibold text-amber-700 uppercase tracking-wide">
                Pending review ({pending.length})
              </p>
              {pending.map((f) => (
                <FlagRow
                  key={f.id}
                  flag={f}
                  loading={loading}
                  onAccept={() => onAcceptFlag(f.id)}
                  onDismiss={() => onDismissFlag(f.id)}
                  onDelete={() => onDeleteFlag(f.id)}
                />
              ))}
            </div>
          )}

          {/* Accepted flags */}
          {accepted.length > 0 && (
            <div className="space-y-2">
              <p className="text-[11px] font-semibold text-brand-700 uppercase tracking-wide">
                Accepted — to send ({accepted.length})
              </p>
              {accepted.map((f) => (
                <FlagRow
                  key={f.id}
                  flag={f}
                  loading={loading}
                  onDelete={() => onDeleteFlag(f.id)}
                />
              ))}
              <div className="flex items-center justify-between rounded-lg border border-brand-200 bg-brand-50 px-4 py-3">
                <p className="text-xs text-brand-800 font-medium">
                  {accepted.length} question{accepted.length !== 1 ? "s" : ""}{" "}
                  ready to send to {project.client_email}
                </p>
                <Button
                  size="sm"
                  onClick={onSendFollowUp}
                  loading={loading === "followup"}
                >
                  <Send className="size-3.5" /> Send follow-up
                </Button>
              </div>
            </div>
          )}

          {/* Dismissed (collapsed) */}
          {dismissed.length > 0 && (
            <details>
              <summary className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide cursor-pointer list-none flex items-center gap-1.5 py-1">
                <ChevronDown className="size-3.5" />
                Dismissed ({dismissed.length})
              </summary>
              <div className="space-y-2 mt-2">
                {dismissed.map((f) => (
                  <FlagRow
                    key={f.id}
                    flag={f}
                    loading={loading}
                    onDelete={() => onDeleteFlag(f.id)}
                    faded
                  />
                ))}
              </div>
            </details>
          )}

          {flags.length === 0 && !showAddGap && (
            <EmptyState
              icon={<Zap className="size-8" />}
              title="No gaps flagged"
              description="Run the AI gap check to automatically detect missing or insufficient data."
              action={
                latestSubmission ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={onRunClarify}
                    loading={loading === "clarify"}
                  >
                    <Zap className="size-3.5" /> Run AI Gap Check
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

/* ── Submission card ─────────────────────────────────────────────── */
function SubmissionCard({
  submission,
  logs,
  expanded,
  onToggle,
}: {
  submission: Submission;
  logs: QuestionnaireSendLog[];
  expanded: boolean;
  onToggle: () => void;
}) {
  const answerCount = Object.keys(submission.answers || {}).length;
  const latestLog = logs[0];

  return (
    <Card>
      <CardContent className="py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <p className="text-sm font-semibold text-foreground">
                {submission.round === 1
                  ? "Initial questionnaire"
                  : `Follow-up round ${submission.round}`}
              </p>
              <Badge variant={submission.submitted_at ? "green" : "amber"}>
                {submission.submitted_at ? "Submitted" : "Pending"}
              </Badge>
            </div>
            <div className="flex items-center gap-3 text-[11px] text-muted-foreground flex-wrap">
              {submission.submitted_at && (
                <span>
                  Submitted {formatDate(submission.submitted_at)} ·{" "}
                  {answerCount} answers
                </span>
              )}
              {latestLog && (
                <span className="flex items-center gap-1">
                  <Clock className="size-3" />
                  {latestLog.is_resend ? "Resent" : "Sent"}{" "}
                  {formatDate(latestLog.sent_at)}
                  {" at "}
                  {new Date(latestLog.sent_at).toLocaleTimeString("en-GB", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                  {logs.length > 1 && ` · +${logs.length - 1} more`}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {submission.submitted_at && answerCount > 0 && (
              <Button size="sm" variant="ghost" onClick={onToggle}>
                {expanded ? (
                  <EyeOff className="size-3.5" />
                ) : (
                  <Eye className="size-3.5" />
                )}
                {expanded ? "Hide" : "View"}
              </Button>
            )}
            <a
              href={`/q/${submission.token}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
            >
              <ExternalLink className="size-3" />
              Portal
            </a>
          </div>
        </div>

        {/* Answer table */}
        {expanded && submission.answers && (
          <div className="mt-4 border-t border-border pt-4 space-y-4">
            {ANSWER_SECTIONS.map((section) => {
              const rows = section.keys
                .filter(
                  (k) =>
                    submission.answers[k] !== undefined &&
                    submission.answers[k] !== "",
                )
                .map((k) => ({
                  label: Q_LABELS[k] || k,
                  value: submission.answers[k],
                }));
              if (!rows.length) return null;
              return (
                <div key={section.title}>
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                    {section.title}
                  </p>
                  <div className="rounded-lg border border-border overflow-hidden">
                    {rows.map(({ label, value }, i) => (
                      <div
                        key={label}
                        className={`grid grid-cols-5 gap-4 px-3 py-2 text-xs ${i !== 0 ? "border-t border-border/50" : ""}`}
                      >
                        <span className="col-span-2 text-muted-foreground font-medium truncate">
                          {label}
                        </span>
                        <span className="col-span-3 text-foreground break-words">
                          {formatAnswer(value)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function formatAnswer(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) return (value as string[]).join(", ");
  if (typeof value === "object" && (value as any).filename)
    return `[File: ${(value as any).filename}]`;
  return String(value);
}

/* ── Flag row ────────────────────────────────────────────────────── */
function FlagRow({
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
      className={`rounded-lg border border-border bg-card px-4 py-3 transition-opacity ${faded ? "opacity-40" : ""}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
            <span className="text-xs font-semibold text-foreground bg-muted px-1.5 py-0.5 rounded">
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
              className={`text-[10px] font-medium ${flag.is_manual ? "text-muted-foreground" : "text-purple-500"}`}
            >
              {flag.is_manual ? "Manual" : "AI"}
            </span>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {flag.reason}
          </p>
          <div className="mt-1.5 flex items-start gap-1.5">
            <MessageSquare className="size-3 text-muted-foreground mt-0.5 flex-shrink-0" />
            <p className="text-[11px] text-muted-foreground italic">
              "{flag.suggested_question}"
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          {flag.status === "pending" && onAccept && (
            <Button
              size="sm"
              variant="outline"
              onClick={onAccept}
              loading={isLoading}
              disabled={isLoading}
            >
              Accept
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon-sm" variant="ghost" disabled={isLoading}>
                <MoreHorizontal className="size-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {flag.status === "pending" && onDismiss && (
                <DropdownMenuItem onClick={onDismiss}>Dismiss</DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={onDelete} destructive>
                <Trash2 className="size-3.5" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}
