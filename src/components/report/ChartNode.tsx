"use client";

/**
 * ChartNode — a custom Tiptap node that renders Recharts charts inline.
 *
 * Stored as:
 *   <div data-type="chart" data-chart-type="bar" data-title="..." data-data="[...]">
 *
 * Renders in editor:    React Recharts component
 * Renders in PDF:       Plain text table (charts can't render in @react-pdf)
 * Serialised to MD:     <!-- chart:bar:Title:[...json...] -->
 */

import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer, NodeViewWrapper } from "@tiptap/react";
import React, { useState } from "react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Edit2, Trash2, Check, X } from "lucide-react";

/* ── Chart colour palette ────────────────────────────────────────── */
const PALETTE = [
  "#1a5c38",
  "#2e7d52",
  "#4cb57a",
  "#7dd3b0",
  "#3b82f6",
  "#8b5cf6",
  "#f59e0b",
  "#ef4444",
];

export interface ChartDataPoint {
  label: string;
  value: number;
  color?: string;
}

export type ChartType = "bar" | "line" | "pie" | "area";

/* ── Node view component ─────────────────────────────────────────── */
function ChartNodeView({ node, updateAttributes, deleteNode, selected }: any) {
  const chartType: ChartType = node.attrs.chartType || "bar";
  const title: string = node.attrs.title || "";
  const currency: string = node.attrs.currency || "";
  const rawData: string = node.attrs.data || "[]";

  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(title);
  const [editData, setEditData] = useState(rawData);
  const [editType, setEditType] = useState<ChartType>(chartType);
  const [editCurrency, setEditCurrency] = useState(currency);
  const [parseError, setParseError] = useState("");

  let data: ChartDataPoint[] = [];
  try {
    data = JSON.parse(rawData);
  } catch {}

  function saveEdits() {
    try {
      const parsed = JSON.parse(editData);
      if (!Array.isArray(parsed)) throw new Error("Must be an array");
      updateAttributes({
        chartType: editType,
        title: editTitle,
        data: editData,
        currency: editCurrency,
      });
      setEditing(false);
      setParseError("");
    } catch (e: any) {
      setParseError(e.message || "Invalid JSON");
    }
  }

  const fmt = (v: number) =>
    editCurrency ? `${editCurrency} ${v.toLocaleString()}` : v.toLocaleString();

  return (
    <NodeViewWrapper className="my-4 not-prose">
      <div
        className={`rounded-xl border-2 transition-colors ${
          selected ? "border-brand-400 shadow-md" : "border-border"
        } bg-card overflow-hidden`}
      >
        {/* Toolbar */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-muted/40">
          <p className="text-xs font-semibold text-foreground">
            {title || "Chart"}
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => {
                setEditing((e) => !e);
                setEditTitle(title);
                setEditData(rawData);
                setEditType(chartType);
                setEditCurrency(currency);
              }}
              className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
              title="Edit chart"
            >
              <Edit2 className="size-3.5" />
            </button>
            <button
              onClick={() => deleteNode()}
              className="p-1.5 rounded hover:bg-red-50 transition-colors text-muted-foreground hover:text-destructive"
              title="Remove chart"
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
        </div>

        {/* Edit form */}
        {editing && (
          <div className="px-4 py-3 border-b border-border bg-muted/20 space-y-2.5">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-medium text-muted-foreground block mb-1">
                  Title
                </label>
                <input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full h-7 px-2.5 text-xs rounded border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div>
                <label className="text-[10px] font-medium text-muted-foreground block mb-1">
                  Currency (optional)
                </label>
                <input
                  value={editCurrency}
                  onChange={(e) => setEditCurrency(e.target.value)}
                  placeholder="e.g. OMR"
                  className="w-full h-7 px-2.5 text-xs rounded border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] font-medium text-muted-foreground block mb-1">
                Chart type
              </label>
              <div className="flex gap-1.5">
                {(["bar", "line", "area", "pie"] as ChartType[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => setEditType(t)}
                    className={`px-2.5 py-1 text-[11px] rounded border font-medium transition-colors capitalize ${
                      editType === t
                        ? "bg-brand-800 text-white border-brand-800"
                        : "bg-card border-border text-muted-foreground hover:border-brand-400"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-[10px] font-medium text-muted-foreground block mb-1">
                Data (JSON array of {"{ label, value }"})
              </label>
              <textarea
                rows={4}
                value={editData}
                onChange={(e) => setEditData(e.target.value)}
                className="w-full px-2.5 py-2 text-xs font-mono rounded border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                placeholder='[{"label":"Jan","value":1200},{"label":"Feb","value":1800}]'
              />
              {parseError && (
                <p className="text-[11px] text-destructive mt-1">
                  {parseError}
                </p>
              )}
            </div>

            <div className="flex gap-2">
              <button
                onClick={saveEdits}
                className="flex items-center gap-1 px-3 py-1.5 text-[11px] font-medium rounded bg-brand-800 text-white hover:bg-brand-700 transition-colors"
              >
                <Check className="size-3" /> Save
              </button>
              <button
                onClick={() => {
                  setEditing(false);
                  setParseError("");
                }}
                className="flex items-center gap-1 px-3 py-1.5 text-[11px] font-medium rounded bg-muted text-muted-foreground hover:bg-muted/80 transition-colors"
              >
                <X className="size-3" /> Cancel
              </button>
            </div>
          </div>
        )}

        {/* Chart */}
        {data.length > 0 ? (
          <div className="px-4 py-4">
            <ResponsiveContainer width="100%" height={220}>
              {chartType === "bar" ? (
                <BarChart
                  data={data.map((d) => ({ name: d.label, value: d.value }))}
                >
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
                      currency ? `${(v / 1000).toFixed(0)}K` : String(v)
                    }
                  />
                  <Tooltip formatter={(v: any) => [fmt(Number(v)), "Value"]} />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {data.map((_, i) => (
                      <Cell
                        key={i}
                        fill={data[i].color || PALETTE[i % PALETTE.length]}
                      />
                    ))}
                  </Bar>
                </BarChart>
              ) : chartType === "line" ? (
                <LineChart
                  data={data.map((d) => ({ name: d.label, value: d.value }))}
                >
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
                      currency ? `${(v / 1000).toFixed(0)}K` : String(v)
                    }
                  />
                  <Tooltip formatter={(v: any) => [fmt(Number(v)), "Value"]} />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke={PALETTE[0]}
                    strokeWidth={2.5}
                    dot={{ fill: PALETTE[0], r: 3 }}
                  />
                </LineChart>
              ) : chartType === "area" ? (
                <AreaChart
                  data={data.map((d) => ({ name: d.label, value: d.value }))}
                >
                  <defs>
                    <linearGradient
                      id="chartAreaGrad"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="5%"
                        stopColor={PALETTE[0]}
                        stopOpacity={0.2}
                      />
                      <stop
                        offset="95%"
                        stopColor={PALETTE[0]}
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
                      currency ? `${(v / 1000).toFixed(0)}K` : String(v)
                    }
                  />
                  <Tooltip formatter={(v: any) => [fmt(Number(v)), "Value"]} />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke={PALETTE[0]}
                    fill="url(#chartAreaGrad)"
                    strokeWidth={2.5}
                  />
                </AreaChart>
              ) : (
                /* Pie chart */
                <PieChart>
                  <Pie
                    data={data.map((d) => ({ name: d.label, value: d.value }))}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={85}
                    dataKey="value"
                    paddingAngle={2}
                  >
                    {data.map((d, i) => (
                      <Cell
                        key={i}
                        fill={d.color || PALETTE[i % PALETTE.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: any) => fmt(Number(v))} />
                  <Legend
                    iconType="circle"
                    iconSize={8}
                    wrapperStyle={{ fontSize: 11 }}
                  />
                </PieChart>
              )}
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="px-4 py-8 text-center text-xs text-muted-foreground">
            {editing
              ? "Add data above to preview"
              : "No data — click edit to add data"}
          </div>
        )}

        {/* Inline data table (below chart) */}
        {data.length > 0 && !editing && (
          <div className="border-t border-border">
            <div className="grid grid-cols-2 px-4 py-1.5 bg-muted/30 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
              <span>Label</span>
              <span className="text-right">Value</span>
            </div>
            {data.map((d, i) => (
              <div
                key={i}
                className={`grid grid-cols-2 px-4 py-1.5 text-xs ${i !== 0 ? "border-t border-border/40" : ""}`}
              >
                <span className="flex items-center gap-1.5">
                  <span
                    className="size-2 rounded-full flex-shrink-0"
                    style={{
                      background: d.color || PALETTE[i % PALETTE.length],
                    }}
                  />
                  {d.label}
                </span>
                <span className="text-right font-medium tabular-nums">
                  {fmt(d.value)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </NodeViewWrapper>
  );
}

/* ── Tiptap Node definition ──────────────────────────────────────── */
export const ChartNode = Node.create({
  name: "chart",
  group: "block",
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      chartType: { default: "bar" },
      title: { default: "" },
      data: { default: "[]" },
      currency: { default: "" },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="chart"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-type": "chart",
        "data-chart-type": HTMLAttributes.chartType,
        "data-title": HTMLAttributes.title,
        "data-data": HTMLAttributes.data,
        "data-currency": HTMLAttributes.currency,
      }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ChartNodeView);
  },
});

/* ── Insert chart helper ─────────────────────────────────────────── */
export function insertChart(
  editor: any,
  type: ChartType = "bar",
  title = "Chart",
  data: ChartDataPoint[] = [],
  currency = "",
) {
  editor
    .chain()
    .focus()
    .insertContent({
      type: "chart",
      attrs: {
        chartType: type,
        title,
        data: JSON.stringify(data),
        currency,
      },
    })
    .run();
}
