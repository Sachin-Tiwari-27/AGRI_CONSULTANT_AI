"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Loader2,
  RefreshCw,
  Download,
  FolderPlus,
  Calendar,
  FileText,
  Send,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  CreditCard,
  FileCheck,
  Zap,
  MessageSquare,
  Upload,
  BarChart3,
  BookOpen,
  TableProperties,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/status";
import { formatDate } from "@/lib/utils";
import type { ProjectEvent } from "@/types";

/* ── Event metadata ──────────────────────────────────────────────── */
interface EventMeta {
  icon: React.ElementType;
  badge:
    | "default"
    | "green"
    | "amber"
    | "blue"
    | "purple"
    | "violet"
    | "gray"
    | "orange"
    | "red";
  tag: string;
  dotColor: string;
}

const EVENT_MAP: Record<string, EventMeta> = {
  project_created: {
    icon: FolderPlus,
    badge: "gray",
    tag: "System",
    dotColor: "#94a3b8",
  },
  call_scheduled: {
    icon: Calendar,
    badge: "blue",
    tag: "System",
    dotColor: "#3b82f6",
  },
  call_completed: {
    icon: CheckCircle2,
    badge: "blue",
    tag: "System",
    dotColor: "#3b82f6",
  },
  transcript_uploaded: {
    icon: Upload,
    badge: "purple",
    tag: "AI",
    dotColor: "#a855f7",
  },
  questionnaire_personalised: {
    icon: Sparkles,
    badge: "purple",
    tag: "AI",
    dotColor: "#a855f7",
  },
  questionnaire_sent: {
    icon: Send,
    badge: "blue",
    tag: "Email",
    dotColor: "#0ea5e9",
  },
  questionnaire_resent: {
    icon: Send,
    badge: "blue",
    tag: "Email",
    dotColor: "#0ea5e9",
  },
  client_submitted: {
    icon: FileCheck,
    badge: "green",
    tag: "Client",
    dotColor: "#22c55e",
  },
  ai_gap_check: { icon: Zap, badge: "amber", tag: "AI", dotColor: "#f59e0b" },
  flag_actioned: {
    icon: AlertTriangle,
    badge: "amber",
    tag: "Consultant",
    dotColor: "#f59e0b",
  },
  follow_up_sent: {
    icon: MessageSquare,
    badge: "blue",
    tag: "Email",
    dotColor: "#0ea5e9",
  },
  financial_model_edited: {
    icon: TableProperties,
    badge: "green",
    tag: "Consultant",
    dotColor: "#10b981",
  },
  report_generated: {
    icon: BarChart3,
    badge: "violet",
    tag: "AI",
    dotColor: "#8b5cf6",
  },
  report_published: {
    icon: FileText,
    badge: "green",
    tag: "Report",
    dotColor: "#22c55e",
  },
  payment_initiated: {
    icon: CreditCard,
    badge: "amber",
    tag: "Payment",
    dotColor: "#f59e0b",
  },
  payment_received: {
    icon: CreditCard,
    badge: "green",
    tag: "Payment",
    dotColor: "#10b981",
  },
  note_added: {
    icon: BookOpen,
    badge: "gray",
    tag: "System",
    dotColor: "#94a3b8",
  },
};

const FALLBACK_META: EventMeta = {
  icon: BookOpen,
  badge: "gray",
  tag: "System",
  dotColor: "#94a3b8",
};

const FILTER_GROUPS = [
  { label: "All", types: null },
  {
    label: "AI",
    types: [
      "transcript_uploaded",
      "questionnaire_personalised",
      "ai_gap_check",
      "report_generated",
    ],
  },
  {
    label: "Emails",
    types: [
      "questionnaire_sent",
      "questionnaire_resent",
      "follow_up_sent",
      "report_published",
    ],
  },
  { label: "Client", types: ["client_submitted"] },
  {
    label: "Financial",
    types: ["financial_model_edited", "payment_initiated", "payment_received"],
  },
  { label: "Report", types: ["report_generated", "report_published"] },
];

function groupByDay(events: ProjectEvent[]) {
  const map = new Map<string, ProjectEvent[]>();
  for (const ev of events) {
    const d = new Date(ev.created_at);
    const now = new Date();
    const y = new Date(now);
    y.setDate(now.getDate() - 1);
    const label =
      d.toDateString() === now.toDateString()
        ? "Today"
        : d.toDateString() === y.toDateString()
          ? "Yesterday"
          : formatDate(ev.created_at);
    if (!map.has(label)) map.set(label, []);
    map.get(label)!.push(ev);
  }
  return Array.from(map.entries()).map(([day, events]) => ({ day, events }));
}

function exportCsv(events: ProjectEvent[], projectId: string) {
  const rows = [
    ["Timestamp", "Event Type", "Actor", "Title", "Detail"],
    ...events.map((e) => [
      new Date(e.created_at).toISOString(),
      e.event_type,
      e.actor,
      e.title,
      e.detail || "",
    ]),
  ];
  const csv = rows
    .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `project-${projectId}-log.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function LogTab({ projectId }: { projectId: string }) {
  const [events, setEvents] = useState<ProjectEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState("All");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/events`);
      if (res.ok) setEvents(await res.json());
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = events.filter((ev) => {
    if (activeFilter === "All") return true;
    const g = FILTER_GROUPS.find((f) => f.label === activeFilter);
    return g?.types?.includes(ev.event_type) ?? true;
  });

  const grouped = groupByDay(filtered);

  function toggleExpand(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {events.length} event{events.length !== 1 ? "s" : ""}
        </p>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" onClick={load} disabled={loading}>
            <RefreshCw
              className={`size-3.5 ${loading ? "animate-spin" : ""}`}
            />
          </Button>
          {events.length > 0 && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => exportCsv(events, projectId)}
            >
              <Download className="size-3.5" /> CSV
            </Button>
          )}
        </div>
      </div>

      {/* Filter pills */}
      <div className="flex flex-wrap gap-1.5">
        {FILTER_GROUPS.map((g) => {
          const count = g.types
            ? events.filter((e) => g.types!.includes(e.event_type)).length
            : events.length;
          return (
            <button
              key={g.label}
              onClick={() => setActiveFilter(g.label)}
              className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
                activeFilter === g.label
                  ? "bg-foreground text-background border-foreground"
                  : "bg-card text-muted-foreground border-border hover:border-foreground/30 hover:text-foreground"
              }`}
            >
              {g.label}
              {g.label !== "All" && count > 0 && (
                <span className="ml-1 opacity-60">{count}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Timeline */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : events.length === 0 ? (
        <EmptyState
          icon={<BarChart3 className="size-8" />}
          title="No activity yet"
          description="Events appear here as work progresses on this project."
        />
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">
          No events match this filter.
        </p>
      ) : (
        <div className="relative pl-6">
          {/* Vertical line */}
          <div className="absolute left-2 top-0 bottom-4 w-px bg-border" />

          {grouped.map(({ day, events: dayEvents }) => (
            <div key={day} className="mb-4">
              {/* Day divider */}
              <div className="flex items-center gap-3 mb-2 ml-2">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  {day}
                </span>
                <div className="flex-1 h-px bg-border" />
              </div>

              <div className="space-y-1.5">
                {dayEvents.map((ev) => {
                  const meta = EVENT_MAP[ev.event_type] ?? FALLBACK_META;
                  const Icon = meta.icon;
                  const isExpanded = expandedIds.has(ev.id);
                  const metaLines = ev.metadata
                    ? Object.entries(ev.metadata)
                        .filter(([, v]) => v !== null && v !== undefined)
                        .map(
                          ([k, v]) =>
                            `${k.replace(/_/g, " ")}: ${Array.isArray(v) ? (v as string[]).join(", ") : String(v)}`,
                        )
                    : [];

                  return (
                    <div key={ev.id} className="relative">
                      {/* Dot */}
                      <div
                        className="absolute -left-4 top-3.5 size-2 rounded-full border-2 border-background z-10"
                        style={{ background: meta.dotColor }}
                      />

                      <div className="rounded-lg border border-border bg-card px-4 py-3 hover:border-border/80 transition-colors">
                        <div className="flex items-start gap-3">
                          <div className="w-6 h-6 rounded-md bg-muted flex items-center justify-center flex-shrink-0 mt-0.5">
                            <Icon className="size-3.5 text-muted-foreground" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-foreground leading-snug">
                              {ev.title}
                            </p>
                            {ev.detail && (
                              <p className="text-[11px] text-muted-foreground mt-0.5">
                                {ev.detail}
                              </p>
                            )}
                            {metaLines.length > 0 && (
                              <button
                                onClick={() => toggleExpand(ev.id)}
                                className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground mt-1 transition-colors"
                              >
                                <ChevronRight
                                  className={`size-3 transition-transform ${isExpanded ? "rotate-90" : ""}`}
                                />
                                Details
                              </button>
                            )}
                            {isExpanded && (
                              <pre className="mt-2 text-[10px] text-muted-foreground bg-muted rounded px-2.5 py-2 whitespace-pre-wrap leading-relaxed font-sans">
                                {metaLines.join("\n")}
                              </pre>
                            )}
                          </div>
                          <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                            <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                              {new Date(ev.created_at).toLocaleTimeString(
                                "en-GB",
                                { hour: "2-digit", minute: "2-digit" },
                              )}
                            </span>
                            <Badge variant={meta.badge}>{meta.tag}</Badge>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
