"use client";

import { cn } from "@/lib/utils";
import { marked, Renderer, type Tokens } from "marked";

interface Props {
  content: string;
  className?: string;
}

export function MarkdownRenderer({ content, className }: Props) {
  const html = parseMarkdown(content);
  return (
    <div
      className={cn(
        "text-sm text-foreground leading-relaxed",
        // Headings
        "[&_h1]:text-base [&_h1]:font-semibold [&_h1]:text-foreground [&_h1]:mt-5 [&_h1]:mb-2",
        "[&_h2]:text-sm [&_h2]:font-semibold [&_h2]:text-foreground [&_h2]:mt-4 [&_h2]:mb-1.5",
        "[&_h3]:text-sm [&_h3]:font-medium [&_h3]:text-foreground [&_h3]:mt-3 [&_h3]:mb-1",
        // Body
        "[&_p]:mb-2.5 [&_p]:leading-relaxed",
        "[&_strong]:font-semibold [&_strong]:text-foreground",
        "[&_em]:italic [&_em]:text-muted-foreground",
        // Lists
        "[&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1 [&_ul]:mb-3",
        "[&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:space-y-1 [&_ol]:mb-3",
        "[&_li]:text-foreground",
        // Code
        "[&_code]:bg-muted [&_code]:text-foreground [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs [&_code]:font-mono",
        "[&_pre]:bg-muted [&_pre]:p-3 [&_pre]:rounded-lg [&_pre]:overflow-x-auto [&_pre]:text-xs [&_pre]:mb-3",
        "[&_pre_code]:bg-transparent [&_pre_code]:p-0",
        // Blockquote
        "[&_blockquote]:border-l-2 [&_blockquote]:border-brand-300 [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground [&_blockquote]:italic [&_blockquote]:mb-3",
        // HR
        "[&_hr]:border-border [&_hr]:my-4",
        // Images
        "[&_img]:max-w-full [&_img]:rounded-lg [&_img]:my-3 [&_img]:border [&_img]:border-border",
        // Links
        "[&_a]:text-brand-700 [&_a]:hover:underline [&_a]:font-medium",
        // Tables — wrapped in .table-wrapper for horizontal scroll
        "[&_.table-wrapper]:overflow-x-auto [&_.table-wrapper]:rounded-lg [&_.table-wrapper]:border [&_.table-wrapper]:border-border [&_.table-wrapper]:mb-3",
        "[&_table]:w-full [&_table]:border-collapse [&_table]:text-xs [&_table]:min-w-[380px]",
        "[&_th]:bg-muted [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:font-semibold [&_th]:text-foreground [&_th]:border-b [&_th]:border-border [&_th]:whitespace-nowrap",
        "[&_td]:px-3 [&_td]:py-2 [&_td]:text-muted-foreground [&_td]:border-b [&_td]:border-border/50",
        "[&_tr:last-child_td]:border-0",
        "[&_tr:nth-child(even)_td]:bg-muted/30",
        className,
      )}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

function parseMarkdown(md: string): string {
  if (!md) return "";

  const renderer = new Renderer();

  renderer.table = (token: Tokens.Table): string => {
    const headerCells = token.header
      .map((cell) => `<th>${cell.text}</th>`)
      .join("");
    const bodyRows = token.rows
      .map(
        (row) =>
          `<tr>${row.map((cell) => `<td>${cell.text}</td>`).join("")}</tr>`,
      )
      .join("");
    return `<div class="table-wrapper"><table><thead><tr>${headerCells}</tr></thead><tbody>${bodyRows}</tbody></table></div>`;
  };

  marked.setOptions({ renderer, gfm: true, breaks: false });

  try {
    let html = marked.parse(md) as string;

    // Render placeholder blocks
    html = html.replace(
      /⬡ PLACEHOLDER: (.*?)(?=<|\n|$)/g,
      `<div class="my-3 flex items-center gap-2 rounded-lg border-2 border-dashed border-amber-300 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
        <span class="text-amber-500">⬡</span>
        <span>PLACEHOLDER: $1</span>
      </div>`,
    );

    return html;
  } catch (err) {
    console.error("Markdown parse error:", err);
    return md;
  }
}
