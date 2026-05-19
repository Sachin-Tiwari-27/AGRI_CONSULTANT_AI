"use client";

import { useState, useRef, useEffect } from "react";
import {
  RefreshCw,
  Globe,
  Thermometer,
  Brain,
  Send,
  Loader2,
  BookOpen,
  Lightbulb,
  Plus,
  X,
  Pin,
  Trash2,
  BarChart3,
  CloudRain,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/status";
import { MarkdownRenderer } from "@/components/ui/markdown-renderer";
import { toast } from "@/components/ui/toast";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { Report, Project } from "@/types";

/* ── Types ───────────────────────────────────────────────────────── */
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

const analysisCache: Record<string, AnalysisData> = {};

interface Props {
  project: Project & { questionnaire_submissions?: any[] };
  report: Report | null;
  currency: string;
  onGenerateReport: () => void;
  loadingReport: boolean;
  onNavigateToFinancial: () => void;
  /** Called after market/climate data is fetched & persisted, so the parent
   *  workspace project state stays in sync and survives tab remounts. */
  onDataLoaded?: (patch: { market_research: string; climate_data: string }) => void;
}

/* ── Note category styles ────────────────────────────────────────── */
const NOTE_CATS = {
  market: { label: "Market", badge: "blue" as const },
  climate: { label: "Climate", badge: "violet" as const },
  technical: { label: "Technical", badge: "purple" as const },
  financial: { label: "Financial", badge: "green" as const },
  general: { label: "General", badge: "gray" as const },
};

/* ── Climate table parser ────────────────────────────────────────── */
function parseClimateRows(md: string) {
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

/* ── Main component ──────────────────────────────────────────────── */
export function AnalysisTab({
  project,
  report,
  currency,
  onGenerateReport,
  loadingReport,
  onNavigateToFinancial,
  onDataLoaded,
}: Props) {
  type Panel = "market" | "climate" | "chat";
  const [panel, setPanel] = useState<Panel>("market");
  const [analysisData, setData] = useState<AnalysisData | null>(
    analysisCache[project.id] ||
      (project.market_research && project.climate_data
        ? { marketResearch: project.market_research, climateData: project.climate_data }
        : null)
  );
  const [fetching, setFetching] = useState(false);
  const [notes, setNotes] = useState<ConsultantNote[]>([]);
  const [loadingNotes, setLoadingNotes] = useState(true);
  const [showAddNote, setShowAddNote] = useState(false);
  const [addingNote, setAddingNote] = useState(false);
  const [newNote, setNewNote] = useState({
    title: "",
    content: "",
    category: "general" as ConsultantNote["category"],
  });
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const climateRows = analysisData?.climateData
    ? parseClimateRows(analysisData.climateData)
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

  async function fetchLiveData() {
    setFetching(true);
    try {
      const res = await fetch(`/api/analysis/data/${project.id}`);
      if (!res.ok) throw new Error("Fetch failed");
      const data = await res.json();
      setData(data);
      analysisCache[project.id] = data;
      // Sync parent so the data survives tab remounts
      onDataLoaded?.({
        market_research: data.marketResearch,
        climate_data: data.climateData,
      });
      toast.success("Market & climate data loaded");
    } catch {
      toast.error("Failed to load live data");
    } finally {
      setFetching(false);
    }
  }

  async function refreshLiveData() {
    setFetching(true);
    try {
      // Bust the server-side cache first
      await fetch(`/api/analysis/data/${project.id}`, { method: "DELETE" });
      delete analysisCache[project.id];
      setData(null);
      // Then re-fetch (will call AI again)
      const res = await fetch(`/api/analysis/data/${project.id}`);
      if (!res.ok) throw new Error("Fetch failed");
      const data = await res.json();
      setData(data);
      analysisCache[project.id] = data;
      // Sync parent so the refreshed data survives tab remounts
      onDataLoaded?.({
        market_research: data.marketResearch,
        climate_data: data.climateData,
      });
      toast.success("Market & climate data refreshed");
    } catch {
      toast.error("Failed to refresh data");
    } finally {
      setFetching(false);
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
    }
  }

  /* ── Panel nav ──────────────────────────────────────────────────── */
  const PANELS: { id: Panel; label: string; icon: React.ElementType }[] = [
    { id: "market", label: "Market data", icon: Globe },
    { id: "climate", label: "Climate", icon: Thermometer },
    { id: "chat", label: "AI research", icon: Brain },
  ];

  return (
    <div className="max-w-6xl mx-auto">
      <div className="grid grid-cols-3 gap-5 items-start">
        {/* ── Left: panel switcher + content ─────────────────────── */}
        <div className="col-span-2 space-y-3">
          {/* Panel tabs */}
          <div className="flex items-center gap-1 bg-muted p-1 rounded-lg w-fit">
            {PANELS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setPanel(id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  panel === id
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="size-3.5" />
                {label}
                {id === "chat" && chatMessages.length > 0 && (
                  <span className="size-1.5 rounded-full bg-brand-500" />
                )}
              </button>
            ))}
            <Button
              size="sm"
              variant="ghost"
              onClick={analysisData ? refreshLiveData : fetchLiveData}
              loading={fetching}
              className="ml-1"
            >
              <RefreshCw className="size-3.5" />
              {analysisData ? "Refresh" : "Load data"}
            </Button>
          </div>

          {/* ── Market data panel ─────────────────────────────────── */}
          {panel === "market" && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center justify-between">
                  Market Research
                  {analysisData?.marketResearch && (
                    <Badge variant="blue">Live data</Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                {analysisData?.marketResearch ? (
                  <div className="max-h-[520px] overflow-y-auto scrollbar-thin">
                    <MarkdownRenderer content={analysisData.marketResearch} />
                  </div>
                ) : (
                  <div className="py-12 text-center">
                    <Globe className="size-8 text-muted-foreground/30 mx-auto mb-3" />
                    <p className="text-sm font-medium text-foreground">
                      Load market research
                    </p>
                    <p className="text-xs text-muted-foreground mt-1 mb-4">
                      Pull live crop prices, demand data, and market analysis.
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={fetchLiveData}
                      loading={fetching}
                    >
                      <RefreshCw className="size-3.5" /> Load data
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* ── Climate panel ─────────────────────────────────────── */}
          {panel === "climate" && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center justify-between">
                  Climate Data
                  {climateRows.length > 0 && (
                    <Badge variant="violet">Historical averages</Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                {climateRows.length > 0 ? (
                  <div className="space-y-5">
                    <ResponsiveContainer width="100%" height={220}>
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
                          strokeWidth={2}
                          dot={{ fill: "#ef4444", r: 2 }}
                        />
                        <Area
                          type="monotone"
                          dataKey="minTemp"
                          name="Min Temp"
                          stroke="#3b82f6"
                          fill="url(#minG)"
                          strokeWidth={2}
                          dot={{ fill: "#3b82f6", r: 2 }}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                    <MarkdownRenderer
                      content={analysisData?.climateData ?? ""}
                    />
                  </div>
                ) : (
                  <div className="py-12 text-center">
                    <CloudRain className="size-8 text-muted-foreground/30 mx-auto mb-3" />
                    <p className="text-sm font-medium text-foreground">
                      Load climate data
                    </p>
                    <p className="text-xs text-muted-foreground mt-1 mb-4">
                      Pull historical temperature and humidity for this GPS
                      location.
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={fetchLiveData}
                      loading={fetching}
                    >
                      <RefreshCw className="size-3.5" /> Load data
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* ── AI Chat panel ─────────────────────────────────────── */}
          {panel === "chat" && (
            <div
              className="flex flex-col bg-card border border-border rounded-xl overflow-hidden"
              style={{ height: 540 }}
            >
              {/* Chat header */}
              <div className="px-5 py-3.5 border-b border-border bg-slate-900 flex items-center gap-3">
                <div className="w-7 h-7 bg-brand-500/20 rounded-lg flex items-center justify-center">
                  <Brain className="size-4 text-brand-400" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-white">
                    AI Research Assistant
                  </p>
                  <p className="text-[10px] text-slate-400">
                    Aware of project context and your notes
                  </p>
                </div>
                <span className="ml-auto flex items-center gap-1.5 text-[10px] text-brand-400">
                  <span className="size-1.5 rounded-full bg-brand-400 animate-pulse" />
                  Online
                </span>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin">
                {chatMessages.length === 0 && (
                  <div className="text-center py-8">
                    <Brain className="size-8 text-muted-foreground/20 mx-auto mb-3" />
                    <p className="text-xs font-medium text-foreground">
                      Research Assistant Ready
                    </p>
                    <div className="mt-3 space-y-1.5 max-w-xs mx-auto">
                      {[
                        `What are current ${(project.crop_types as string[])?.[0] || "tomato"} prices in ${(project as any).country}?`,
                        "What cooling strategy works best for this region?",
                        "What are the biggest risks for this project?",
                      ].map((s) => (
                        <button
                          key={s}
                          onClick={() => setChatInput(s)}
                          className="w-full text-left text-[11px] text-muted-foreground bg-muted hover:bg-muted/80 border border-border rounded-lg px-3 py-2 transition-colors"
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
                      <div className="w-6 h-6 bg-brand-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Brain className="size-3.5 text-brand-700" />
                      </div>
                    )}
                    <div
                      className={`max-w-[78%] rounded-xl px-3.5 py-2.5 ${
                        msg.role === "user"
                          ? "bg-foreground text-background text-sm"
                          : "bg-muted border border-border"
                      }`}
                    >
                      {msg.role === "assistant" ? (
                        <MarkdownRenderer content={msg.content} />
                      ) : (
                        <p className="text-sm">{msg.content}</p>
                      )}
                      {msg.role === "assistant" && (
                        <button
                          onClick={() => saveChatAsNote(msg)}
                          className="mt-1.5 flex items-center gap-1 text-[10px] text-muted-foreground hover:text-brand-700 transition-colors"
                        >
                          <BookOpen className="size-3" /> Save as note
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                {chatLoading && (
                  <div className="flex gap-2.5">
                    <div className="w-6 h-6 bg-brand-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <Brain className="size-3.5 text-brand-700" />
                    </div>
                    <div className="bg-muted border border-border rounded-xl px-4 py-3 flex items-center gap-2">
                      <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">
                        Researching…
                      </span>
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Input */}
              <div className="p-3 border-t border-border">
                <div className="flex gap-2">
                  <input
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) =>
                      e.key === "Enter" && !e.shiftKey && sendChat()
                    }
                    placeholder="Ask about crops, markets, climate, risks…"
                    disabled={chatLoading}
                    className="flex-1 h-9 px-3 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground"
                  />
                  <Button
                    size="sm"
                    onClick={sendChat}
                    loading={chatLoading}
                    disabled={!chatInput.trim()}
                  >
                    <Send className="size-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Right: Research notes ────────────────────────────────── */}
        <div className="space-y-3">
          <NotesPanel
            notes={notes}
            loading={loadingNotes}
            showAddForm={showAddNote}
            newNote={newNote}
            addingNote={addingNote}
            onShowAdd={() => setShowAddNote(true)}
            onHideAdd={() => setShowAddNote(false)}
            onChangeNote={setNewNote}
            onAddNote={addNote}
            onDelete={deleteNote}
            onTogglePin={togglePin}
          />
        </div>
      </div>
    </div>
  );
}

/* ── Notes panel ─────────────────────────────────────────────────── */
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
}: any) {
  const pinned = notes.filter((n: any) => n.is_pinned);
  const unpinned = notes.filter((n: any) => !n.is_pinned);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            Research Notes
            {notes.length > 0 && <Badge variant="gray">{notes.length}</Badge>}
          </span>
          <button
            onClick={onShowAdd}
            className="flex items-center gap-1 text-[11px] text-brand-700 hover:text-brand-800 font-medium"
          >
            <Plus className="size-3.5" /> Add
          </button>
        </CardTitle>
      </CardHeader>

      {showAddForm && (
        <div className="mx-4 mb-4 p-3 rounded-lg border border-border bg-muted/30 space-y-2.5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium">New note</p>
            <button onClick={onHideAdd}>
              <X className="size-3.5 text-muted-foreground" />
            </button>
          </div>
          <div className="flex flex-wrap gap-1">
            {Object.entries(NOTE_CATS).map(([val, { label, badge }]) => (
              <button
                key={val}
                type="button"
                onClick={() => onChangeNote({ ...newNote, category: val })}
                className={`text-[10px] px-2 py-0.5 rounded-full border font-medium transition-colors ${
                  newNote.category === val
                    ? "bg-foreground text-background border-foreground"
                    : "bg-card border-border text-muted-foreground hover:border-foreground/30"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <input
            value={newNote.title}
            onChange={(e) =>
              onChangeNote({ ...newNote, title: e.target.value })
            }
            placeholder="Note title *"
            className="w-full h-8 px-2.5 text-xs rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <textarea
            rows={3}
            value={newNote.content}
            onChange={(e) =>
              onChangeNote({ ...newNote, content: e.target.value })
            }
            placeholder="Your research insight…"
            className="w-full px-2.5 py-2 text-xs rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring resize-none"
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={onAddNote}
              loading={addingNote}
              className="flex-1"
            >
              Save note
            </Button>
            <Button size="sm" variant="ghost" onClick={onHideAdd}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      <CardContent className="pt-0">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          </div>
        ) : notes.length === 0 ? (
          <div className="text-center py-8">
            <Lightbulb className="size-6 text-muted-foreground/20 mx-auto mb-2" />
            <p className="text-xs text-muted-foreground">
              No research notes yet
            </p>
          </div>
        ) : (
          <div className="space-y-px max-h-[480px] overflow-y-auto scrollbar-thin">
            {pinned.length > 0 && (
              <>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide pb-1.5">
                  Pinned
                </p>
                {pinned.map((n: any) => (
                  <NoteCard
                    key={n.id}
                    note={n}
                    onDelete={onDelete}
                    onTogglePin={onTogglePin}
                  />
                ))}
              </>
            )}
            {unpinned.map((n: any) => (
              <NoteCard
                key={n.id}
                note={n}
                onDelete={onDelete}
                onTogglePin={onTogglePin}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function NoteCard({ note, onDelete, onTogglePin }: any) {
  const [expanded, setExpanded] = useState(false);
  const cat =
    NOTE_CATS[note.category as keyof typeof NOTE_CATS] ?? NOTE_CATS.general;

  return (
    <div className="group py-2.5 border-b border-border/50 last:border-0">
      <div className="flex items-start gap-2">
        <div 
          className="flex-1 min-w-0 cursor-pointer"
          onClick={() => setExpanded((e) => !e)}
        >
          <p className="text-xs font-medium text-foreground leading-snug truncate">
            {note.title}
          </p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <Badge variant={cat.badge} className="text-[9px] py-0">
              {cat.label}
            </Badge>
          </div>
          {expanded && (
            <p className="text-[11px] text-muted-foreground mt-1.5 leading-relaxed whitespace-pre-wrap">
              {note.content}
            </p>
          )}
          {!expanded && (
            <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
              {note.content.slice(0, 60)}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
          <button
            onClick={() => onTogglePin(note)}
            className={`p-0.5 rounded transition-colors ${
              note.is_pinned
                ? "text-amber-500"
                : "text-muted-foreground hover:text-amber-400"
            }`}
          >
            <Pin className="size-3" />
          </button>
          <button
            onClick={() => onDelete(note.id)}
            className="p-0.5 rounded text-muted-foreground hover:text-destructive transition-colors"
          >
            <Trash2 className="size-3" />
          </button>
        </div>
      </div>
    </div>
  );
}
