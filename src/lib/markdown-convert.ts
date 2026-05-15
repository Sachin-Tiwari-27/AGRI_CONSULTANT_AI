/**
 * src/lib/markdown-convert.ts
 *
 * Bidirectional Markdown ↔ HTML conversion for the Tiptap rich editor.
 *
 * Tiptap works with HTML internally. Our database stores content as Markdown
 * (same format as before). This module handles the conversion in both
 * directions so existing stored content is never broken.
 *
 * Dependencies (add to package.json):
 *   npm install marked turndown
 *   npm install --save-dev @types/turndown
 */

import { marked, Renderer } from "marked";
import TurndownService from "turndown";

// ── Markdown → HTML (for loading into Tiptap) ─────────────────────────
const renderer = new Renderer();

// Wrap tables in an overflow div so wide tables scroll horizontally
renderer.table = (header: string, body: string) => {
  return `<div class="table-wrapper"><table><thead>${header}</thead><tbody>${body}</tbody></table></div>`;
};

marked.setOptions({
  renderer,
  gfm: true, // GitHub Flavored Markdown (tables, strikethrough)
  breaks: false,
});

export function markdownToHtml(markdown: string): string {
  if (!markdown || !markdown.trim()) return "<p></p>";
  try {
    // marked.parse returns string when not using async
    return marked.parse(markdown) as string;
  } catch (err) {
    console.error("[markdown-convert] markdownToHtml failed:", err);
    return `<p>${markdown}</p>`;
  }
}

// ── HTML → Markdown (for saving from Tiptap) ─────────────────────────
const turndown = new TurndownService({
  headingStyle: "atx", // # H1, ## H2 etc.
  codeBlockStyle: "fenced", // ```code```
  bulletListMarker: "-",
  hr: "---",
});

// Preserve table-wrapper divs — just output their inner table
turndown.addRule("tableWrapper", {
  filter: (node: HTMLElement) =>
    node.nodeName === "DIV" && node.classList.contains("table-wrapper"),
  replacement: (_content: string, node: any) => {
    // Let turndown handle the table inside
    return turndown.turndown(node.innerHTML);
  },
});

// Placeholder blocks → custom markdown syntax [[PLACEHOLDER: label]]
turndown.addRule("placeholder", {
  filter: (node: HTMLElement) =>
    node.nodeName === "DIV" && node.getAttribute("data-type") === "placeholder",
  replacement: (_content: string, node: any) => {
    const label = node.getAttribute("data-label") || "Content";
    return `\n\n⬡ PLACEHOLDER: ${label}\n\n`;
  },
});

export function htmlToMarkdown(html: string): string {
  if (!html || !html.trim()) return "";
  try {
    return turndown.turndown(html);
  } catch (err) {
    console.error("[markdown-convert] htmlToMarkdown failed:", err);
    return html.replace(/<[^>]*>/g, "");
  }
}
