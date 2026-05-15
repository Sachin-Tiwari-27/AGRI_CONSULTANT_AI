"use client";
import { cn } from "@/lib/utils";
import { marked, Renderer } from "marked";

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
        "[&_img]:max-w-full [&_img]:rounded-lg [&_img]:my-3 [&_img]:border [&_img]:border-slate-100 [&_img]:shadow-sm",
        "[&_a]:text-green-600 [&_a]:hover:underline [&_a]:font-medium",
        "[&_p]:mb-2",
        className,
      )}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

function parseMarkdown(md: string): string {
  if (!md) return "";

  const renderer = new Renderer();

  // Wrap tables in an overflow div so wide tables scroll horizontally
  renderer.table = (header: string, body: string) => {
    return `<div class="table-wrapper"><table><thead>${header}</thead><tbody>${body}</tbody></table></div>`;
  };

  marked.setOptions({
    renderer,
    gfm: true,
    breaks: false,
  });

  try {
    let html = marked.parse(md) as string;

    // Restore custom placeholder nodes for preview
    html = html.replace(
      /⬡ PLACEHOLDER: (.*?)(?=<|\n|$)/g,
      '<div class="my-4 px-4 py-3 rounded-xl border-2 border-dashed border-amber-300 bg-amber-50 text-amber-800 text-sm font-medium flex items-center gap-2"><span class="text-amber-500 text-base">⬡</span><span>PLACEHOLDER: $1</span></div>'
    );

    return html;
  } catch (err) {
    console.error("Markdown parse error:", err);
    return md;
  }
}
