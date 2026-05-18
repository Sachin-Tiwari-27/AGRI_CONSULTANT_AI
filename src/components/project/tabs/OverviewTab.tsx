"use client";
import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Video,
  Send,
  Zap,
  FileText,
  CheckCircle,
  ExternalLink,
  Calendar,
  MapPin,
  Wheat,
  Users,
  DollarSign,
  Clock,
  Upload,
  Sparkles,
  ChevronDown,
  ChevronUp,
  FileAudio,
} from "lucide-react";
import { formatDate } from "@/lib/utils";
import type { Project, Report, CallBrief } from "@/types";

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

interface RecommendedAction {
  title: string;
  description: string;
  buttonLabel: string;
  action: () => void;
  disabled: boolean;
  loading?: boolean;
}

interface Props {
  project: Project;
  report: Report | null;
  hasSubmission: boolean;
  pendingFlagsCount: number;
  acceptedFlagsCount: number;
  loading: string | null;
  onSendQuestionnaire: () => void;
  onRunClarify: () => void;
  onSendFollowUp: () => void;
  onGenerateReport: () => void;
  onUploadTranscript: (text: string) => void;
  onScheduled: (link: string) => void;
  onNavigate: (tab: "questionnaire" | "analysis" | "report") => void;
}

export function OverviewTab({
  project,
  report,
  hasSubmission,
  pendingFlagsCount,
  acceptedFlagsCount,
  loading,
  onSendQuestionnaire,
  onRunClarify,
  onSendFollowUp,
  onGenerateReport,
  onUploadTranscript,
  onScheduled,
  onNavigate,
}: Props) {
  const currency = (project as any).currency || "USD";
  const callBrief = (project as any).call_brief as CallBrief | null;

  const recommendedAction: RecommendedAction = (() => {
    if (!hasSubmission && !(project as any).questionnaire_submissions?.length) {
      return {
        title: "Send the initial questionnaire",
        description: "Kick off data collection from the client.",
        buttonLabel: "Send Questionnaire",
        action: onSendQuestionnaire,
        disabled: loading === "send_q",
        loading: loading === "send_q",
      };
    }
    if (!hasSubmission) {
      return {
        title: "Awaiting questionnaire submission",
        description:
          "The form link has been sent. Follow up if no response arrives.",
        buttonLabel: "View Questionnaire",
        action: () => onNavigate("questionnaire"),
        disabled: false,
      };
    }
    if (pendingFlagsCount === 0 && acceptedFlagsCount === 0 && !report) {
      return {
        title: "Run AI gap check",
        description:
          "Detect missing critical inputs before generating the report.",
        buttonLabel: "Run Gap Check",
        action: onRunClarify,
        disabled: loading === "clarify",
        loading: loading === "clarify",
      };
    }
    if (pendingFlagsCount > 0) {
      return {
        title: `Review ${pendingFlagsCount} flagged gap(s)`,
        description:
          "Accept or dismiss AI-identified data gaps before proceeding.",
        buttonLabel: "Review Gaps",
        action: () => onNavigate("questionnaire"),
        disabled: false,
      };
    }
    if (acceptedFlagsCount > 0) {
      return {
        title: "Send follow-up clarification",
        description:
          "Request the accepted clarification questions from the client.",
        buttonLabel: "Send Follow-up",
        action: onSendFollowUp,
        disabled: loading === "followup",
        loading: loading === "followup",
      };
    }
    if (!report) {
      return {
        title: "Generate feasibility report draft",
        description: "All data collected — generate the AI draft report now.",
        buttonLabel: "Generate Report",
        action: onGenerateReport,
        disabled: loading === "report",
        loading: loading === "report",
      };
    }
    return {
      title: "Review and refine draft report",
      description:
        "Open the report tab to finalise narrative, numbers, and publish.",
      buttonLabel: "Open Report",
      action: () => onNavigate("report"),
      disabled: false,
    };
  })();

  return (
    <div className="grid grid-cols-3 gap-5">
      <div className="col-span-2 space-y-4">
        {/* Recommended action banner */}
        <div className="relative overflow-hidden rounded-xl border border-green-200 bg-gradient-to-r from-green-50 via-emerald-50 to-teal-50 p-5">
          <div className="absolute top-0 right-0 w-32 h-32 bg-green-100/40 rounded-full -mr-12 -mt-12" />
          <p className="text-[10px] font-bold uppercase tracking-widest text-green-600 mb-1">
            Next recommended step
          </p>
          <h3 className="text-sm font-semibold text-slate-900 mb-0.5">
            {recommendedAction.title}
          </h3>
          <p className="text-xs text-slate-600 mb-3">
            {recommendedAction.description}
          </p>
          <Button
            size="sm"
            onClick={recommendedAction.action}
            disabled={recommendedAction.disabled}
            loading={recommendedAction.loading}
          >
            {recommendedAction.buttonLabel}
          </Button>
        </div>

        {/* Pipeline */}
        <Card>
          <CardHeader>
            <h3 className="font-semibold text-slate-900 text-sm">
              Project Pipeline
            </h3>
          </CardHeader>
          <CardContent className="py-6 px-4">
            <div className="relative flex items-center justify-between w-full">
              <div className="absolute left-8 right-8 top-1/2 -translate-y-1/2 h-0.5 bg-slate-100 rounded-full z-0" />
              {PIPELINE_STEPS.map((step, i, arr) => {
                const done = step.doneStatuses.includes(project.status);
                const isActive =
                  done && !arr[i + 1]?.doneStatuses.includes(project.status);
                return (
                  <div
                    key={step.key}
                    className="relative z-10 flex flex-col items-center gap-2"
                  >
                    <div
                      className={`w-9 h-9 rounded-full flex items-center justify-center font-semibold text-sm border-2 transition-all ${isActive ? "bg-green-600 border-green-600 text-white shadow-lg shadow-green-200" : done ? "bg-green-50 border-green-500 text-green-700" : "bg-white border-slate-200 text-slate-400"}`}
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
                      className={`text-[10px] uppercase tracking-wider font-semibold ${isActive ? "text-green-700" : done ? "text-slate-700" : "text-slate-400"}`}
                    >
                      {step.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Call section */}
        <Card>
          <CardHeader>
            <h3 className="font-semibold text-slate-900 text-sm">Intro Call</h3>
          </CardHeader>
          <CardContent className="space-y-3">
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
                onScheduled={onScheduled}
              />
            )}

            {/* Transcript upload */}
            <TranscriptUploadCard
              hasBrief={!!callBrief}
              loading={loading === "transcript"}
              onUpload={onUploadTranscript}
            />

            {/* Call brief summary */}
            {callBrief && <CallBriefCard brief={callBrief} />}
          </CardContent>
        </Card>

        {/* Actions */}
        <Card>
          <CardHeader>
            <h3 className="font-semibold text-slate-900 text-sm">Actions</h3>
          </CardHeader>
          <CardContent className="space-y-3">
            <ActionRow
              icon={Send}
              title="Send questionnaire"
              sub={
                hasSubmission
                  ? `Submitted ${formatDate((project as any).questionnaire_submissions?.find((s: any) => s.submitted_at)?.submitted_at || "")}`
                  : "Not sent yet"
              }
              buttonLabel="Send"
              onClick={onSendQuestionnaire}
              loading={loading === "send_q"}
              disabled={!!hasSubmission}
            />
            {hasSubmission && (
              <ActionRow
                icon={Zap}
                title="Run AI gap check"
                sub={
                  pendingFlagsCount > 0
                    ? `${pendingFlagsCount} gap(s) pending review`
                    : "Check for missing data"
                }
                buttonLabel="Run"
                onClick={onRunClarify}
                loading={loading === "clarify"}
                iconColor="text-purple-500"
              />
            )}
            {hasSubmission && (
              <ActionRow
                icon={FileText}
                title="Generate feasibility report"
                sub={
                  report
                    ? "Report exists — regenerate all sections"
                    : "AI-draft all sections from project data"
                }
                buttonLabel={report ? "Regenerate" : "Generate"}
                onClick={onGenerateReport}
                loading={loading === "report"}
                iconColor="text-green-600"
              />
            )}
          </CardContent>
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
          <CardContent className="space-y-3">
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
          </CardContent>
        </Card>

        {project.consultant_notes && (
          <Card>
            <CardHeader>
              <h3 className="font-semibold text-slate-900 text-sm">
                Call Notes
              </h3>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-600 whitespace-pre-wrap leading-relaxed">
                {project.consultant_notes}
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

// ── Transcript upload card ────────────────────────────────────────────
function TranscriptUploadCard({
  hasBrief,
  loading,
  onUpload,
}: {
  hasBrief: boolean;
  loading: boolean;
  onUpload: (text: string) => void;
}) {
  const [dragging, setDragging] = useState(false);
  const [pasteMode, setPasteMode] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    const text = await file.text();
    onUpload(text);
  }

  return (
    <div
      className={`rounded-lg border-2 border-dashed p-3 transition-colors ${dragging ? "border-green-400 bg-green-50" : "border-slate-200 bg-slate-50/40"}`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={async (e) => {
        e.preventDefault();
        setDragging(false);
        const f = e.dataTransfer.files[0];
        if (f) await handleFile(f);
      }}
    >
      <div className="flex items-center gap-2 mb-2">
        <FileAudio className="w-3.5 h-3.5 text-slate-400" />
        <p className="text-xs font-medium text-slate-700">
          {hasBrief ? "Call brief extracted ✓" : "Upload call transcript"}
        </p>
        {hasBrief && (
          <span className="ml-auto text-[10px] text-green-700 font-medium flex items-center gap-1">
            <Sparkles className="w-3 h-3" /> AI brief ready
          </span>
        )}
      </div>

      {!pasteMode ? (
        <div className="flex gap-2">
          <button
            onClick={() => fileRef.current?.click()}
            disabled={loading}
            className="flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-900 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            <Upload className="w-3 h-3" />
            {loading ? "Processing…" : "Upload .txt / .vtt"}
          </button>
          <button
            onClick={() => setPasteMode(true)}
            className="text-xs text-slate-500 hover:text-slate-700 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition-colors"
          >
            Paste text
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".txt,.vtt,.md"
            className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (f) await handleFile(f);
            }}
          />
        </div>
      ) : (
        <div className="space-y-2">
          <textarea
            rows={4}
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            placeholder="Paste call transcript or notes here…"
            className="w-full text-xs px-2.5 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-green-500 resize-none bg-white"
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => {
                onUpload(pasteText);
                setPasteMode(false);
                setPasteText("");
              }}
              loading={loading}
              disabled={!pasteText.trim()}
            >
              <Sparkles className="w-3 h-3" /> Extract brief
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setPasteMode(false);
                setPasteText("");
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Call brief display card ───────────────────────────────────────────
function CallBriefCard({ brief }: { brief: CallBrief }) {
  const [expanded, setExpanded] = useState(false);
  const items = [
    brief.budget_range && { label: "Budget", value: brief.budget_range },
    brief.crop_types?.length && {
      label: "Crops mentioned",
      value: brief.crop_types.join(", "),
    },
    brief.experience_level && {
      label: "Experience",
      value: brief.experience_level,
    },
    brief.agro_tourism_interest && {
      label: "Agro-tourism",
      value: "Mentioned interest",
    },
    brief.water_source_mentioned && {
      label: "Water source",
      value: brief.water_source_mentioned,
    },
  ].filter(Boolean) as { label: string; value: string }[];

  return (
    <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center gap-2 text-left"
      >
        <Sparkles className="w-3.5 h-3.5 text-purple-600 flex-shrink-0" />
        <p className="text-xs font-semibold text-purple-800 flex-1">
          AI-extracted call brief
        </p>
        {expanded ? (
          <ChevronUp className="w-3 h-3 text-purple-400" />
        ) : (
          <ChevronDown className="w-3 h-3 text-purple-400" />
        )}
      </button>

      {expanded && (
        <div className="mt-3 space-y-1.5">
          {items.map(({ label, value }) => (
            <div key={label} className="flex gap-2">
              <span className="text-[11px] text-purple-600 font-medium w-28 flex-shrink-0">
                {label}
              </span>
              <span className="text-[11px] text-purple-900">{value}</span>
            </div>
          ))}
          {brief.key_concerns?.length ? (
            <div>
              <p className="text-[11px] text-purple-600 font-medium mb-1">
                Key concerns
              </p>
              <ul className="list-disc pl-4 space-y-0.5">
                {brief.key_concerns.map((c, i) => (
                  <li key={i} className="text-[11px] text-purple-900">
                    {c}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

// ── Reusable action row ───────────────────────────────────────────────
function ActionRow({
  icon: Icon,
  title,
  sub,
  buttonLabel,
  onClick,
  loading,
  disabled,
  iconColor = "text-slate-500",
}: {
  icon: any;
  title: string;
  sub: string;
  buttonLabel: string;
  onClick: () => void;
  loading?: boolean;
  disabled?: boolean;
  iconColor?: string;
}) {
  return (
    <div className="flex items-center justify-between p-3 rounded-lg border border-slate-200 hover:border-slate-300 transition-colors">
      <div className="flex items-center gap-3">
        <Icon className={`w-4 h-4 ${iconColor}`} />
        <div>
          <p className="text-sm font-medium text-slate-800">{title}</p>
          <p className="text-xs text-slate-500">{sub}</p>
        </div>
      </div>
      <Button
        size="sm"
        variant="secondary"
        onClick={onClick}
        loading={loading}
        disabled={disabled || loading}
      >
        {buttonLabel}
      </Button>
    </div>
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
  const [error, setError] = useState<string | null>(null);

  async function schedule() {
    if (!date || !time) return;
    setLoading(true);
    setError(null);
    try {
      const scheduledAt = new Date(`${date}T${time}:00`).toISOString();
      const res = await fetch("/api/calendar/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, scheduledAt }),
      });
      const data = await res.json();
      if (data.error === "google_not_connected") {
        setError("Sign in with Google to enable calendar invites.");
        return;
      }
      if (!res.ok) {
        setError(data.error || "Failed to schedule.");
        return;
      }
      if (data.meetLink) onScheduled(data.meetLink);
    } catch {
      setError("Unexpected error. Please try again.");
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
      {error && (
        <p className="mt-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </p>
      )}
    </div>
  );
}
