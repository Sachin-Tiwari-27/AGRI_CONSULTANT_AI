// ── src/lib/report-docx-export.ts ────────────────────────────────────────────
// Full report Word (.doc) export with rasterized chart images.
//
// Architecture:
//   1. Charts in report sections are stored as :::chart\n{JSON}\n::: fenced blocks
//   2. We parse each section's content, find chart blocks, and render them to
//      PNG data URLs using an offscreen Canvas (browser-only)
//   3. The PNG is embedded as a base64 <img> in the Word HTML
//   4. Non-chart content is converted from markdown to clean HTML
//   5. The whole document is wrapped in Word-compatible XML and downloaded
//
// This file runs CLIENT-SIDE ONLY (uses Canvas API).
// Import it only from client components.

import type { Report, ReportSectionKey } from "@/types";
import type { ReportFormat, ReportFormatSection } from "@/types/report-format";
import {
  REPORT_SECTIONS,
  REPORT_APPENDICES,
} from "@/lib/report-section-config";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ChartAttrs {
  chartType: "bar" | "line" | "area" | "pie";
  title: string;
  data: string; // JSON string
  currency: string;
}

interface ChartDataPoint {
  label: string;
  value: number;
  color?: string;
}

// ── Colour palette (matches ChartNode.tsx) ────────────────────────────────────
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

// ── Chart → PNG data URL ──────────────────────────────────────────────────────
// Renders a chart to a 600×280 offscreen canvas and returns a data URL.

function renderChartToPng(attrs: ChartAttrs): string | null {
  try {
    const dataPoints: ChartDataPoint[] = JSON.parse(attrs.data || "[]");
    if (!dataPoints.length) return null;

    const W = 600;
    const H = 280;
    const PAD = { top: 40, right: 20, bottom: 50, left: 70 };
    const CHART_W = W - PAD.left - PAD.right;
    const CHART_H = H - PAD.top - PAD.bottom;

    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d")!;

    // White background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, W, H);

    // Title
    ctx.fillStyle = "#0f172a";
    ctx.font = "bold 13px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(attrs.title || "Chart", W / 2, 22);

    const fmt = (v: number) =>
      attrs.currency
        ? `${attrs.currency} ${v.toLocaleString()}`
        : v.toLocaleString();

    const maxVal = Math.max(...dataPoints.map((d) => d.value), 1);

    if (attrs.chartType === "pie") {
      renderPieChart(ctx, dataPoints, W, H, fmt);
    } else {
      renderCartesianChart(
        ctx,
        attrs.chartType,
        dataPoints,
        W,
        H,
        PAD,
        CHART_W,
        CHART_H,
        maxVal,
        fmt,
      );
    }

    return canvas.toDataURL("image/png");
  } catch (err) {
    console.error("[DocxExport] Chart render failed:", err);
    return null;
  }
}

function renderCartesianChart(
  ctx: CanvasRenderingContext2D,
  type: string,
  dataPoints: ChartDataPoint[],
  W: number,
  H: number,
  PAD: { top: number; right: number; bottom: number; left: number },
  CHART_W: number,
  CHART_H: number,
  maxVal: number,
  fmt: (v: number) => string,
) {
  // Grid lines
  ctx.strokeStyle = "#f1f5f9";
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = PAD.top + (CHART_H * i) / 4;
    ctx.beginPath();
    ctx.moveTo(PAD.left, y);
    ctx.lineTo(PAD.left + CHART_W, y);
    ctx.stroke();

    // Y-axis labels
    const val = maxVal - (maxVal * i) / 4;
    ctx.fillStyle = "#64748b";
    ctx.font = "10px system-ui, sans-serif";
    ctx.textAlign = "right";
    const label = val >= 1000 ? `${(val / 1000).toFixed(0)}K` : val.toFixed(0);
    ctx.fillText(label, PAD.left - 6, y + 4);
  }

  const barWidth = CHART_W / dataPoints.length;

  if (type === "bar") {
    dataPoints.forEach((d, i) => {
      const barH = (d.value / maxVal) * CHART_H;
      const x = PAD.left + i * barWidth + barWidth * 0.15;
      const y = PAD.top + CHART_H - barH;
      const bw = barWidth * 0.7;

      ctx.fillStyle = d.color || PALETTE[i % PALETTE.length];
      // Rounded top
      ctx.beginPath();
      ctx.moveTo(x + 4, y);
      ctx.lineTo(x + bw - 4, y);
      ctx.quadraticCurveTo(x + bw, y, x + bw, y + 4);
      ctx.lineTo(x + bw, PAD.top + CHART_H);
      ctx.lineTo(x, PAD.top + CHART_H);
      ctx.lineTo(x, y + 4);
      ctx.quadraticCurveTo(x, y, x + 4, y);
      ctx.fill();
    });
  } else {
    // Line or area
    const points = dataPoints.map((d, i) => ({
      x: PAD.left + i * barWidth + barWidth / 2,
      y: PAD.top + CHART_H - (d.value / maxVal) * CHART_H,
    }));

    if (type === "area") {
      ctx.beginPath();
      ctx.moveTo(points[0].x, PAD.top + CHART_H);
      points.forEach((p) => ctx.lineTo(p.x, p.y));
      ctx.lineTo(points[points.length - 1].x, PAD.top + CHART_H);
      ctx.closePath();
      ctx.fillStyle = PALETTE[0] + "33"; // 20% opacity
      ctx.fill();
    }

    ctx.beginPath();
    ctx.strokeStyle = PALETTE[0];
    ctx.lineWidth = 2.5;
    ctx.lineJoin = "round";
    points.forEach((p, i) =>
      i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y),
    );
    ctx.stroke();

    // Dots
    points.forEach((p, i) => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
      ctx.fillStyle = PALETTE[0];
      ctx.fill();
    });
  }

  // X-axis labels
  ctx.fillStyle = "#64748b";
  ctx.font = "10px system-ui, sans-serif";
  ctx.textAlign = "center";
  dataPoints.forEach((d, i) => {
    const x = PAD.left + i * barWidth + barWidth / 2;
    ctx.fillText(
      d.label.length > 10 ? d.label.slice(0, 9) + "…" : d.label,
      x,
      H - PAD.bottom + 18,
    );
  });
}

function renderPieChart(
  ctx: CanvasRenderingContext2D,
  dataPoints: ChartDataPoint[],
  W: number,
  H: number,
  fmt: (v: number) => string,
) {
  const cx = W / 2 - 60;
  const cy = H / 2 + 10;
  const radius = Math.min(W, H) / 2 - 50;
  const total = dataPoints.reduce((s, d) => s + d.value, 0);

  let startAngle = -Math.PI / 2;
  dataPoints.forEach((d, i) => {
    const slice = (d.value / total) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, radius, startAngle, startAngle + slice);
    ctx.closePath();
    ctx.fillStyle = d.color || PALETTE[i % PALETTE.length];
    ctx.fill();
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    ctx.stroke();
    startAngle += slice;
  });

  // Legend on right side
  ctx.font = "10px system-ui, sans-serif";
  ctx.textAlign = "left";
  dataPoints.forEach((d, i) => {
    const ly = 60 + i * 22;
    const lx = W - 120;
    ctx.fillStyle = d.color || PALETTE[i % PALETTE.length];
    ctx.fillRect(lx, ly - 8, 12, 12);
    ctx.fillStyle = "#334155";
    const label = d.label.length > 12 ? d.label.slice(0, 11) + "…" : d.label;
    ctx.fillText(label, lx + 16, ly + 2);
  });
}

// ── Content segment parser ────────────────────────────────────────────────────

type Segment =
  | { type: "md"; content: string }
  | { type: "chart"; attrs: ChartAttrs; png: string | null }
  | { type: "placeholder"; label: string };

function parseContentSegments(raw: string): Segment[] {
  const segments: Segment[] = [];
  const chartPattern = /:::chart\n([\s\S]*?)\n:::/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = chartPattern.exec(raw)) !== null) {
    if (match.index > lastIndex) {
      segments.push(...splitPlaceholders(raw.slice(lastIndex, match.index)));
    }
    try {
      const attrs = JSON.parse(match[1].trim()) as ChartAttrs;
      const png = renderChartToPng(attrs);
      segments.push({ type: "chart", attrs, png });
    } catch {
      // malformed — skip
    }
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < raw.length) {
    segments.push(...splitPlaceholders(raw.slice(lastIndex)));
  }
  return segments;
}

function splitPlaceholders(text: string): Segment[] {
  const segments: Segment[] = [];
  const lines = text.split("\n");
  let buf: string[] = [];

  for (const line of lines) {
    const ph = line.match(/^⬡ PLACEHOLDER: (.+)$/);
    if (ph) {
      if (buf.length) {
        segments.push({ type: "md", content: buf.join("\n") });
        buf = [];
      }
      segments.push({ type: "placeholder", label: ph[1] });
    } else {
      buf.push(line);
    }
  }
  if (buf.length) segments.push({ type: "md", content: buf.join("\n") });
  return segments;
}

// ── Markdown → clean HTML for Word ───────────────────────────────────────────

function esc(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function mdToWordHtml(md: string): string {
  let html = esc(md);

  // Headings
  html = html.replace(/^### (.+)$/gm, "<h3>$1</h3>");
  html = html.replace(/^## (.+)$/gm, "<h2>$1</h2>");
  html = html.replace(/^# (.+)$/gm, "<h1>$1</h1>");

  // Bold + italic
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>");
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");

  // Inline code
  html = html.replace(/`(.+?)`/g, "<code>$1</code>");

  // Blockquote
  html = html.replace(/^&gt; (.+)$/gm, "<blockquote>$1</blockquote>");

  // Horizontal rule
  html = html.replace(/^---$/gm, "<hr/>");

  // Markdown tables → HTML tables
  html = html.replace(/((?:\|[^\n]+\|\n)+)/g, (tableBlock) => {
    const rows = tableBlock
      .trim()
      .split("\n")
      .filter((r) => !r.match(/^\|[-|: ]+\|$/));
    if (rows.length < 2) return tableBlock;
    const [headerRow, ...bodyRows] = rows;
    const headers = headerRow
      .split("|")
      .map((c) => c.trim())
      .filter(Boolean);
    const thead = `<thead><tr>${headers.map((h) => `<th>${h}</th>`).join("")}</tr></thead>`;
    const tbody = bodyRows
      .map((row) => {
        const cells = row
          .split("|")
          .map((c) => c.trim())
          .filter(Boolean);
        return `<tr>${cells.map((c) => `<td>${c}</td>`).join("")}</tr>`;
      })
      .join("");
    return `<table><${thead}<tbody>${tbody}</tbody></table>`;
  });

  // Bullet lists (simple — group consecutive bullet lines)
  html = html.replace(/((?:^• .+\n?)+)/gm, (block) => {
    const items = block
      .trim()
      .split("\n")
      .map((l) => `<li>${l.replace(/^• /, "")}</li>`)
      .join("");
    return `<ul>${items}</ul>`;
  });
  html = html.replace(/^[-*] (.+)$/gm, "<li>$1</li>");

  // Paragraphs — double newlines
  html = html.replace(/\n\n+/g, "</p><p>");
  html = html.replace(/\n/g, "<br/>");

  // Wrap in paragraph if not already a block element
  if (!html.match(/^<(h[1-6]|ul|ol|table|blockquote|hr)/)) {
    html = `<p>${html}</p>`;
  }

  return html;
}

// ── Word HTML wrapper ─────────────────────────────────────────────────────────

function wrapWordDoc(body: string, title: string, branding: any): string {
  const primary = branding?.primary_color || "#1A5C38";
  return `<html xmlns:o='urn:schemas-microsoft-com:office:office'
      xmlns:w='urn:schemas-microsoft-com:office:word'
      xmlns='http://www.w3.org/TR/REC-html40'>
<head>
  <meta charset='utf-8'>
  <title>${esc(title)}</title>
  <!--[if gte mso 9]>
  <xml><w:WordDocument><w:View>Print</w:View><w:Zoom>90</w:Zoom>
  <w:DoNotOptimizeForBrowser/></w:WordDocument></xml>
  <![endif]-->
  <style>
    @page { margin: 2cm 2.5cm; }
    body { font-family: Calibri, Arial, sans-serif; font-size: 11pt; color: #0f172a; line-height: 1.6; }
    h1 { font-size: 20pt; color: ${primary}; border-bottom: 2px solid ${primary}; padding-bottom: 6pt; margin-top: 24pt; page-break-before: always; }
    h1:first-of-type { page-break-before: avoid; }
    h2 { font-size: 14pt; color: ${primary}; margin-top: 16pt; margin-bottom: 4pt; }
    h3 { font-size: 12pt; color: #334155; margin-top: 12pt; margin-bottom: 2pt; }
    p { margin: 0 0 8pt 0; }
    table { border-collapse: collapse; width: 100%; margin: 10pt 0; font-size: 10pt; }
    th { background: #f1f5f9; border: 1px solid #cbd5e1; padding: 6pt 8pt; text-align: left; font-weight: bold; color: #0f172a; }
    td { border: 1px solid #cbd5e1; padding: 5pt 8pt; }
    tr:nth-child(even) td { background: #f8fafc; }
    ul, ol { margin: 4pt 0 8pt 18pt; padding: 0; }
    li { margin-bottom: 3pt; }
    blockquote { border-left: 4px solid ${primary}; margin-left: 0; padding-left: 12pt; color: #475569; font-style: italic; }
    code { font-family: 'Courier New', monospace; font-size: 9pt; background: #f1f5f9; padding: 1pt 3pt; }
    hr { border: none; border-top: 1px solid #e2e8f0; margin: 12pt 0; }
    .placeholder-box { border: 2px dashed #fbbf24; background: #fffbeb; padding: 8pt 10pt; margin: 8pt 0; color: #92400e; font-size: 10pt; }
    .chart-img { max-width: 100%; margin: 8pt 0; }
    .chart-fallback { border: 1px solid #e2e8f0; background: #f8fafc; padding: 6pt 10pt; margin: 8pt 0; font-size: 10pt; }
    .chart-fallback table { font-size: 9pt; }
    .cover { margin-bottom: 36pt; }
    .cover-title { font-size: 26pt; font-weight: 700; color: ${primary}; margin-bottom: 6pt; }
    .cover-subtitle { font-size: 13pt; color: #475569; margin-bottom: 4pt; }
    .cover-meta { font-size: 10pt; color: #94a3b8; }
    .section-label { font-size: 9pt; color: #94a3b8; text-transform: uppercase; letter-spacing: 1pt; margin-bottom: 2pt; }
  </style>
</head>
<body>${body}</body>
</html>`;
}

// ── Section content → Word HTML ───────────────────────────────────────────────

function sectionToWordHtml(
  key: string,
  title: string,
  content: string,
): string {
  const segments = parseContentSegments(content);
  let html = `<h1>${esc(title)}</h1>\n`;

  for (const seg of segments) {
    if (seg.type === "md" && seg.content.trim()) {
      html += mdToWordHtml(seg.content) + "\n";
    } else if (seg.type === "chart") {
      if (seg.png) {
        html += `<div class="chart-img">`;
        if (seg.attrs.title) {
          html += `<p><strong>${esc(seg.attrs.title)}</strong></p>`;
        }
        html += `<img src="${seg.png}" alt="${esc(seg.attrs.title || "Chart")}" style="max-width:100%;height:auto;"/>`;
        html += `</div>\n`;
      } else {
        // Fallback: render as data table if canvas failed
        try {
          const dataPoints: ChartDataPoint[] = JSON.parse(
            seg.attrs.data || "[]",
          );
          html += `<div class="chart-fallback">`;
          if (seg.attrs.title)
            html += `<p><strong>${esc(seg.attrs.title)}</strong></p>`;
          html += `<table><thead><tr><th>Label</th><th>Value</th></tr></thead><tbody>`;
          for (const d of dataPoints) {
            const val = seg.attrs.currency
              ? `${seg.attrs.currency} ${d.value.toLocaleString()}`
              : d.value.toLocaleString();
            html += `<tr><td>${esc(d.label)}</td><td>${esc(val)}</td></tr>`;
          }
          html += `</tbody></table></div>\n`;
        } catch {
          html += `<p><em>[Chart data unavailable]</em></p>\n`;
        }
      }
    } else if (seg.type === "placeholder") {
      html += `<div class="placeholder-box">⬡ PLACEHOLDER: ${esc(seg.label)}</div>\n`;
    }
  }

  return html;
}

// ── Main export function ──────────────────────────────────────────────────────

export async function exportReportAsDocx(
  report: Report,
  projectTitle: string,
  formatSections?: ReportFormatSection[],
): Promise<void> {
  const branding = report.branding;
  const now = new Date().toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  // Determine section order: use format snapshot if available, else default config
  const orderedSections: Array<{ key: string; title: string }> =
    formatSections?.length
      ? formatSections.map((s) => ({ key: s.key, title: s.title }))
      : REPORT_SECTIONS.map((s) => ({ key: s.key, title: s.title }));

  let body = "";

  // Cover page
  body += `<div class="cover">
    <p class="cover-title">${esc(projectTitle)}</p>
    <p class="cover-subtitle">Agricultural Feasibility Report</p>
    <p class="cover-meta">Prepared by ${esc(branding.consultant_name)} — ${esc(branding.company_name)}</p>
    <p class="cover-meta">Generated ${now}</p>
  </div>\n`;

  // Main sections
  for (const { key, title } of orderedSections) {
    const section = report.sections[key as ReportSectionKey];
    if (!section?.content) continue;
    body += sectionToWordHtml(key, title, section.content) + "\n";
  }

  // Appendices
  for (const appendix of REPORT_APPENDICES) {
    const section = report.sections[appendix.key as ReportSectionKey];
    if (!section?.content) continue;
    body +=
      sectionToWordHtml(appendix.key, appendix.title, section.content) + "\n";
  }

  // Footer
  if (branding.footer_text) {
    body += `<hr/><p style="font-size:9pt;color:#94a3b8;text-align:center;">${esc(branding.footer_text)}</p>\n`;
  }

  const html = wrapWordDoc(body, projectTitle, branding);
  const blob = new Blob([html], { type: "application/msword" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${projectTitle.replace(/[^a-zA-Z0-9]+/g, "-")}-report.doc`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
