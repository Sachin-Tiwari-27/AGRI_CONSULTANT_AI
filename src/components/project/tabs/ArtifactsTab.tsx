"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Loader2,
  ChevronDown,
  ChevronUp,
  FileText,
  Phone,
  Globe,
  TableProperties,
  FileCheck,
  RefreshCw,
  AlertCircle,
  FileSpreadsheet,
  MapPin,
  Wheat,
  DollarSign,
  Users,
  Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/status";
import { MarkdownRenderer } from "@/components/ui/markdown-renderer";
import { formatDate, formatCurrency } from "@/lib/utils";
import {
  exportQuestionnaireTxt,
  exportQuestionnaireDocx,
  exportCallNotesTxt,
  exportCallNotesDocx,
  exportResearchTxt,
  exportResearchDocx,
  exportFinancialModelTxt,
  exportFinancialModelXlsx,
  exportFinancialModelDocx,
  exportAllArtifactsDocx,
} from "@/lib/artifact-export";
import type { FinancialModel } from "@/types";

/* ── Types ───────────────────────────────────────────────────────── */
interface ArtifactsData {
  project: {
    id: string;
    title: string;
    client_name: string;
    client_email: string;
    region?: string;
    country?: string;
    gps_coordinates?: string;
    land_size_sqm?: number;
    crop_types?: string[];
    project_type?: string;
    budget_range?: string;
    currency?: string;
    experience_level?: string;
    target_market?: string[];
    consultant_notes?: string;
    created_at: string;
  };
  call_brief: any | null;
  submissions: Array<{
    id: string;
    round: number;
    submitted_at: string | null;
    answers: Record<string, unknown>;
    uploaded_files: any[];
  }>;
  send_log: Array<{
    round: number;
    sent_at: string;
    is_resend: boolean;
    recipient: string;
  }>;
  consultant_notes: Array<{
    id: string;
    category: string;
    title: string;
    content: string;
    is_pinned: boolean;
    created_at: string;
  }>;
  financial_model: FinancialModel | null;
  financial_model_notes: string | null;
  financial_model_source: "consultant_override" | "report_draft" | "none";
  market_research: string | null;
  climate_data: string | null;
  report_status: string | null;
  report_updated_at: string | null;
}

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

function sanitizeVal(val: unknown): string {
  if (val === null || val === undefined) return "—";
  if (typeof val === "boolean") return val ? "Yes" : "No";
  if (Array.isArray(val)) return (val as string[]).join(", ");
  if (typeof val === "object") return JSON.stringify(val);
  return String(val);
}

/* ── Artifact section ─────────────────────────────────────────────── */
function ArtifactSection({
  title,
  icon: Icon,
  badge,
  badgeVariant = "gray",
  meta,
  children,
  defaultOpen = false,
  downloads = [],
}: {
  title: string;
  icon: React.ElementType;
  badge?: string;
  badgeVariant?: "green" | "gray" | "blue" | "purple" | "violet" | "amber";
  meta?: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  downloads?: Array<{
    label: string;
    icon: React.ElementType;
    onClick: () => void;
  }>;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="rounded-xl border border-border bg-card">
      {/* Header */}
      <div
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-muted/30 transition-colors rounded-xl cursor-pointer"
      >
        <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
          <Icon className="size-4 text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-foreground">{title}</p>
            {badge && <Badge variant={badgeVariant}>{badge}</Badge>}
          </div>
          {meta && (
            <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
              {meta}
            </p>
          )}
        </div>

        {/* Download buttons (only visible when open to avoid clutter) */}
        {open && downloads.length > 0 && (
          <div
            className="flex items-center gap-1 flex-shrink-0 mr-2"
            onClick={(e) => e.stopPropagation()}
          >
            {downloads.map((dl) => {
              const DlIcon = dl.icon;
              return (
                <button
                  key={dl.label}
                  onClick={dl.onClick}
                  title={`Download as ${dl.label}`}
                  className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground px-2 py-1 rounded border border-border hover:bg-muted transition-colors"
                >
                  <DlIcon className="size-3" />
                  {dl.label}
                </button>
              );
            })}
          </div>
        )}

        {open ? (
          <ChevronUp className="size-4 text-muted-foreground flex-shrink-0" />
        ) : (
          <ChevronDown className="size-4 text-muted-foreground flex-shrink-0" />
        )}
      </div>

      {open && (
        <div className="px-5 pb-5 border-t border-border pt-4">{children}</div>
      )}
    </div>
  );
}

/* ── Main component ──────────────────────────────────────────────── */
export function ArtifactsTab({ projectId }: { projectId: string }) {
  const [data, setData] = useState<ArtifactsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/artifacts`);
      if (!res.ok) throw new Error("Failed to load artifacts");
      setData(await res.json());
    } catch (e: any) {
      setError(e.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading)
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );

  if (error || !data)
    return (
      <EmptyState
        icon={<AlertCircle className="size-8" />}
        title={error || "No data available"}
        action={
          <Button size="sm" variant="outline" onClick={load}>
            <RefreshCw className="size-3.5" /> Retry
          </Button>
        }
      />
    );

  const {
    project,
    call_brief,
    submissions,
    send_log,
    consultant_notes,
    financial_model,
    financial_model_notes,
    financial_model_source,
    market_research,
    climate_data,
  } = data;

  const currency = project.currency || "USD";
  const submittedRounds = submissions.filter((s) => s.submitted_at);
  const totalAnswers = submittedRounds.reduce(
    (acc, s) => acc + Object.keys(s.answers || {}).length,
    0,
  );
  const hasResearch = !!(
    consultant_notes.length ||
    market_research ||
    climate_data
  );

  const handleDownloadAll = () => {
    exportAllArtifactsDocx(
      project.title,
      project.client_name,
      project.client_email || "",
      currency,
      submittedRounds,
      call_brief,
      project.consultant_notes,
      consultant_notes,
      market_research,
      climate_data,
      financial_model,
      financial_model_notes
    );
  };

  return (
    <div className="max-w-4xl mx-auto space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          All data collected on this project — view or export in any format
        </p>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={handleDownloadAll}>
            <Download className="size-3.5" /> Download All
          </Button>
          <Button size="sm" variant="ghost" onClick={load}>
            <RefreshCw className="size-3.5" /> Refresh
          </Button>
        </div>
      </div>

      {/* Project summary strip */}
      <div className="rounded-xl border border-border bg-muted/30 px-5 py-3">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
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
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} className="flex items-start gap-2 min-w-0">
              <Icon className="size-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wide">
                  {label}
                </p>
                <p className="text-xs text-foreground mt-0.5 truncate" title={String(value)}>
                  {value}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Section 1: Questionnaire ─────────────────────────────── */}
      <ArtifactSection
        title="Questionnaire data"
        icon={FileCheck}
        badge={
          submittedRounds.length > 0
            ? `${submittedRounds.length} round${submittedRounds.length !== 1 ? "s" : ""} · ${totalAnswers} answers`
            : "No submissions yet"
        }
        badgeVariant={submittedRounds.length > 0 ? "blue" : "gray"}
        meta={
          submittedRounds.length > 0
            ? `Last submitted: ${formatDate(submittedRounds[submittedRounds.length - 1].submitted_at!)}`
            : undefined
        }
        defaultOpen={submittedRounds.length > 0}
        downloads={
          submittedRounds.length > 0
            ? [
                {
                  label: "TXT",
                  icon: FileText,
                  onClick: () =>
                    exportQuestionnaireTxt(
                      submittedRounds,
                      project.title,
                      project.client_name,
                    ),
                },
                {
                  label: "DOCX",
                  icon: FileText,
                  onClick: () =>
                    exportQuestionnaireDocx(
                      submittedRounds,
                      project.title,
                      project.client_name,
                      project.client_email,
                    ),
                },
              ]
            : []
        }
      >
        {submittedRounds.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">
            No questionnaire submissions yet.
          </p>
        ) : (
          <div className="space-y-5">
            {submittedRounds.map((sub) => {
              const roundLogs = send_log
                .filter((l) => l.round === sub.round)
                .sort(
                  (a, b) =>
                    new Date(b.sent_at).getTime() -
                    new Date(a.sent_at).getTime(),
                );
              return (
                <div key={sub.id}>
                  <div className="flex items-center gap-3 mb-3">
                    <Badge variant="blue">Round {sub.round}</Badge>
                    <span className="text-xs text-muted-foreground">
                      Submitted {formatDate(sub.submitted_at!)}
                    </span>
                    {roundLogs[0] && (
                      <span className="text-[11px] text-muted-foreground">
                        · Sent {formatDate(roundLogs[0].sent_at)}
                        {roundLogs.length > 1 &&
                          ` (+${roundLogs.length - 1} resend${roundLogs.length > 2 ? "s" : ""})`}
                      </span>
                    )}
                  </div>
                  <div className="rounded-lg border border-border overflow-hidden">
                    {Object.entries(sub.answers || {}).map(([key, val], i) => (
                      <div
                        key={key}
                        className={`grid grid-cols-5 gap-4 px-4 py-2 text-xs ${i !== 0 ? "border-t border-border/50" : ""}`}
                      >
                        <span className="col-span-2 text-muted-foreground font-medium">
                          {Q_LABELS[key] || key}
                        </span>
                        <span className="col-span-3 text-foreground">
                          {sanitizeVal(val)}
                        </span>
                      </div>
                    ))}
                  </div>
                  {sub.uploaded_files?.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {sub.uploaded_files.map((f: any, i: number) => (
                        <a
                          key={i}
                          href={f.url}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1.5 text-[11px] text-brand-700 bg-brand-50 border border-brand-200 px-2.5 py-1 rounded-full hover:bg-brand-100 transition-colors"
                        >
                          <FileText className="size-3" />
                          {f.filename}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </ArtifactSection>

      {/* ── Section 2: Call notes ────────────────────────────────── */}
      <ArtifactSection
        title="Call notes & brief"
        icon={Phone}
        badge={
          call_brief
            ? "AI brief extracted"
            : project.consultant_notes
              ? "Manual notes"
              : "No notes"
        }
        badgeVariant={call_brief ? "purple" : "gray"}
        meta={
          call_brief?.extracted_at
            ? `Extracted ${formatDate(call_brief.extracted_at)}`
            : undefined
        }
        defaultOpen={!!(call_brief || project.consultant_notes)}
        downloads={
          call_brief || project.consultant_notes
            ? [
                {
                  label: "TXT",
                  icon: FileText,
                  onClick: () =>
                    exportCallNotesTxt(
                      call_brief,
                      project.consultant_notes ?? null,
                      project.title,
                    ),
                },
                {
                  label: "DOCX",
                  icon: FileText,
                  onClick: () =>
                    exportCallNotesDocx(
                      call_brief,
                      project.consultant_notes ?? null,
                      project.title,
                    ),
                },
              ]
            : []
        }
      >
        {!call_brief && !project.consultant_notes ? (
          <p className="text-xs text-muted-foreground italic">
            No call notes or brief available. Upload a transcript from the
            Overview tab.
          </p>
        ) : (
          <div className="space-y-4">
            {project.consultant_notes && (
              <div>
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                  Consultant notes
                </p>
                <p className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed bg-muted/40 rounded-lg px-4 py-3">
                  {project.consultant_notes}
                </p>
              </div>
            )}
            {call_brief && (
              <div>
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                  AI-extracted brief
                </p>
                <div className="rounded-lg border border-border overflow-hidden">
                  {[
                    ["Budget", call_brief.budget_range],
                    ["Crops", call_brief.crop_types?.join(", ")],
                    ["Experience", call_brief.experience_level],
                    [
                      "Agro-tourism",
                      call_brief.agro_tourism_interest != null
                        ? call_brief.agro_tourism_interest
                          ? "Yes"
                          : "No"
                        : null,
                    ],
                    ["Water source", call_brief.water_source_mentioned],
                    ["Funding", call_brief.funding_status],
                  ]
                    .filter(([, v]) => v != null && v !== "")
                    .map(([label, val], i) => (
                      <div
                        key={String(label)}
                        className={`grid grid-cols-5 gap-4 px-4 py-2 text-xs ${i !== 0 ? "border-t border-border/50" : ""}`}
                      >
                        <span className="col-span-2 text-muted-foreground font-medium">
                          {label}
                        </span>
                        <span className="col-span-3 text-foreground">
                          {String(val)}
                        </span>
                      </div>
                    ))}
                </div>
                {call_brief.key_concerns?.length > 0 && (
                  <div className="mt-3">
                    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                      Key concerns
                    </p>
                    <ul className="space-y-1">
                      {call_brief.key_concerns.map((c: string, i: number) => (
                        <li
                          key={i}
                          className="flex items-start gap-2 text-xs text-muted-foreground"
                        >
                          <span className="text-muted-foreground/40 mt-0.5">
                            ·
                          </span>
                          {c}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </ArtifactSection>

      {/* ── Section 3: Research ──────────────────────────────────── */}
      <ArtifactSection
        title="Research data"
        icon={Globe}
        badge={
          [
            consultant_notes.length > 0 && `${consultant_notes.length} notes`,
            market_research && "Market",
            climate_data && "Climate",
          ]
            .filter(Boolean)
            .join(" · ") || "No research yet"
        }
        badgeVariant={hasResearch ? "blue" : "gray"}
        defaultOpen={hasResearch}
        downloads={
          hasResearch
            ? [
                {
                  label: "TXT",
                  icon: FileText,
                  onClick: () =>
                    exportResearchTxt(
                      consultant_notes,
                      market_research,
                      climate_data,
                      project.title,
                    ),
                },
                {
                  label: "DOCX",
                  icon: FileText,
                  onClick: () =>
                    exportResearchDocx(
                      consultant_notes,
                      market_research,
                      climate_data,
                      project.title,
                    ),
                },
              ]
            : []
        }
      >
        {!hasResearch ? (
          <p className="text-xs text-muted-foreground italic">
            No research data yet. Use the Analysis tab to load market and
            climate data.
          </p>
        ) : (
          <div className="space-y-5">
            {consultant_notes.length > 0 && (
              <div>
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                  Consultant notes ({consultant_notes.length})
                </p>
                <div className="space-y-2">
                  {consultant_notes.map((note) => (
                    <div
                      key={note.id}
                      className="rounded-lg border border-border px-4 py-3"
                    >
                      <p className="text-xs font-semibold text-foreground">
                        {note.title}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5 uppercase">
                        {note.category} · {formatDate(note.created_at)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed whitespace-pre-wrap">
                        {note.content}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {market_research && (
              <div>
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                  Market research
                </p>
                <div className="bg-muted/30 rounded-lg px-5 py-4 max-h-72 overflow-y-auto scrollbar-thin">
                  <MarkdownRenderer content={market_research} />
                </div>
              </div>
            )}
            {climate_data && (
              <div>
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                  Climate data
                </p>
                <div className="bg-muted/30 rounded-lg px-5 py-4 overflow-x-auto">
                  <MarkdownRenderer content={climate_data} />
                </div>
              </div>
            )}
          </div>
        )}
      </ArtifactSection>

      {/* ── Section 4: Financial model ───────────────────────────── */}
      <ArtifactSection
        title="Financial model"
        icon={TableProperties}
        badge={
          financial_model_source === "consultant_override"
            ? "Consultant override"
            : financial_model_source === "report_draft"
              ? "AI-generated"
              : "No model yet"
        }
        badgeVariant={
          financial_model_source === "consultant_override"
            ? "green"
            : financial_model_source === "report_draft"
              ? "violet"
              : "gray"
        }
        meta={
          financial_model
            ? `CAPEX ${formatCurrency(financial_model.capex_total, currency)} · Revenue ${formatCurrency(financial_model.total_annual_revenue, currency)} · Payback ${financial_model.payback_years} yrs`
            : undefined
        }
        defaultOpen={!!financial_model}
        downloads={
          financial_model
            ? [
                {
                  label: "TXT",
                  icon: FileText,
                  onClick: () =>
                    exportFinancialModelTxt(
                      financial_model,
                      financial_model_notes,
                      project.title,
                      currency,
                    ),
                },
                {
                  label: "XLSX",
                  icon: FileSpreadsheet,
                  onClick: () =>
                    exportFinancialModelXlsx(
                      financial_model,
                      financial_model_notes,
                      project.title,
                      currency,
                    ),
                },
                {
                  label: "DOCX",
                  icon: FileText,
                  onClick: () =>
                    exportFinancialModelDocx(
                      financial_model,
                      financial_model_notes,
                      project.title,
                      currency,
                    ),
                },
              ]
            : []
        }
      >
        {!financial_model ? (
          <p className="text-xs text-muted-foreground italic">
            No financial model yet. Generate one from the Financial tab.
          </p>
        ) : (
          <div className="space-y-4">
            {/* KPI grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                {
                  label: "CAPEX",
                  value: formatCurrency(financial_model.capex_total, currency),
                },
                {
                  label: "Revenue / yr",
                  value: formatCurrency(
                    financial_model.total_annual_revenue,
                    currency,
                  ),
                },
                {
                  label: "EBITDA",
                  value: `${formatCurrency(financial_model.ebitda, currency)} (${financial_model.ebitda_margin}%)`,
                },
                {
                  label: "Payback",
                  value: `${financial_model.payback_years} years`,
                },
              ].map(({ label, value }) => (
                <div
                  key={label}
                  className="bg-muted/30 rounded-lg px-3 py-2.5 border border-border"
                >
                  <p className="text-[10px] text-muted-foreground font-medium">
                    {label}
                  </p>
                  <p className="text-xs font-bold text-foreground mt-0.5">
                    {value}
                  </p>
                </div>
              ))}
            </div>

            {/* Crops table */}
            {financial_model.crops?.length > 0 && (
              <div className="rounded-lg border border-border overflow-hidden">
                <div className="grid grid-cols-5 px-4 py-2 bg-muted text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                  <span className="col-span-2">Crop</span>
                  <span>Yield (t/yr)</span>
                  <span>Price/kg</span>
                  <span>Revenue</span>
                </div>
                {financial_model.crops.map((crop, i) => (
                  <div
                    key={i}
                    className={`grid grid-cols-5 px-4 py-2 text-xs ${i !== 0 ? "border-t border-border/50" : ""}`}
                  >
                    <span className="col-span-2 font-medium text-foreground">
                      {crop.name}
                    </span>
                    <span className="text-muted-foreground">
                      {crop.yield_tonnes.toFixed(1)}
                    </span>
                    <span className="text-muted-foreground">
                      {currency} {crop.price_per_kg.toFixed(2)}
                    </span>
                    <span className="font-semibold text-brand-700">
                      {formatCurrency(crop.annual_revenue, currency)}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Assumptions */}
            {financial_model.assumptions?.length ? (
              <div>
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                  Assumptions
                </p>
                <ul className="space-y-0.5">
                  {financial_model.assumptions.map((a, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-2 text-[11px] text-muted-foreground"
                    >
                      <span className="text-muted-foreground/40 mt-0.5">·</span>
                      {a}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {financial_model_notes && (
              <div>
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                  Consultant notes
                </p>
                <p className="text-xs text-muted-foreground bg-muted/30 rounded-lg px-4 py-3 whitespace-pre-wrap leading-relaxed">
                  {financial_model_notes}
                </p>
              </div>
            )}
          </div>
        )}
      </ArtifactSection>
    </div>
  );
}
