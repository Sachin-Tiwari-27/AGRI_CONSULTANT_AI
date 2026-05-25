"use client";

/**
 * src/components/ui/markdown-renderer.tsx
 *
 * Renders stored markdown content in read-only preview contexts:
 *   - ReportEditor read view
 *   - PublicReportView
 *   - PDF preview
 *
 * Handles:
 *   - Standard markdown via react-markdown + remark-gfm
 *   - :::chart fenced blocks → inline Recharts components
 *   - ⬡ PLACEHOLDER: ... lines → amber placeholder badges
 */

import React, { useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { AlertTriangle } from "lucide-react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

// ── Chart colour palette (matches ChartNode.tsx) ──────────────────────────────
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

type ChartType = "bar" | "line" | "area" | "pie";

interface ChartAttrs {
  chartType: ChartType;
  title: string;
  data: string; // JSON string of ChartDataPoint[]
  currency: string;
}

interface ChartDataPoint {
  label: string;
  value: number;
  color?: string;
}

// ── Inline chart component (read-only, no editing controls) ───────────────────
function InlineChart({ attrs }: { attrs: ChartAttrs }) {
  const data: ChartDataPoint[] = useMemo(() => {
    try {
      return JSON.parse(attrs.data);
    } catch {
      return [];
    }
  }, [attrs.data]);

  const fmt = (v: number) =>
    attrs.currency
      ? `${attrs.currency} ${v.toLocaleString()}`
      : v.toLocaleString();

  const chartData = data.map((d) => ({ name: d.label, value: d.value }));

  if (!data.length) return null;

  const renderChart = () => {
    switch (attrs.chartType) {
      case "bar":
        return (
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
            <YAxis
              tick={{ fontSize: 11, fill: "#64748b" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) =>
                attrs.currency ? `${(v / 1000).toFixed(0)}K` : String(v)
              }
            />
            <Tooltip formatter={(v: any) => [fmt(Number(v)), "Value"]} />
            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
              {data.map((d, i) => (
                <Cell key={i} fill={d.color || PALETTE[i % PALETTE.length]} />
              ))}
            </Bar>
          </BarChart>
        );

      case "line":
        return (
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
            <YAxis
              tick={{ fontSize: 11, fill: "#64748b" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) =>
                attrs.currency ? `${(v / 1000).toFixed(0)}K` : String(v)
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
        );

      case "area":
        return (
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="mdAreaGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={PALETTE[0]} stopOpacity={0.2} />
                <stop offset="95%" stopColor={PALETTE[0]} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
            <YAxis
              tick={{ fontSize: 11, fill: "#64748b" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) =>
                attrs.currency ? `${(v / 1000).toFixed(0)}K` : String(v)
              }
            />
            <Tooltip formatter={(v: any) => [fmt(Number(v)), "Value"]} />
            <Area
              type="monotone"
              dataKey="value"
              stroke={PALETTE[0]}
              fill="url(#mdAreaGrad)"
              strokeWidth={2.5}
            />
          </AreaChart>
        );

      case "pie":
        return (
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={85}
              dataKey="value"
              paddingAngle={2}
            >
              {data.map((d, i) => (
                <Cell key={i} fill={d.color || PALETTE[i % PALETTE.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(v: any) => fmt(Number(v))} />
            <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
          </PieChart>
        );
    }
  };

  return (
    <div className="my-4 rounded-xl border border-border bg-card overflow-hidden">
      {/* Chart title */}
      {attrs.title && (
        <div className="px-4 py-2.5 border-b border-border bg-muted/30">
          <p className="text-xs font-semibold text-foreground">{attrs.title}</p>
        </div>
      )}

      {/* Chart */}
      <div className="px-4 py-4">
        <ResponsiveContainer width="100%" height={220}>
          {renderChart() as React.ReactElement}
        </ResponsiveContainer>
      </div>

      {/* Data table */}
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
                style={{ background: d.color || PALETTE[i % PALETTE.length] }}
              />
              {d.label}
            </span>
            <span className="text-right font-medium tabular-nums">{fmt(d.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Placeholder badge ─────────────────────────────────────────────────────────
function PlaceholderBadge({ label }: { label: string }) {
  return (
    <div className="my-3 flex items-center gap-2 rounded-lg border-2 border-dashed border-amber-300 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
      <AlertTriangle className="size-4 text-amber-500 flex-shrink-0" />
      <span>
        <span className="font-semibold">PLACEHOLDER:</span> {label}
      </span>
    </div>
  );
}

// ── Content splitter ──────────────────────────────────────────────────────────
// Splits raw markdown into segments: plain markdown, chart blocks, placeholder lines.

type Segment =
  | { type: "md"; content: string }
  | { type: "chart"; attrs: ChartAttrs }
  | { type: "placeholder"; label: string };

function splitContent(content: string): Segment[] {
  const segments: Segment[] = [];

  // Split on :::chart blocks and ⬡ PLACEHOLDER lines
  // We process line by line to handle placeholders, then handle chart blocks
  const chartPattern = /:::chart\n([\s\S]*?)\n:::/g;

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = chartPattern.exec(content)) !== null) {
    // Push text before this chart block
    if (match.index > lastIndex) {
      segments.push(...splitPlaceholders(content.slice(lastIndex, match.index)));
    }

    // Push chart block
    try {
      const attrs = JSON.parse(match[1].trim()) as ChartAttrs;
      segments.push({ type: "chart", attrs });
    } catch {
      // Malformed chart JSON — render as plain text
      segments.push({ type: "md", content: match[0] });
    }

    lastIndex = match.index + match[0].length;
  }

  // Push remaining text after last chart block
  if (lastIndex < content.length) {
    segments.push(...splitPlaceholders(content.slice(lastIndex)));
  }

  return segments;
}

function splitPlaceholders(text: string): Segment[] {
  const segments: Segment[] = [];
  const lines = text.split("\n");
  let mdBuffer: string[] = [];

  for (const line of lines) {
    const placeholderMatch = line.match(/^⬡ PLACEHOLDER: (.+)$/);
    if (placeholderMatch) {
      if (mdBuffer.length) {
        segments.push({ type: "md", content: mdBuffer.join("\n") });
        mdBuffer = [];
      }
      segments.push({ type: "placeholder", label: placeholderMatch[1] });
    } else {
      mdBuffer.push(line);
    }
  }

  if (mdBuffer.length) {
    segments.push({ type: "md", content: mdBuffer.join("\n") });
  }

  return segments;
}

// ── Main MarkdownRenderer component ──────────────────────────────────────────

interface Props {
  content: string;
  className?: string;
}

export function MarkdownRenderer({ content, className = "" }: Props) {
  const segments = useMemo(() => splitContent(content || ""), [content]);

  return (
    <div className={className}>
      {segments.map((segment, i) => {
        if (segment.type === "chart") {
          return <InlineChart key={i} attrs={segment.attrs} />;
        }

        if (segment.type === "placeholder") {
          return <PlaceholderBadge key={i} label={segment.label} />;
        }

        // Plain markdown
        if (!segment.content.trim()) return null;

        return (
          <ReactMarkdown
            key={i}
            remarkPlugins={[remarkGfm]}
            components={{
              // Tables
              table: ({ children }) => (
                <div className="overflow-x-auto my-4">
                  <table className="w-full border-collapse text-sm">{children}</table>
                </div>
              ),
              thead: ({ children }) => (
                <thead className="bg-muted/50">{children}</thead>
              ),
              th: ({ children }) => (
                <th className="border border-border px-3 py-2 text-left font-semibold text-xs uppercase tracking-wide text-muted-foreground">
                  {children}
                </th>
              ),
              td: ({ children }) => (
                <td className="border border-border px-3 py-2 text-sm">{children}</td>
              ),
              // Headings
              h1: ({ children }) => (
                <h1 className="text-2xl font-bold text-foreground mt-8 mb-4 first:mt-0">
                  {children}
                </h1>
              ),
              h2: ({ children }) => (
                <h2 className="text-xl font-bold text-foreground mt-6 mb-3 first:mt-0">
                  {children}
                </h2>
              ),
              h3: ({ children }) => (
                <h3 className="text-base font-semibold text-foreground mt-5 mb-2">
                  {children}
                </h3>
              ),
              // Paragraphs
              p: ({ children }) => (
                <p className="text-sm leading-relaxed text-foreground mb-3">{children}</p>
              ),
              // Lists
              ul: ({ children }) => (
                <ul className="list-disc list-outside ml-5 mb-3 space-y-1">{children}</ul>
              ),
              ol: ({ children }) => (
                <ol className="list-decimal list-outside ml-5 mb-3 space-y-1">{children}</ol>
              ),
              li: ({ children }) => (
                <li className="text-sm leading-relaxed text-foreground">{children}</li>
              ),
              // Inline
              strong: ({ children }) => (
                <strong className="font-semibold text-foreground">{children}</strong>
              ),
              em: ({ children }) => (
                <em className="italic text-foreground">{children}</em>
              ),
              code: ({ children, className }) => {
                const isBlock = className?.includes("language-");
                if (isBlock) {
                  return (
                    <pre className="bg-muted rounded-lg px-4 py-3 overflow-x-auto my-3">
                      <code className="text-xs font-mono">{children}</code>
                    </pre>
                  );
                }
                return (
                  <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">
                    {children}
                  </code>
                );
              },
              // Blockquote
              blockquote: ({ children }) => (
                <blockquote className="border-l-4 border-brand-300 pl-4 italic text-muted-foreground my-3">
                  {children}
                </blockquote>
              ),
              // Horizontal rule
              hr: () => <hr className="border-border my-6" />,
            }}
          >
            {segment.content}
          </ReactMarkdown>
        );
      })}
    </div>
  );
}