"use client";
import { useState, useEffect, useCallback } from "react";
import {
  Loader2,
  ChevronDown,
  ChevronUp,
  Download,
  FileText,
  Phone,
  BarChart3,
  Globe,
  Thermometer,
  BookOpen,
  FileSpreadsheet,
  FileCheck,
  RefreshCw,
  AlertCircle,
  Eye,
  EyeOff,
  Sparkles,
  TableProperties,
  Clock,
  Wheat,
  MapPin,
  Users,
  DollarSign,
} from "lucide-react";
import { Button } from "@/components/ui/button";
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
} from "@/lib/artifact-export";
import type { FinancialModel } from "@/types";

// ── Types ─────────────────────────────────────────────────────────────

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

interface Props {
  projectId: string;
}

// ── Question labels ───────────────────────────────────────────────────
const QUESTION_LABELS: Record<string, string> = {
  q1: "Legal Entity / Company Name",
  q2: "Primary Contact",
  q3: "Email / WhatsApp",
  q4: "GPS Coordinates",
  q5: "Total Land Area (sqm)",
  q6: "Primary Water Source",
  q7: "Water Availability (litres/day)",
  q8: "Water Analysis Available?",
  q9: "Water Analysis Upload",
  q10: "Power Source",
  q11: "Power Capacity (KVA)",
  q12: "Internet Connectivity",
  q13: "40ft Truck Access?",
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

function sanitize(val: unknown): string {
  if (val === null || val === undefined) return "—";
  if (typeof val === "boolean") return val ? "Yes" : "No";
  if (Array.isArray(val)) return (val as string[]).join(", ");
  if (typeof val === "object") return JSON.stringify(val);
  return String(val);
}

// ── Section wrapper ───────────────────────────────────────────────────
function ArtifactSection({
  id,
  title,
  icon: Icon,
  iconBg,
  iconColor,
  badge,
  badgeColor,
  meta,
  children,
  defaultOpen = false,
  downloadOptions,
}: {
  id: string;
  title: string;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  badge?: string;
  badgeColor?: string;
  meta?: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  downloadOptions: Array<{
    label: string;
    icon: React.ElementType;
    onClick: () => void;
  }>;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [showContent, setShowContent] = useState(false);

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100">
        <div
          className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${iconBg}`}
        >
          <Icon className={`w-4 h-4 ${iconColor}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-slate-900">{title}</p>
            {badge && (
              <span
                className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${badgeColor ?? "bg-slate-100 text-slate-600"}`}
              >
                {badge}
              </span>
            )}
          </div>
          {meta && (
            <p className="text-xs text-slate-500 mt-0.5 truncate">{meta}</p>
          )}
        </div>

        {/* Download buttons */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {downloadOptions.map((opt) => {
            const DlIcon = opt.icon;
            return (
              <button
                key={opt.label}
                onClick={opt.onClick}
                title={`Download as ${opt.label}`}
                className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 hover:border-slate-300 transition-colors"
              >
                <DlIcon className="w-3 h-3" />
                {opt.label}
              </button>
            );
          })}
          <button
            onClick={() => {
              setOpen((o) => !o);
              setShowContent(false);
            }}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors ml-1"
          >
            {open ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      {/* Body */}
      {open && <div className="px-5 py-4">{children}</div>}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────
export function ArtifactsTab({ projectId }: Props) {
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <AlertCircle className="w-8 h-8 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-600">
            {error || "No data available"}
          </p>
          <Button size="sm" variant="outline" className="mt-3" onClick={load}>
            <RefreshCw className="w-3.5 h-3.5" /> Retry
          </Button>
        </div>
      </div>
    );
  }

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
    report_status,
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

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            Project artifacts
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            All data collected on this project — view or download in any format
          </p>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
        >
          <RefreshCw className="w-3 h-3" /> Refresh
        </button>
      </div>

      {/* Project summary strip */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl px-5 py-4">
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
            <div key={label} className="flex items-start gap-2.5">
              <Icon className="w-3.5 h-3.5 text-slate-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                  {label}
                </p>
                <p className="text-xs text-slate-700 mt-0.5">{value}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── SECTION 1: Questionnaire data ── */}
      <ArtifactSection
        id="questionnaire"
        title="Questionnaire data"
        icon={FileCheck}
        iconBg="bg-blue-50"
        iconColor="text-blue-600"
        badge={
          submittedRounds.length > 0
            ? `${submittedRounds.length} round${submittedRounds.length !== 1 ? "s" : ""} · ${totalAnswers} answers`
            : "No submissions yet"
        }
        badgeColor={
          submittedRounds.length > 0
            ? "bg-blue-50 text-blue-700"
            : "bg-slate-100 text-slate-500"
        }
        meta={
          submittedRounds.length > 0
            ? `Last submitted: ${formatDate(submittedRounds[submittedRounds.length - 1].submitted_at!)}`
            : undefined
        }
        defaultOpen={submittedRounds.length > 0}
        downloadOptions={
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
          <p className="text-sm text-slate-400 italic">
            No questionnaire submissions yet.
          </p>
        ) : (
          <div className="space-y-6">
            {submittedRounds.map((sub) => {
              // Find send log entries for this round
              const roundLogs = send_log
                .filter((l) => l.round === sub.round)
                .sort(
                  (a, b) =>
                    new Date(b.sent_at).getTime() -
                    new Date(a.sent_at).getTime(),
                );

              return (
                <div key={sub.id}>
                  {/* Round header */}
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-xs font-semibold text-slate-700 bg-blue-50 border border-blue-100 px-2.5 py-1 rounded-full">
                      Round {sub.round}
                    </span>
                    <span className="text-xs text-slate-500">
                      Submitted {formatDate(sub.submitted_at!)}
                    </span>
                    {roundLogs.length > 0 && (
                      <span className="flex items-center gap-1 text-xs text-slate-400">
                        <Clock className="w-3 h-3" />
                        Sent {formatDate(roundLogs[0].sent_at)} at{" "}
                        {new Date(roundLogs[0].sent_at).toLocaleTimeString(
                          "en-GB",
                          { hour: "2-digit", minute: "2-digit" },
                        )}
                        {roundLogs.length > 1 &&
                          ` · ${roundLogs.length - 1} resend${roundLogs.length > 2 ? "s" : ""}`}
                      </span>
                    )}
                  </div>

                  {/* Answers table */}
                  <div className="border border-slate-100 rounded-xl overflow-hidden">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-slate-50">
                          <th className="px-4 py-2.5 text-left font-semibold text-slate-600 w-2/5">
                            Question
                          </th>
                          <th className="px-4 py-2.5 text-left font-semibold text-slate-600">
                            Answer
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(sub.answers || {}).map(([key, val]) => (
                          <tr
                            key={key}
                            className="border-t border-slate-50 hover:bg-slate-50/60"
                          >
                            <td className="px-4 py-2.5 text-slate-500 font-medium">
                              {QUESTION_LABELS[key] || key}
                            </td>
                            <td className="px-4 py-2.5 text-slate-800">
                              {sanitize(val)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Uploaded files */}
                  {sub.uploaded_files?.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {sub.uploaded_files.map((f: any, i: number) => (
                        <a
                          key={i}
                          href={f.url}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1.5 text-xs text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-full hover:bg-blue-100 transition-colors"
                        >
                          <FileText className="w-3 h-3" />
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

      {/* ── SECTION 2: Call notes & brief ── */}
      <ArtifactSection
        id="call"
        title="Call notes & brief"
        icon={Phone}
        iconBg="bg-purple-50"
        iconColor="text-purple-600"
        badge={
          call_brief
            ? "AI brief extracted"
            : project.consultant_notes
              ? "Manual notes"
              : "No notes yet"
        }
        badgeColor={
          call_brief
            ? "bg-purple-50 text-purple-700"
            : "bg-slate-100 text-slate-500"
        }
        meta={
          call_brief?.extracted_at
            ? `Brief extracted ${formatDate(call_brief.extracted_at)}`
            : undefined
        }
        defaultOpen={!!(call_brief || project.consultant_notes)}
        downloadOptions={
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
          <p className="text-sm text-slate-400 italic">
            No call notes or brief available. Upload a transcript from the
            Overview tab to extract a call brief.
          </p>
        ) : (
          <div className="space-y-5">
            {/* Raw consultant notes */}
            {project.consultant_notes && (
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                  Consultant notes
                </p>
                <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed bg-slate-50 rounded-xl px-4 py-3 border border-slate-100">
                  {project.consultant_notes}
                </p>
              </div>
            )}

            {/* AI-extracted brief */}
            {call_brief && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="w-3.5 h-3.5 text-purple-500" />
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    AI-extracted brief
                  </p>
                </div>
                <div className="border border-purple-100 rounded-xl overflow-hidden">
                  <table className="w-full text-xs">
                    <tbody>
                      {[
                        ["Budget Range", call_brief.budget_range],
                        ["Crops Mentioned", call_brief.crop_types?.join(", ")],
                        ["Experience Level", call_brief.experience_level],
                        [
                          "Agro-Tourism Interest",
                          call_brief.agro_tourism_interest != null
                            ? call_brief.agro_tourism_interest
                              ? "Yes"
                              : "No"
                            : null,
                        ],
                        ["Water Source", call_brief.water_source_mentioned],
                        ["Power Source", call_brief.power_source_mentioned],
                        ["Funding Status", call_brief.funding_status],
                      ]
                        .filter(([, v]) => v != null && v !== "")
                        .map(([label, val]) => (
                          <tr
                            key={String(label)}
                            className="border-t border-purple-50 first:border-0"
                          >
                            <td className="px-4 py-2.5 text-slate-500 font-medium w-2/5">
                              {label}
                            </td>
                            <td className="px-4 py-2.5 text-slate-800">
                              {String(val)}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>

                {call_brief.key_concerns?.length > 0 && (
                  <div className="mt-3">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                      Key concerns
                    </p>
                    <ul className="space-y-1">
                      {call_brief.key_concerns.map((c: string, i: number) => (
                        <li
                          key={i}
                          className="flex items-start gap-2 text-sm text-slate-700"
                        >
                          <span className="text-purple-300 mt-1">·</span>
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

      {/* ── SECTION 3: Research data ── */}
      <ArtifactSection
        id="research"
        title="Research data"
        icon={Globe}
        iconBg="bg-sky-50"
        iconColor="text-sky-600"
        badge={
          [
            consultant_notes.length > 0 && `${consultant_notes.length} notes`,
            market_research && "Market data",
            climate_data && "Climate data",
          ]
            .filter(Boolean)
            .join(" · ") || "No research yet"
        }
        badgeColor={
          hasResearch ? "bg-sky-50 text-sky-700" : "bg-slate-100 text-slate-500"
        }
        defaultOpen={hasResearch}
        downloadOptions={
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
          <p className="text-sm text-slate-400 italic">
            No research data yet. Use the Analysis tab to load market data,
            climate data, and add consultant notes.
          </p>
        ) : (
          <div className="space-y-6">
            {/* Consultant notes */}
            {consultant_notes.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                  Consultant research notes ({consultant_notes.length})
                </p>
                <div className="space-y-2">
                  {consultant_notes.map((note) => (
                    <div
                      key={note.id}
                      className="border border-slate-100 rounded-xl px-4 py-3"
                    >
                      <div className="flex items-start gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-slate-800">
                            {note.title}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] text-slate-400 uppercase">
                              {note.category}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              {formatDate(note.created_at)}
                            </span>
                            {note.is_pinned && (
                              <span className="text-[10px] text-amber-600">
                                Pinned
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-600 mt-2 leading-relaxed whitespace-pre-wrap">
                            {note.content}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Market research */}
            {market_research && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Globe className="w-3.5 h-3.5 text-sky-500" />
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Live market research
                  </p>
                </div>
                <div className="bg-slate-50 border border-slate-100 rounded-xl px-5 py-4 max-h-80 overflow-y-auto">
                  <MarkdownRenderer content={market_research} />
                </div>
              </div>
            )}

            {/* Climate data */}
            {climate_data && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Thermometer className="w-3.5 h-3.5 text-cyan-500" />
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Climate data
                  </p>
                </div>
                <div className="bg-slate-50 border border-slate-100 rounded-xl px-5 py-4 overflow-x-auto">
                  <MarkdownRenderer content={climate_data} />
                </div>
              </div>
            )}
          </div>
        )}
      </ArtifactSection>

      {/* ── SECTION 4: Financial model ── */}
      <ArtifactSection
        id="financial"
        title="Financial model"
        icon={TableProperties}
        iconBg="bg-emerald-50"
        iconColor="text-emerald-600"
        badge={
          financial_model_source === "consultant_override"
            ? "Consultant override"
            : financial_model_source === "report_draft"
              ? "AI-generated"
              : "No model yet"
        }
        badgeColor={
          financial_model_source === "consultant_override"
            ? "bg-emerald-50 text-emerald-700"
            : financial_model_source === "report_draft"
              ? "bg-violet-50 text-violet-700"
              : "bg-slate-100 text-slate-500"
        }
        meta={
          financial_model
            ? `CAPEX: ${formatCurrency(financial_model.capex_total, currency)} · Revenue: ${formatCurrency(financial_model.total_annual_revenue, currency)} · Payback: ${financial_model.payback_years} yrs`
            : undefined
        }
        defaultOpen={!!financial_model}
        downloadOptions={
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
          <p className="text-sm text-slate-400 italic">
            No financial model yet. Generate a report or use the Financial model
            editor in the Analysis tab.
          </p>
        ) : (
          <div className="space-y-5">
            {/* Source indicator */}
            <div
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs border ${
                financial_model_source === "consultant_override"
                  ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                  : "bg-violet-50 border-violet-200 text-violet-800"
              }`}
            >
              {financial_model_source === "consultant_override" ? (
                <>
                  <TableProperties className="w-3.5 h-3.5 flex-shrink-0" />{" "}
                  Consultant-edited override — used in report generation
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5 flex-shrink-0" />{" "}
                  AI-generated model — edit in the Analysis tab to lock in your
                  figures
                </>
              )}
            </div>

            {/* Capital investment */}
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                Capital investment
              </p>
              <div className="grid grid-cols-3 gap-3">
                {[
                  {
                    label: "CAPEX",
                    value: formatCurrency(
                      financial_model.capex_total,
                      currency,
                    ),
                  },
                  {
                    label: "Pre-startup",
                    value: formatCurrency(
                      financial_model.pre_startup_cost,
                      currency,
                    ),
                  },
                  {
                    label: "Total",
                    value: formatCurrency(
                      financial_model.capex_total +
                        financial_model.pre_startup_cost,
                      currency,
                    ),
                  },
                ].map(({ label, value }) => (
                  <div
                    key={label}
                    className="bg-slate-50 rounded-lg px-3 py-2.5 border border-slate-100"
                  >
                    <p className="text-[10px] text-slate-500 font-medium">
                      {label}
                    </p>
                    <p className="text-sm font-bold text-slate-900 mt-0.5 tabular-nums">
                      {value}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Crops table */}
            {financial_model.crops?.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                  Crop projections ({financial_model.crops.length} crops)
                </p>
                <div className="border border-slate-100 rounded-xl overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-slate-50">
                        {[
                          "Crop",
                          "Area (sqm)",
                          "Yield (t/yr)",
                          `Price/kg (${currency})`,
                          "Annual Revenue",
                        ].map((h) => (
                          <th
                            key={h}
                            className="px-4 py-2.5 text-left font-semibold text-slate-600"
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {financial_model.crops.map((crop, i) => (
                        <tr
                          key={i}
                          className="border-t border-slate-50 hover:bg-slate-50/60"
                        >
                          <td className="px-4 py-2.5 font-medium text-slate-800">
                            {crop.name}
                          </td>
                          <td className="px-4 py-2.5 text-slate-600 tabular-nums">
                            {crop.area_sqm.toLocaleString()}
                          </td>
                          <td className="px-4 py-2.5 text-slate-600 tabular-nums">
                            {crop.yield_tonnes.toFixed(1)}
                          </td>
                          <td className="px-4 py-2.5 text-slate-600 tabular-nums">
                            {crop.price_per_kg.toFixed(2)}
                          </td>
                          <td className="px-4 py-2.5 font-semibold text-emerald-700 tabular-nums">
                            {formatCurrency(crop.annual_revenue, currency)}
                          </td>
                        </tr>
                      ))}
                      <tr className="border-t-2 border-slate-200 bg-slate-50">
                        <td
                          colSpan={4}
                          className="px-4 py-2.5 font-semibold text-slate-700 text-right"
                        >
                          Total annual revenue
                        </td>
                        <td className="px-4 py-2.5 font-bold text-emerald-700 tabular-nums">
                          {formatCurrency(
                            financial_model.total_annual_revenue,
                            currency,
                          )}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Profitability summary */}
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                Profitability summary
              </p>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                  {
                    label: "Annual Revenue",
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
                    label: "OPEX / yr",
                    value: formatCurrency(
                      financial_model.growing_cost_annual +
                        financial_model.manpower_cost_annual,
                      currency,
                    ),
                  },
                  {
                    label: "Payback",
                    value: `${financial_model.payback_years} years`,
                  },
                ].map(({ label, value }) => (
                  <div
                    key={label}
                    className="bg-slate-50 rounded-lg px-3 py-2.5 border border-slate-100"
                  >
                    <p className="text-[10px] text-slate-500 font-medium">
                      {label}
                    </p>
                    <p className="text-sm font-bold text-slate-900 mt-0.5">
                      {value}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Assumptions */}
            {financial_model.assumptions?.length ? (
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                  Assumptions
                </p>
                <ul className="space-y-1">
                  {financial_model.assumptions.map((a, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-2 text-xs text-slate-600"
                    >
                      <span className="text-slate-300 mt-0.5">·</span>
                      {a}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {/* Consultant notes */}
            {financial_model_notes && (
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                  Consultant notes
                </p>
                <p className="text-xs text-slate-600 bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 whitespace-pre-wrap leading-relaxed">
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
