"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
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
  ArrowRight,
} from "lucide-react";
import { formatDate } from "@/lib/utils";
import type { Project, Report, CallBrief } from "@/types";

/* ── Pipeline step definitions ────────────────────────────────────── */
const STEPS = [
  {
    key: "call",
    label: "Intro Call",
    done: (s: string) =>
      [
        "call_completed",
        "questionnaire_sent",
        "questionnaire_submitted",
        "clarification_sent",
        "analysis_running",
        "report_draft",
        "report_published",
        "completed",
      ].includes(s),
  },
  {
    key: "q",
    label: "Questionnaire",
    done: (s: string) =>
      [
        "questionnaire_submitted",
        "clarification_sent",
        "analysis_running",
        "report_draft",
        "report_published",
        "completed",
      ].includes(s),
  },
  {
    key: "ai",
    label: "Analysis",
    done: (s: string) =>
      [
        "analysis_running",
        "report_draft",
        "report_published",
        "completed",
      ].includes(s),
  },
  {
    key: "rep",
    label: "Report",
    done: (s: string) => ["report_published", "completed"].includes(s),
  },
  {
    key: "pay",
    label: "Delivered",
    done: (s: string) => s === "completed",
  },
];

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
  onNavigate: (tab: string) => void;
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

  /* ── Derive next recommended action ─────────────────────────────── */
  const nextAction = (() => {
    if (!hasSubmission && !(project as any).questionnaire_submissions?.length) {
      return {
        label: "Send questionnaire",
        action: onSendQuestionnaire,
        loading: loading === "send_q",
      };
    }
    if (!hasSubmission) {
      return {
        label: "View questionnaire status",
        action: () => onNavigate("questionnaire"),
        loading: false,
      };
    }
    if (pendingFlagsCount === 0 && acceptedFlagsCount === 0 && !report) {
      return {
        label: "Run AI gap check",
        action: onRunClarify,
        loading: loading === "clarify",
      };
    }
    if (pendingFlagsCount > 0) {
      return {
        label: `Review ${pendingFlagsCount} gap${pendingFlagsCount !== 1 ? "s" : ""}`,
        action: () => onNavigate("questionnaire"),
        loading: false,
      };
    }
    if (acceptedFlagsCount > 0) {
      return {
        label: "Send follow-up",
        action: onSendFollowUp,
        loading: loading === "followup",
      };
    }
    if (!report) {
      return {
        label: "Generate report",
        action: onGenerateReport,
        loading: loading === "report",
      };
    }
    return {
      label: "Review report",
      action: () => onNavigate("report"),
      loading: false,
    };
  })();

  return (
    <div className="max-w-5xl mx-auto grid grid-cols-3 gap-5">
      {/* ── Left column (2/3) ──────────────────────────────────── */}
      <div className="col-span-2 space-y-4">
        {/* Next action banner — single prominent CTA */}
        <div className="rounded-xl border border-brand-200 bg-brand-50 px-5 py-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-[10px] font-semibold text-brand-600 uppercase tracking-wide mb-0.5">
              Next step
            </p>
            <p className="text-sm font-semibold text-foreground">
              {nextAction.label}
            </p>
          </div>
          <Button
            size="sm"
            onClick={nextAction.action}
            loading={nextAction.loading}
          >
            {nextAction.label}
            <ArrowRight className="size-3.5" />
          </Button>
        </div>

        {/* Pipeline stepper */}
        <Card>
          <CardContent className="py-5 px-6">
            <div className="relative flex items-center justify-between">
              {/* Connecting line */}
              <div className="absolute inset-x-8 top-4 h-px bg-border z-0" />
              {STEPS.map((step, i, arr) => {
                const done = step.done(project.status);
                const isNext =
                  !done && (i === 0 || arr[i - 1].done(project.status));
                return (
                  <div
                    key={step.key}
                    className="relative z-10 flex flex-col items-center gap-2"
                  >
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold border-2 transition-colors ${
                        done
                          ? "bg-brand-800 border-brand-800 text-white"
                          : isNext
                            ? "bg-white border-brand-500 text-brand-700 shadow-sm"
                            : "bg-white border-border text-muted-foreground"
                      }`}
                    >
                      {done ? <CheckCircle className="size-3.5" /> : i + 1}
                    </div>
                    <span
                      className={`text-[10px] font-medium uppercase tracking-wide ${
                        done
                          ? "text-brand-800"
                          : isNext
                            ? "text-foreground"
                            : "text-muted-foreground"
                      }`}
                    >
                      {step.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Intro Call */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle>Intro Call</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-3">
            {project.meet_link ? (
              <a
                href={project.meet_link}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-3 px-4 py-3 rounded-lg bg-blue-50 border border-blue-200 hover:bg-blue-100 transition-colors"
              >
                <Video className="size-4 text-blue-700 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-blue-800">
                    Open Google Meet
                  </p>
                  {project.meet_scheduled_at && (
                    <p className="text-xs text-blue-600">
                      {formatDate(project.meet_scheduled_at)}
                    </p>
                  )}
                </div>
                <ExternalLink className="size-3.5 text-blue-500" />
              </a>
            ) : (
              <ScheduleCallCard
                projectId={project.id}
                onScheduled={onScheduled}
              />
            )}

            <TranscriptUploadCard
              hasBrief={!!callBrief}
              loading={loading === "transcript"}
              onUpload={onUploadTranscript}
            />

            {callBrief && <CallBriefCard brief={callBrief} />}
          </CardContent>
        </Card>
      </div>

      {/* ── Right column (1/3) ─────────────────────────────────── */}
      <div className="space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle>Project details</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-3">
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
              <div key={label} className="flex items-start gap-2.5">
                <Icon className="size-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-[11px] text-muted-foreground">{label}</p>
                  <p className="text-xs text-foreground font-medium truncate">
                    {value}
                  </p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {project.consultant_notes && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Call notes</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">
                {project.consultant_notes}
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

/* ── Transcript upload ────────────────────────────────────────────── */
function TranscriptUploadCard({
  hasBrief,
  loading,
  onUpload,
}: {
  hasBrief: boolean;
  loading: boolean;
  onUpload: (text: string) => void;
}) {
  const [pasteMode, setPasteMode] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    onUpload(await file.text());
  }

  return (
    <div
      className="rounded-lg border border-dashed border-border bg-muted/30 px-4 py-3"
      onDragOver={(e) => e.preventDefault()}
      onDrop={async (e) => {
        e.preventDefault();
        const f = e.dataTransfer.files[0];
        if (f) await handleFile(f);
      }}
    >
      <div className="flex items-center gap-2 mb-2">
        <FileAudio className="size-3.5 text-muted-foreground" />
        <p className="text-xs font-medium text-foreground">
          {hasBrief ? "Call brief extracted ✓" : "Upload call transcript"}
        </p>
        {hasBrief && (
          <Badge variant="green" className="ml-auto">
            <Sparkles className="size-2.5" /> AI brief ready
          </Badge>
        )}
      </div>

      {!pasteMode ? (
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => fileRef.current?.click()}
            loading={loading}
          >
            <Upload className="size-3" />
            {loading ? "Processing…" : "Upload .txt / .vtt"}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setPasteMode(true)}>
            Paste text
          </Button>
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
            className="w-full text-xs px-3 py-2 rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring resize-none"
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
              <Sparkles className="size-3" /> Extract brief
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

/* ── Call brief card ─────────────────────────────────────────────── */
function CallBriefCard({ brief }: { brief: CallBrief }) {
  const [open, setOpen] = useState(false);

  const items = [
    brief.budget_range && { label: "Budget", value: brief.budget_range },
    brief.crop_types?.length && {
      label: "Crops",
      value: brief.crop_types.join(", "),
    },
    brief.experience_level && {
      label: "Experience",
      value: brief.experience_level,
    },
    brief.agro_tourism_interest && {
      label: "Agro-tourism",
      value: "Interest noted",
    },
    brief.water_source_mentioned && {
      label: "Water",
      value: brief.water_source_mentioned,
    },
  ].filter(Boolean) as { label: string; value: string }[];

  return (
    <div className="rounded-lg border border-purple-200 bg-purple-50 px-4 py-3">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 text-left"
      >
        <Sparkles className="size-3.5 text-purple-600 flex-shrink-0" />
        <p className="text-xs font-semibold text-purple-800 flex-1">
          AI-extracted call brief
        </p>
        {open ? (
          <ChevronUp className="size-3.5 text-purple-400" />
        ) : (
          <ChevronDown className="size-3.5 text-purple-400" />
        )}
      </button>

      {open && (
        <div className="mt-3 space-y-1.5">
          {items.map(({ label, value }) => (
            <div key={label} className="flex gap-2">
              <span className="text-[11px] text-purple-600 font-medium w-24 flex-shrink-0">
                {label}
              </span>
              <span className="text-[11px] text-purple-900">{value}</span>
            </div>
          ))}
          {brief.key_concerns?.length ? (
            <div className="mt-2">
              <p className="text-[11px] text-purple-600 font-medium mb-1">
                Key concerns
              </p>
              <ul className="space-y-0.5">
                {brief.key_concerns.map((c, i) => (
                  <li
                    key={i}
                    className="text-[11px] text-purple-900 flex gap-1.5"
                  >
                    <span className="text-purple-400">·</span>
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

/* ── Schedule call ───────────────────────────────────────────────── */
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
        setError(data.error || "Failed");
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
    <div className="rounded-lg border border-border p-4">
      <div className="flex items-center gap-2 mb-3">
        <Calendar className="size-3.5 text-muted-foreground" />
        <p className="text-xs font-medium text-foreground">
          Schedule intro call
        </p>
      </div>
      <div className="flex gap-2">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="flex-1 h-8 px-2.5 text-xs rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <input
          type="time"
          value={time}
          onChange={(e) => setTime(e.target.value)}
          className="w-24 h-8 px-2.5 text-xs rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring"
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
        <p className="mt-2 text-xs text-destructive bg-destructive/8 border border-destructive/20 rounded-lg px-3 py-2">
          {error}
        </p>
      )}
    </div>
  );
}
