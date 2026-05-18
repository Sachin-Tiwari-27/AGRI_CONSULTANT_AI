"use client";
import { useState, useRef, useEffect } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import {
  TrendingUp,
  DollarSign,
  Clock,
  BarChart3,
  Plus,
  X,
  Send,
  Bot,
  User,
  Loader2,
  Trash2,
  Sparkles,
  RefreshCw,
  CloudRain,
  Activity,
  MessageSquare,
  BookOpen,
  Lightbulb,
  Pin,
  Globe,
  Thermometer,
  CheckCircle2,
  ArrowUpRight,
  Zap,
  PenLine,
  Brain,
  TableProperties,
  Wand2,
} from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { MarkdownRenderer } from "@/components/ui/markdown-renderer";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { FinancialModelEditor } from "@/components/analysis/FinancialModelEditor";
import type { Report, Project, FinancialModel } from "@/types";

// ── Types ─────────────────────────────────────────────────────────────
interface ConsultantNote {
  id: string;
  project_id: string;
  category: "market" | "climate" | "technical" | "financial" | "general";
  title: string;
  content: string;
  is_pinned: boolean;
  created_at: string;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

interface AnalysisData {
  marketResearch: string;
  climateData: string;
}

interface Props {
  project: Project & { questionnaire_submissions?: any[] };
  report: Report | null;
  currency: string;
  onGenerateReport: () => void;
  loadingReport: boolean;
}

const NOTE_CATEGORIES = [
  {
    value: "market",
    label: "Market",
    color: "bg-blue-100 text-blue-700 border-blue-200",
    dot: "bg-blue-500",
  },
  {
    value: "climate",
    label: "Climate",
    color: "bg-cyan-100 text-cyan-700 border-cyan-200",
    dot: "bg-cyan-500",
  },
  {
    value: "technical",
    label: "Technical",
    color: "bg-purple-100 text-purple-700 border-purple-200",
    dot: "bg-purple-500",
  },
  {
    value: "financial",
    label: "Financial",
    color: "bg-emerald-100 text-emerald-700 border-emerald-200",
    dot: "bg-emerald-500",
  },
  {
    value: "general",
    label: "General",
    color: "bg-slate-100 text-slate-600 border-slate-200",
    dot: "bg-slate-400",
  },
] as const;

const CHART_PALETTE = [
  "#1A5C38",
  "#2E7D52",
  "#4CAF82",
  "#7DD3B0",
  "#A8E6CA",
  "#D4F5E9",
];

function getCategoryStyle(category: string) {
  return (
    NOTE_CATEGORIES.find((c) => c.value === category) || NOTE_CATEGORIES[4]
  );
}

function CustomTooltip({ active, payload, label, currency }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-900 text-white px-3 py-2 rounded-lg shadow-xl text-xs">
      <p className="font-semibold mb-1 text-slate-300">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color || "#4CAF82" }}>
          {p.name}:{" "}
          {typeof p.value === "number" && p.value > 100
            ? formatCurrency(p.value, currency)
            : p.value}
        </p>
      ))}
    </div>
  );
}

function parseClimateTable(md: string) {
  const rows = md
    .split("\n")
    .filter((r) => r.includes("|") && !r.includes("---"));
  if (rows.length < 2) return [];
  return rows
    .slice(1)
    .map((row) => {
      const cells = row
        .split("|")
        .map((c) => c.trim())
        .filter(Boolean);
      if (cells.length < 4) return null;
      return {
        month: cells[0],
        maxTemp: parseFloat(cells[1]) || 0,
        minTemp: parseFloat(cells[2]) || 0,
        humidity: parseFloat(cells[3]) || 0,
      };
    })
    .filter(Boolean) as {
    month: string;
    maxTemp: number;
    minTemp: number;
    humidity: number;
  }[];
}

// ── Main component ────────────────────────────────────────────────────
export function AnalysisTab({
  project,
  report,
  currency,
  onGenerateReport,
  loadingReport,
}: Props) {
  const [activePanel, setActivePanel] = useState<
    "overview" | "market" | "climate" | "chat" | "financial"
  >("overview");
  const [analysisData, setAnalysisData] = useState<AnalysisData | null>(null);
  const [fetchingData, setFetchingData] = useState(false);
  const [notes, setNotes] = useState<ConsultantNote[]>([]);
  const [loadingNotes, setLoadingNotes] = useState(true);
  const [showAddNote, setShowAddNote] = useState(false);
  const [newNote, setNewNote] = useState({
    title: "",
    content: "",
    category: "general" as ConsultantNote["category"],
  });
  const [addingNote, setAddingNote] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Financial model state
  const [fmLoading, setFmLoading] = useState(false);
  const [fmEstimating, setFmEstimating] = useState(false);
  const [fmData, setFmData] = useState<{
    financialModel: FinancialModel | null;
    notes: string;
    source: "override" | "report_draft" | "none" | "ai_estimate";
  } | null>(null);

  const fm = fmData?.financialModel ?? report?.financial_model ?? null;
  const climateRows = analysisData?.climateData
    ? parseClimateTable(analysisData.climateData)
    : [];

  const cropChartData =
    fm?.crops?.map((c) => ({
      name: c.name.length > 14 ? c.name.slice(0, 12) + "…" : c.name,
      revenue: c.annual_revenue,
      yield: c.yield_tonnes,
      pricePerKg: c.price_per_kg,
      area: c.area_sqm,
    })) || [];

  const costData = fm
    ? [
        { name: "CAPEX", value: fm.capex_total, color: "#1A5C38" },
        { name: "Pre-startup", value: fm.pre_startup_cost, color: "#2E7D52" },
        { name: "Growing/yr", value: fm.growing_cost_annual, color: "#4CAF82" },
        {
          name: "Manpower/yr",
          value: fm.manpower_cost_annual,
          color: "#7DD3B0",
        },
      ].filter((d) => d.value > 0)
    : [];

  useEffect(() => {
    loadNotes();
  }, [project.id]);
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  async function loadNotes() {
    setLoadingNotes(true);
    try {
      const res = await fetch(`/api/analysis/notes?projectId=${project.id}`);
      if (res.ok) setNotes(await res.json());
    } finally {
      setLoadingNotes(false);
    }
  }

  async function loadFinancialModel() {
    setFmLoading(true);
    try {
      const res = await fetch(`/api/projects/${project.id}/financial-model`);
      if (res.ok) setFmData(await res.json());
    } finally {
      setFmLoading(false);
    }
  }

  // ── NEW: Generate AI financial estimate independently ─────────────
  async function generateFinancialEstimate() {
    setFmEstimating(true);
    try {
      const res = await fetch(
        `/api/projects/${project.id}/financial-model/estimate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        },
      );
      const data = await res.json();

      // If override already exists, ask user if they want to force regenerate
      if (res.status === 409) {
        toast.error(
          "A financial model already exists. Edit it directly in the Financial Model tab.",
        );
        setFmEstimating(false);
        setActivePanel("financial");
        await loadFinancialModel();
        return;
      }

      if (!res.ok) throw new Error(data.error || "Failed to generate estimate");

      setFmData({
        financialModel: data.financialModel,
        notes: "",
        source: "ai_estimate",
      });
      toast.success(
        "AI financial estimate generated — review and edit in Financial Model tab",
      );
      setActivePanel("financial");
    } catch (e: any) {
      toast.error(e.message || "Failed to generate financial estimate");
    } finally {
      setFmEstimating(false);
    }
  }

  // Auto-load FM when switching to financial panel
  useEffect(() => {
    if (activePanel === "financial" && !fmData) loadFinancialModel();
  }, [activePanel]);

  async function fetchLiveData(targetPanel?: typeof activePanel) {
    setFetchingData(true);
    try {
      const res = await fetch(`/api/analysis/data/${project.id}`);
      if (!res.ok) throw new Error("Fetch failed");
      setAnalysisData(await res.json());
      toast.success("Market & climate data loaded");
      if (targetPanel) setActivePanel(targetPanel);
    } catch {
      toast.error("Failed to load live data");
    } finally {
      setFetchingData(false);
    }
  }

  async function addNote() {
    if (!newNote.title || !newNote.content) {
      toast.error("Fill in title and content");
      return;
    }
    setAddingNote(true);
    try {
      const res = await fetch("/api/analysis/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: project.id, ...newNote }),
      });
      if (!res.ok) throw new Error();
      const { note } = await res.json();
      setNotes((prev) => [note, ...prev]);
      setNewNote({ title: "", content: "", category: "general" });
      setShowAddNote(false);
      toast.success("Research note saved");
    } catch {
      toast.error("Failed to save note");
    } finally {
      setAddingNote(false);
    }
  }

  async function deleteNote(id: string) {
    try {
      const res = await fetch(`/api/analysis/notes/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error();
      setNotes((prev) => prev.filter((n) => n.id !== id));
      toast.success("Note removed");
    } catch {
      toast.error("Failed to delete note");
    }
  }

  async function togglePin(note: ConsultantNote) {
    try {
      const res = await fetch(`/api/analysis/notes/${note.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_pinned: !note.is_pinned }),
      });
      if (!res.ok) throw new Error();
      const { note: updated } = await res.json();
      setNotes((prev) => prev.map((n) => (n.id === note.id ? updated : n)));
    } catch {
      toast.error("Failed to update");
    }
  }

  async function sendChat() {
    if (!chatInput.trim() || chatLoading) return;
    const userMsg: ChatMessage = {
      role: "user",
      content: chatInput,
      timestamp: new Date().toISOString(),
    };
    setChatMessages((prev) => [...prev, userMsg]);
    setChatInput("");
    setChatLoading(true);
    try {
      const res = await fetch("/api/analysis/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: project.id,
          message: chatInput,
          context: {
            currency,
            market_data: analysisData?.marketResearch?.slice(0, 1000),
            climate_data: analysisData?.climateData?.slice(0, 500),
          },
          history: chatMessages.slice(-8),
        }),
      });
      if (!res.ok) throw new Error();
      const { reply } = await res.json();
      setChatMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: reply,
          timestamp: new Date().toISOString(),
        },
      ]);
    } catch {
      toast.error("AI research failed");
    } finally {
      setChatLoading(false);
    }
  }

  async function saveChatAsNote(msg: ChatMessage) {
    setAddingNote(true);
    try {
      const res = await fetch("/api/analysis/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: project.id,
          title: "AI Research Insight",
          content: msg.content,
          category: "general",
        }),
      });
      if (!res.ok) throw new Error();
      const { note } = await res.json();
      setNotes((prev) => [note, ...prev]);
      toast.success("Saved as research note");
    } catch {
      toast.error("Failed to save");
    } finally {
      setAddingNote(false);
    }
  }

  const notesProps = {
    notes,
    loading: loadingNotes,
    showAddForm: showAddNote,
    newNote,
    addingNote,
    onShowAdd: () => setShowAddNote(true),
    onHideAdd: () => setShowAddNote(false),
    onChangeNote: setNewNote,
    onAddNote: addNote,
    onDelete: deleteNote,
    onTogglePin: togglePin,
  };

  const PANELS = [
    { id: "overview", label: "Overview", icon: BarChart3 },
    { id: "financial", label: "Financial model", icon: TableProperties },
    { id: "market", label: "Market data", icon: Globe },
    { id: "climate", label: "Climate", icon: Thermometer },
    { id: "chat", label: "AI research", icon: Brain },
  ];

  const hasSubmissions =
    (project.questionnaire_submissions?.filter((s: any) => s.submitted_at)
      .length || 0) > 0;

  return (
    // ── FIX: scroll-mt offsets sticky tab nav below the TopBar (73px tall)
    <div className="space-y-0">
      {/* Panel nav — sticky below TopBar */}
      <div className="flex items-center gap-1 mb-6 bg-slate-100 p-1 rounded-xl w-fit flex-wrap">
        {PANELS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActivePanel(id as any)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activePanel === id ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
          >
            <Icon className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="hidden sm:inline">{label}</span>
            {id === "chat" && chatMessages.length > 0 && (
              <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
            )}
            {id === "financial" && fmData?.source === "override" && (
              <span
                className="w-1.5 h-1.5 rounded-full bg-emerald-500"
                title="Consultant override active"
              />
            )}
          </button>
        ))}
      </div>

      {/* ══ OVERVIEW ══════════════════════════════════════════════ */}
      {activePanel === "overview" && (
        <div className="space-y-5">
          {!fm ? (
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
              <div className="lg:col-span-3">
                {/* ── NEW: Two-step flow — FM estimate first, then full report ── */}
                <FinancialFirstCard
                  hasSubmissions={hasSubmissions}
                  hasData={!!analysisData}
                  fetchingData={fetchingData}
                  estimating={fmEstimating}
                  loadingReport={loadingReport}
                  notesCount={notes.length}
                  onFetchData={() => fetchLiveData("market")}
                  onGenerateEstimate={generateFinancialEstimate}
                  onGenerateReport={onGenerateReport}
                />
              </div>
              <div className="lg:col-span-2">
                <NotesPanel {...notesProps} compact />
              </div>
            </div>
          ) : (
            <>
              {/* KPI strip */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                  {
                    label: "Total Investment",
                    value: formatCurrency(fm.capex_total, currency),
                    sub: `+ ${formatCurrency(fm.pre_startup_cost, currency)} pre-startup`,
                    icon: DollarSign,
                    trend: null,
                    bg: "bg-blue-50",
                    iconColor: "text-blue-600",
                  },
                  {
                    label: "Annual Revenue",
                    value: formatCurrency(fm.total_annual_revenue, currency),
                    sub: `${fm.crops?.length || 0} crop streams`,
                    icon: TrendingUp,
                    trend: "up",
                    bg: "bg-emerald-50",
                    iconColor: "text-emerald-600",
                  },
                  {
                    label: "EBITDA",
                    value: formatCurrency(fm.ebitda, currency),
                    sub: `${fm.ebitda_margin}% margin`,
                    icon: BarChart3,
                    trend: fm.ebitda_margin > 25 ? "up" : "neutral",
                    bg: "bg-violet-50",
                    iconColor: "text-violet-600",
                  },
                  {
                    label: "Payback Period",
                    value: `${fm.payback_years} yrs`,
                    sub: "from first harvest",
                    icon: Clock,
                    trend: fm.payback_years < 5 ? "up" : "neutral",
                    bg: "bg-amber-50",
                    iconColor: "text-amber-600",
                  },
                ].map(
                  ({ label, value, sub, icon: Icon, trend, bg, iconColor }) => (
                    <div
                      key={label}
                      className="bg-white rounded-xl border border-slate-200 p-4 flex items-start gap-3"
                    >
                      <div className={`p-2.5 rounded-xl ${bg} flex-shrink-0`}>
                        <Icon className={`w-4 h-4 ${iconColor}`} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs text-slate-500 font-medium truncate">
                          {label}
                        </p>
                        <p className="text-base font-bold text-slate-900 mt-0.5 leading-tight">
                          {value}
                        </p>
                        <div className="flex items-center gap-1 mt-0.5">
                          {trend === "up" && (
                            <ArrowUpRight className="w-3 h-3 text-emerald-500" />
                          )}
                          <p className="text-[11px] text-slate-400 truncate">
                            {sub}
                          </p>
                        </div>
                      </div>
                    </div>
                  ),
                )}
              </div>

              {/* Edit model CTA */}
              <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl px-5 py-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <TableProperties className="w-4 h-4 text-slate-500 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">
                      {fmData?.source === "override" ||
                      fmData?.source === "ai_estimate"
                        ? "Using your saved financial model"
                        : "Using AI-generated financial model"}
                    </p>
                    <p className="text-xs text-slate-500 hidden sm:block">
                      {fmData?.source === "override" ||
                      fmData?.source === "ai_estimate"
                        ? "Figures are locked in — report will use these on next generation."
                        : "Review and correct figures in the Financial model tab."}
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setActivePanel("financial")}
                  className="flex-shrink-0 ml-3"
                >
                  <TableProperties className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">
                    {fmData?.source === "override"
                      ? "Edit model"
                      : "Review & edit"}
                  </span>
                </Button>
              </div>

              {/* Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
                <div className="lg:col-span-3 bg-white rounded-xl border border-slate-200 p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        Revenue by Crop
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Annual projections in {currency}
                      </p>
                    </div>
                    <span className="text-xs bg-emerald-50 text-emerald-700 px-2 py-1 rounded-full font-medium border border-emerald-200">
                      From Financial Model
                    </span>
                  </div>
                  {cropChartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={cropChartData} barSize={32}>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="#f1f5f9"
                          vertical={false}
                        />
                        <XAxis
                          dataKey="name"
                          tick={{ fontSize: 11, fill: "#64748b" }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis
                          tick={{ fontSize: 11, fill: "#64748b" }}
                          axisLine={false}
                          tickLine={false}
                          tickFormatter={(v) =>
                            `${(Number(v) / 1000).toFixed(0)}K`
                          }
                        />
                        <Tooltip
                          content={<CustomTooltip currency={currency} />}
                        />
                        <Bar
                          dataKey="revenue"
                          name="Revenue"
                          fill="#1A5C38"
                          radius={[6, 6, 0, 0]}
                        >
                          {cropChartData.map((_, i) => (
                            <Cell
                              key={i}
                              fill={CHART_PALETTE[i % CHART_PALETTE.length]}
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <EmptyChart label="No crop data in financial model" />
                  )}
                </div>
                <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-5">
                  <p className="text-sm font-semibold text-slate-900 mb-4">
                    Investment Mix
                  </p>
                  {costData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie
                          data={costData}
                          cx="50%"
                          cy="50%"
                          innerRadius={55}
                          outerRadius={80}
                          dataKey="value"
                          paddingAngle={3}
                        >
                          {costData.map((entry, i) => (
                            <Cell key={i} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(v: any) => formatCurrency(v, currency)}
                        />
                        <Legend
                          iconType="circle"
                          iconSize={8}
                          wrapperStyle={{ fontSize: 10, paddingTop: 8 }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <EmptyChart label="No cost data" />
                  )}
                </div>
              </div>

              {/* Crop table */}
              {fm?.crops && fm.crops.length > 0 && (
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                  <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
                    <p className="text-sm font-semibold text-slate-900">
                      Crop-Level Projections
                    </p>
                    <span className="text-xs text-slate-500">{currency}</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-slate-50">
                          {[
                            "Crop",
                            "Area (sqm)",
                            "Yield (t/yr)",
                            "Price/kg",
                            "Annual Revenue",
                          ].map((h) => (
                            <th
                              key={h}
                              className="px-4 py-2.5 text-left font-semibold text-slate-600 whitespace-nowrap"
                            >
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {fm.crops.map((crop, i) => (
                          <tr
                            key={i}
                            className="border-t border-slate-50 hover:bg-slate-50/50 transition-colors"
                          >
                            <td className="px-4 py-2.5 font-medium text-slate-800 flex items-center gap-2">
                              <span
                                className="w-2 h-2 rounded-full flex-shrink-0"
                                style={{
                                  background:
                                    CHART_PALETTE[i % CHART_PALETTE.length],
                                }}
                              />
                              {crop.name}
                            </td>
                            <td className="px-4 py-2.5 text-slate-600 tabular-nums">
                              {crop.area_sqm?.toLocaleString()}
                            </td>
                            <td className="px-4 py-2.5 text-slate-600 tabular-nums">
                              {crop.yield_tonnes?.toFixed(1)}
                            </td>
                            <td className="px-4 py-2.5 text-slate-600 tabular-nums">
                              {currency} {crop.price_per_kg?.toFixed(2)}
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
                            Total
                          </td>
                          <td className="px-4 py-2.5 font-bold text-emerald-700 tabular-nums">
                            {formatCurrency(fm.total_annual_revenue, currency)}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Notes + actions */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                <div className="lg:col-span-2">
                  <NotesPanel {...notesProps} />
                </div>
                <div className="space-y-3">
                  <QuickActions
                    hasData={!!analysisData}
                    fetchingData={fetchingData}
                    onFetchData={() => fetchLiveData("market")}
                    onOpenChat={() => setActivePanel("chat")}
                    onOpenMarket={() => setActivePanel("market")}
                    onOpenFinancial={() => setActivePanel("financial")}
                    notesCount={notes.length}
                    chatCount={chatMessages.length}
                    hasFinancialOverride={
                      fmData?.source === "override" ||
                      fmData?.source === "ai_estimate"
                    }
                  />
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ══ FINANCIAL MODEL ═══════════════════════════════════════ */}
      {activePanel === "financial" && (
        <div>
          {fmLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
            </div>
          ) : !fmData?.financialModel && !report?.financial_model ? (
            // No model yet — show generate CTA
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
              <Wand2 className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-sm font-semibold text-slate-800 mb-1">
                No financial model yet
              </p>
              <p className="text-xs text-slate-500 mb-5 max-w-sm mx-auto">
                Generate an AI estimate from your questionnaire data, then
                review and edit the figures before generating the full report.
              </p>
              <Button
                onClick={generateFinancialEstimate}
                loading={fmEstimating}
                disabled={!hasSubmissions}
              >
                <Wand2 className="w-4 h-4" />
                {hasSubmissions
                  ? "Generate AI Financial Estimate"
                  : "Collect questionnaire data first"}
              </Button>
            </div>
          ) : (
            <FinancialModelEditor
              projectId={project.id}
              currency={currency}
              initialModel={
                fmData?.financialModel ?? report?.financial_model ?? null
              }
              initialNotes={fmData?.notes ?? ""}
              source={fmData?.source ?? "none"}
              onSaved={(saved, savedNotes) => {
                setFmData((prev) => ({
                  ...prev!,
                  financialModel: saved,
                  notes: savedNotes,
                  source: "override",
                }));
              }}
            />
          )}
        </div>
      )}

      {/* ══ MARKET DATA ═══════════════════════════════════════════ */}
      {activePanel === "market" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl border border-slate-200">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
                    <Globe className="w-4 h-4 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      Live Market Research
                    </p>
                    <p className="text-xs text-slate-500">
                      AI-aggregated from web sources
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => fetchLiveData("market")}
                  loading={fetchingData}
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Refresh
                </Button>
              </div>
              <div className="p-5 max-h-[480px] overflow-y-auto">
                {analysisData?.marketResearch ? (
                  <MarkdownRenderer content={analysisData.marketResearch} />
                ) : (
                  <FetchPrompt
                    onFetch={() => fetchLiveData("market")}
                    loading={fetchingData}
                    icon={<Globe className="w-8 h-8 text-slate-300" />}
                    title="Load market research"
                    desc="Pull live market data, crop prices, and demand analysis for this project."
                  />
                )}
              </div>
            </div>
          </div>
          <div>
            <NotesPanel {...notesProps} />
          </div>
        </div>
      )}

      {/* ══ CLIMATE ═══════════════════════════════════════════════ */}
      {activePanel === "climate" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2">
            {climateRows.length > 0 ? (
              <div className="bg-white rounded-xl border border-slate-200">
                <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 bg-cyan-50 rounded-lg flex items-center justify-center">
                      <CloudRain className="w-4 h-4 text-cyan-600" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        Climate Analysis
                      </p>
                      <p className="text-xs text-slate-500">
                        Historical temperature & humidity averages
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => fetchLiveData("climate")}
                    loading={fetchingData}
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> Refresh
                  </Button>
                </div>
                <div className="p-5 space-y-6">
                  <ResponsiveContainer width="100%" height={240}>
                    <AreaChart data={climateRows}>
                      <defs>
                        <linearGradient id="maxG" x1="0" y1="0" x2="0" y2="1">
                          <stop
                            offset="5%"
                            stopColor="#ef4444"
                            stopOpacity={0.2}
                          />
                          <stop
                            offset="95%"
                            stopColor="#ef4444"
                            stopOpacity={0}
                          />
                        </linearGradient>
                        <linearGradient id="minG" x1="0" y1="0" x2="0" y2="1">
                          <stop
                            offset="5%"
                            stopColor="#3b82f6"
                            stopOpacity={0.2}
                          />
                          <stop
                            offset="95%"
                            stopColor="#3b82f6"
                            stopOpacity={0}
                          />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="#f1f5f9"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="month"
                        tick={{ fontSize: 11, fill: "#64748b" }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 11, fill: "#64748b" }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(v) => `${v}°`}
                      />
                      <Tooltip formatter={(v: any) => `${v}°C`} />
                      <Area
                        type="monotone"
                        dataKey="maxTemp"
                        name="Max Temp"
                        stroke="#ef4444"
                        fill="url(#maxG)"
                        strokeWidth={2.5}
                        dot={{ fill: "#ef4444", r: 3 }}
                      />
                      <Area
                        type="monotone"
                        dataKey="minTemp"
                        name="Min Temp"
                        stroke="#3b82f6"
                        fill="url(#minG)"
                        strokeWidth={2.5}
                        dot={{ fill: "#3b82f6", r: 3 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
                <FetchPrompt
                  onFetch={() => fetchLiveData("climate")}
                  loading={fetchingData}
                  icon={
                    <Thermometer className="w-8 h-8 text-slate-300 mx-auto" />
                  }
                  title="Load climate data"
                  desc="Pull historical temperature and humidity data for this GPS location."
                />
              </div>
            )}
          </div>
          <div>
            <NotesPanel {...notesProps} />
          </div>
        </div>
      )}

      {/* ══ AI CHAT ════════════════════════════════════════════════ */}
      {activePanel === "chat" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 h-[calc(100vh-260px)] min-h-[500px]">
          <div className="lg:col-span-2 flex flex-col bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-100 flex items-center gap-3 bg-gradient-to-r from-slate-900 to-slate-800">
              <div className="w-7 h-7 bg-emerald-500/20 rounded-lg flex items-center justify-center">
                <Brain className="w-4 h-4 text-emerald-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">
                  AI Research Assistant
                </p>
                <p className="text-[11px] text-slate-400">
                  Aware of project context, market data & your notes
                </p>
              </div>
              <div className="ml-auto flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs text-emerald-400">Online</span>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {chatMessages.length === 0 && (
                <div className="text-center py-8">
                  <Brain className="w-10 h-10 text-slate-200 mx-auto mb-3" />
                  <p className="text-sm font-medium text-slate-700">
                    Research Assistant Ready
                  </p>
                  <div className="mt-4 grid grid-cols-1 gap-2 max-w-sm mx-auto">
                    {[
                      `What are current ${(project.crop_types as string[])?.[0] || "tomato"} prices in ${(project as any).country}?`,
                      `What cooling strategy works best for ${(project as any).region}?`,
                      "What are the biggest risks for this project?",
                    ].map((s) => (
                      <button
                        key={s}
                        onClick={() => setChatInput(s)}
                        className="text-left text-xs text-slate-500 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg px-3 py-2 transition-colors"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {chatMessages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex gap-2.5 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  {msg.role === "assistant" && (
                    <div className="w-7 h-7 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Brain className="w-3.5 h-3.5 text-emerald-700" />
                    </div>
                  )}
                  <div
                    className={`max-w-[80%] rounded-xl px-3.5 py-2.5 ${msg.role === "user" ? "bg-slate-900 text-white text-sm" : "bg-slate-50 border border-slate-200"}`}
                  >
                    {msg.role === "assistant" ? (
                      <MarkdownRenderer content={msg.content} />
                    ) : (
                      <p className="text-sm">{msg.content}</p>
                    )}
                    {msg.role === "assistant" && (
                      <button
                        onClick={() => saveChatAsNote(msg)}
                        className="mt-2 text-[11px] text-slate-400 hover:text-emerald-600 flex items-center gap-1 transition-colors"
                      >
                        <BookOpen className="w-3 h-3" /> Save as research note
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {chatLoading && (
                <div className="flex gap-2.5">
                  <div className="w-7 h-7 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <Brain className="w-3.5 h-3.5 text-emerald-700" />
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 flex items-center gap-2">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" />
                    <span className="text-xs text-slate-500">Researching…</span>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
            <div className="p-3 border-t border-slate-100">
              <div className="flex gap-2">
                <input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) =>
                    e.key === "Enter" && !e.shiftKey && sendChat()
                  }
                  placeholder="Ask about crops, markets, climate, risks…"
                  className="flex-1 px-3.5 py-2.5 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white placeholder:text-slate-400"
                  disabled={chatLoading}
                />
                <Button
                  onClick={sendChat}
                  loading={chatLoading}
                  disabled={!chatInput.trim() || chatLoading}
                  size="sm"
                >
                  <Send className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          </div>
          <div>
            <NotesPanel {...notesProps} />
          </div>
        </div>
      )}
    </div>
  );
}

// ── NEW: Two-step financial-first card ────────────────────────────────
function FinancialFirstCard({
  hasSubmissions,
  hasData,
  fetchingData,
  estimating,
  loadingReport,
  notesCount,
  onFetchData,
  onGenerateEstimate,
  onGenerateReport,
}: any) {
  return (
    <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl p-6 text-white h-full flex flex-col">
      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-9 h-9 bg-emerald-500/20 rounded-xl flex items-center justify-center">
          <Zap className="w-5 h-5 text-emerald-400" />
        </div>
        <div>
          <p className="text-sm font-bold">Start with Financial Analysis</p>
          <p className="text-xs text-slate-400">
            Generate the model first, then build the report
          </p>
        </div>
      </div>

      {/* Step indicators */}
      <div className="space-y-3 mb-5">
        {[
          {
            step: 1,
            label: "Questionnaire submitted",
            done: hasSubmissions,
            action: null,
            actionLabel: null,
            loading: false,
          },
          {
            step: 2,
            label: "Market & climate data",
            done: hasData,
            action: onFetchData,
            actionLabel: "Load Now",
            loading: fetchingData,
          },
          {
            step: 3,
            label: `Research notes (${notesCount})`,
            done: notesCount > 0,
            action: null,
            actionLabel: null,
            loading: false,
          },
        ].map(
          ({
            step,
            label,
            done,
            action,
            actionLabel,
            loading: itemLoading,
          }) => (
            <div key={step} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {done ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                ) : (
                  <div className="w-3.5 h-3.5 rounded-full border border-slate-600 flex-shrink-0 flex items-center justify-center">
                    <span className="text-[9px] text-slate-400">{step}</span>
                  </div>
                )}
                <span
                  className={`text-xs ${done ? "text-slate-300" : "text-slate-500"}`}
                >
                  {label}
                </span>
              </div>
              {action && !done && (
                <button
                  onClick={action}
                  disabled={itemLoading}
                  className="text-[11px] text-emerald-400 hover:text-emerald-300 font-medium disabled:opacity-50"
                >
                  {itemLoading ? "Loading…" : actionLabel}
                </button>
              )}
            </div>
          ),
        )}
      </div>

      {/* Step 1: Generate FM estimate */}
      <Button
        onClick={onGenerateEstimate}
        loading={estimating}
        disabled={!hasSubmissions}
        className="bg-emerald-600 hover:bg-emerald-500 border-emerald-500 w-full mb-3"
      >
        <Wand2 className="w-4 h-4" />
        {hasSubmissions
          ? "Step 1 — Generate Financial Model"
          : "Awaiting Questionnaire Data"}
      </Button>

      {/* Step 2: Full report (secondary) */}
      <Button
        onClick={onGenerateReport}
        loading={loadingReport}
        disabled={!hasSubmissions}
        variant="ghost"
        className="w-full text-slate-400 hover:text-white hover:bg-white/10 border-transparent text-sm"
      >
        Step 2 — Generate Full Report (after reviewing model)
      </Button>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────
function NotesPanel({
  notes,
  loading,
  showAddForm,
  newNote,
  addingNote,
  onShowAdd,
  onHideAdd,
  onChangeNote,
  onAddNote,
  onDelete,
  onTogglePin,
  compact,
  filterLabel,
}: any) {
  const pinned = notes.filter((n: any) => n.is_pinned);
  const unpinned = notes.filter((n: any) => !n.is_pinned);
  return (
    <div className="bg-white rounded-xl border border-slate-200 flex flex-col overflow-hidden">
      <div className="px-4 py-3.5 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <PenLine className="w-3.5 h-3.5 text-slate-500" />
          <p className="text-sm font-semibold text-slate-900">
            {filterLabel || "Research Notes"}
          </p>
          {notes.length > 0 && (
            <span className="text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-full">
              {notes.length}
            </span>
          )}
        </div>
        <button
          onClick={onShowAdd}
          className="flex items-center gap-1 text-xs text-emerald-700 hover:text-emerald-800 font-medium px-2 py-1 rounded-lg hover:bg-emerald-50 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" /> Add
        </button>
      </div>
      {showAddForm && (
        <div className="p-4 border-b border-slate-100 bg-slate-50/60 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-700">
              New Research Note
            </p>
            <button onClick={onHideAdd}>
              <X className="w-3.5 h-3.5 text-slate-400 hover:text-slate-600" />
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {NOTE_CATEGORIES.map((cat) => (
              <button
                key={cat.value}
                type="button"
                onClick={() =>
                  onChangeNote({ ...newNote, category: cat.value })
                }
                className={`px-2.5 py-1 rounded-full text-xs border font-medium transition-colors ${newNote.category === cat.value ? cat.color : "bg-white border-slate-200 text-slate-500 hover:border-slate-300"}`}
              >
                {cat.label}
              </button>
            ))}
          </div>
          <input
            value={newNote.title}
            onChange={(e) =>
              onChangeNote({ ...newNote, title: e.target.value })
            }
            placeholder="Note title *"
            className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
          />
          <textarea
            rows={3}
            value={newNote.content}
            onChange={(e) =>
              onChangeNote({ ...newNote, content: e.target.value })
            }
            placeholder="Your research insight, pointer, or finding…"
            className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none bg-white"
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={onAddNote}
              loading={addingNote}
              className="flex-1"
            >
              <BookOpen className="w-3.5 h-3.5" /> Save Note
            </Button>
            <Button size="sm" variant="ghost" onClick={onHideAdd}>
              Cancel
            </Button>
          </div>
        </div>
      )}
      <div
        className={`overflow-y-auto ${compact ? "max-h-72" : "max-h-[480px]"}`}
      >
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="w-5 h-5 animate-spin text-slate-300" />
          </div>
        ) : notes.length === 0 ? (
          <div className="text-center py-8 px-4">
            <Lightbulb className="w-6 h-6 text-slate-200 mx-auto mb-2" />
            <p className="text-xs text-slate-500 font-medium">
              No research notes yet
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {pinned.length > 0 && (
              <div>
                <p className="px-4 py-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                  Pinned
                </p>
                {pinned.map((note: any) => (
                  <NoteCard
                    key={note.id}
                    note={note}
                    onDelete={onDelete}
                    onTogglePin={onTogglePin}
                  />
                ))}
              </div>
            )}
            {unpinned.length > 0 && (
              <div>
                {pinned.length > 0 && (
                  <p className="px-4 py-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                    Notes
                  </p>
                )}
                {unpinned.map((note: any) => (
                  <NoteCard
                    key={note.id}
                    note={note}
                    onDelete={onDelete}
                    onTogglePin={onTogglePin}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function NoteCard({ note, onDelete, onTogglePin }: any) {
  const [expanded, setExpanded] = useState(false);
  const cat = getCategoryStyle(note.category);
  return (
    <div className="px-4 py-3 hover:bg-slate-50/60 transition-colors group">
      <div className="flex items-start gap-2">
        <span
          className={`w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5 ${cat.dot}`}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <button
              onClick={() => setExpanded((e) => !e)}
              className="text-left flex-1 min-w-0"
            >
              <p className="text-xs font-semibold text-slate-800 leading-snug truncate">
                {note.title}
              </p>
            </button>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
              <button
                onClick={() => onTogglePin(note)}
                className={`p-0.5 rounded transition-colors ${note.is_pinned ? "text-amber-500" : "text-slate-300 hover:text-amber-400"}`}
              >
                <Pin className="w-3 h-3" />
              </button>
              <button
                onClick={() => onDelete(note.id)}
                className="p-0.5 rounded text-slate-300 hover:text-red-400 transition-colors"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          </div>
          <span
            className={`inline-block text-[10px] px-1.5 py-0.5 rounded border font-medium mt-1 ${cat.color}`}
          >
            {cat.label}
          </span>
          {expanded && (
            <p className="text-xs text-slate-600 mt-1.5 leading-relaxed whitespace-pre-wrap">
              {note.content}
            </p>
          )}
          {!expanded && note.content && (
            <p className="text-xs text-slate-400 mt-0.5 truncate">
              {note.content.slice(0, 80)}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function EmptyChart({ label }: { label: string }) {
  return (
    <div className="h-48 flex flex-col items-center justify-center">
      <BarChart3 className="w-8 h-8 text-slate-200 mb-2" />
      <p className="text-xs text-slate-400">{label}</p>
    </div>
  );
}

function FetchPrompt({ onFetch, loading, icon, title, desc }: any) {
  return (
    <div className="text-center py-8 px-4">
      <div className="mb-3">{icon}</div>
      <p className="text-sm font-medium text-slate-700">{title}</p>
      <p className="text-xs text-slate-400 mt-1 mb-4">{desc}</p>
      <Button size="sm" variant="secondary" onClick={onFetch} loading={loading}>
        <RefreshCw className="w-3.5 h-3.5" /> Load Data
      </Button>
    </div>
  );
}

function QuickActions({
  hasData,
  fetchingData,
  onFetchData,
  onOpenChat,
  onOpenMarket,
  onOpenFinancial,
  notesCount,
  chatCount,
  hasFinancialOverride,
}: any) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-2.5">
      <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
        Quick Actions
      </p>
      {[
        {
          icon: TableProperties,
          label: hasFinancialOverride
            ? "Edit financial model"
            : "Review financial model",
          sub: hasFinancialOverride
            ? "Consultant override active"
            : "View & correct AI-generated figures",
          onClick: onOpenFinancial,
          loading: false,
          color: "bg-emerald-50 text-emerald-600",
        },
        {
          icon: Globe,
          label: hasData ? "Refresh market data" : "Load market & climate data",
          sub: hasData ? "Update from live sources" : "Tavily + Open-Meteo",
          onClick: onFetchData,
          loading: fetchingData,
          color: "bg-blue-50 text-blue-600",
        },
        {
          icon: Brain,
          label: "AI Research Assistant",
          sub:
            chatCount > 0
              ? `${chatCount} messages`
              : "Ask questions about this project",
          onClick: onOpenChat,
          loading: false,
          color: "bg-emerald-50 text-emerald-600",
        },
        {
          icon: Activity,
          label: "Market analysis",
          sub: "View full market research",
          onClick: onOpenMarket,
          loading: false,
          color: "bg-purple-50 text-purple-600",
        },
      ].map(({ icon: Icon, label, sub, onClick, loading, color }) => (
        <button
          key={label}
          onClick={onClick}
          disabled={loading}
          className="w-full flex items-center gap-3 p-2.5 rounded-lg border border-slate-100 hover:border-slate-200 hover:bg-slate-50 transition-all text-left disabled:opacity-50"
        >
          <div
            className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${color}`}
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Icon className="w-4 h-4" />
            )}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-slate-800 truncate">
              {label}
            </p>
            <p className="text-[11px] text-slate-400 truncate">{sub}</p>
          </div>
        </button>
      ))}
    </div>
  );
}
