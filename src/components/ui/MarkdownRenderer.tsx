"use client";
import { cn } from "@/lib/utils";

interface Props {
  content: string;
  className?: string;
}

export function MarkdownRenderer({ content, className }: Props) {
  const html = parseMarkdown(content);
  return (
    <div
      className={cn(
        "prose-report text-sm text-slate-700 leading-relaxed space-y-2",
        // ── PR-4 table overflow fix ───────────────────────────────────
        // Tables now scroll horizontally within their container, not the page.
        // [&_table] sets the table itself to min-w-full so it respects its
        // wrapper; the wrapper div.table-wrapper gets overflow-x-auto.
        // This prevents wide financial/market tables from causing page scroll.
        "[&_.table-wrapper]:overflow-x-auto [&_.table-wrapper]:-mx-0",
        "[&_h1]:text-base [&_h1]:font-semibold [&_h1]:text-slate-900 [&_h1]:mt-4 [&_h1]:mb-1",
        "[&_h2]:text-sm [&_h2]:font-semibold [&_h2]:text-slate-900 [&_h2]:mt-3 [&_h2]:mb-1",
        "[&_h3]:text-sm [&_h3]:font-medium [&_h3]:text-slate-800 [&_h3]:mt-2 [&_h3]:mb-1",
        "[&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1",
        "[&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:space-y-1",
        "[&_li]:text-slate-700",
        "[&_strong]:font-semibold [&_strong]:text-slate-900",
        "[&_em]:italic [&_em]:text-slate-600",
        "[&_code]:bg-slate-100 [&_code]:text-slate-800 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs [&_code]:font-mono",
        "[&_pre]:bg-slate-100 [&_pre]:p-3 [&_pre]:rounded-lg [&_pre]:overflow-x-auto [&_pre]:text-xs",
        "[&_blockquote]:border-l-2 [&_blockquote]:border-slate-300 [&_blockquote]:pl-3 [&_blockquote]:text-slate-500 [&_blockquote]:italic",
        // Table styles applied to table inside .table-wrapper
        "[&_table]:w-full [&_table]:border-collapse [&_table]:text-xs [&_table]:min-w-[400px]",
        "[&_th]:border [&_th]:border-slate-200 [&_th]:bg-slate-50 [&_th]:px-2 [&_th]:py-1.5 [&_th]:text-left [&_th]:font-semibold [&_th]:text-slate-700 [&_th]:whitespace-nowrap",
        "[&_td]:border [&_td]:border-slate-200 [&_td]:px-2 [&_td]:py-1.5 [&_td]:text-slate-700",
        "[&_hr]:border-slate-200 [&_hr]:my-3",
        "[&_p]:mb-2",
        className,
      )}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

function parseMarkdown(md: string): string {
  if (!md) return "";

  let html = md
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Code blocks (must come before inline code)
  html = html.replace(
    /```[\w]*\n?([\s\S]*?)```/g,
    (_, code) => `<pre><code>${code.trim()}</code></pre>`,
  );

  // ── PR-4 fix: wrap tables in overflow-x-auto div ─────────────────
  // Each markdown table block is wrapped in <div class="table-wrapper">
  // so wide tables scroll horizontally within their card, not the page.
  html = html.replace(
    /^(\|.+\|\n)((?:\|[-:]+)+\|\n)((?:\|.+\|\n?)*)/gm,
    (match) => {
      const rows = match
        .trim()
        .split("\n")
        .filter((r) => r.trim());
      if (rows.length < 2) return match;

      const headerCells = rows[0]
        .split("|")
        .filter((c) => c.trim())
        .map((c) => `<th>${c.trim()}</th>`)
        .join("");

      const bodyRows = rows
        .slice(2)
        .map((row) => {
          const cells = row
            .split("|")
            .filter((c) => c.trim())
            .map((c) => `<td>${c.trim()}</td>`)
            .join("");
          return `<tr>${cells}</tr>`;
        })
        .join("");

      return `<div class="table-wrapper"><table><thead><tr>${headerCells}</tr></thead><tbody>${bodyRows}</tbody></table></div>`;
    },
  );

  // Headers
  html = html
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>");

  // Horizontal rule
  html = html.replace(/^---+$/gm, "<hr/>");

  // Blockquote
  html = html.replace(/^> (.+)$/gm, "<blockquote>$1</blockquote>");

  // Unordered lists
  html = html.replace(/^([ \t]*[-*] .+\n?)+/gm, (block) => {
    const items = block
      .trim()
      .split("\n")
      .map((line) => `<li>${line.replace(/^[ \t]*[-*] /, "")}</li>`)
      .join("");
    return `<ul>${items}</ul>`;
  });

  // Ordered lists
  html = html.replace(/^([ \t]*\d+\. .+\n?)+/gm, (block) => {
    const items = block
      .trim()
      .split("\n")
      .map((line) => `<li>${line.replace(/^[ \t]*\d+\. /, "")}</li>`)
      .join("");
    return `<ol>${items}</ol>`;
  });

  // Inline formatting
  html = html
    .replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/__(.+?)__/g, "<strong>$1</strong>")
    .replace(/_(.+?)_/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, "<code>$1</code>");

  // Paragraphs
  html = html
    .split(/\n{2,}/)
    .map((block) => {
      const trimmed = block.trim();
      if (!trimmed) return "";
      if (/^<(h[1-6]|ul|ol|li|table|div|pre|blockquote|hr)/.test(trimmed))
        return trimmed;
      return `<p>${trimmed.replace(/\n/g, "<br/>")}</p>`;
    })
    .join("\n");

  return html;
}
