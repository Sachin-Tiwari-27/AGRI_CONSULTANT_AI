/**
 * src/lib/markdown-convert.ts
 *
 * Bidirectional Markdown ↔ HTML conversion for the Tiptap rich editor.
 *
 * Tiptap works with HTML internally. Our database stores content as Markdown
 * (same format as before). This module handles the conversion in both
 * directions so existing stored content is never broken.
 *
 */

import { marked } from "marked";
import TurndownService from "turndown";
// @ts-ignore
import { gfm } from "turndown-plugin-gfm";

// ── Markdown → HTML (for loading into Tiptap) ─────────────────────────
// No custom table renderer here — Tiptap needs raw <table> tags.
// Wrapping is handled in markdown-renderer.tsx specifically for preview.

marked.setOptions({
  gfm: true, // GitHub Flavored Markdown (tables, strikethrough)
  breaks: false,
});

export function markdownToHtml(markdown: string): string {
  if (!markdown || !markdown.trim()) return "<p></p>";
  try {
    // marked.parse returns string when not using async
    let html = marked.parse(markdown) as string;

    // Restore placeholder nodes from markdown text
    html = html.replace(
      /<p>⬡ PLACEHOLDER: (.*?)<\/p>/g,
      '<div data-type="placeholder" data-label="$1"></div>',
    );

    // Restore chart nodes from serialised comment tokens
    // (kept for backward-compat with content saved before this version)
    html = html.replace(
      /<!--\s*chart-node:([\s\S]*?)\s*-->/g,
      (_match, json) => {
        try {
          const attrs = JSON.parse(json) as {
            chartType: string;
            title: string;
            data: string;
            currency: string;
          };
          // Encode the data value for a double-quoted HTML attribute
          const safeData = (attrs.data || "[]")
            .replace(/&/g, "&amp;")
            .replace(/"/g, "&quot;");
          return (
            `<div data-type="chart"` +
            ` data-chart-type="${attrs.chartType || "bar"}"` +
            ` data-title="${(attrs.title || "").replace(/"/g, "&quot;")}"` +
            ` data-data="${safeData}"` +
            ` data-currency="${(attrs.currency || "").replace(/"/g, "&quot;")}"></div>`
          );
        } catch {
          return ""; // malformed token — drop silently
        }
      },
    );

    return html;
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
turndown.use(gfm);

// Preserve table-wrapper divs — just output their inner table
turndown.addRule("tableWrapper", {
  filter: (node: HTMLElement) =>
    node.nodeName === "DIV" && node.classList.contains("table-wrapper"),
  replacement: (_content: string, node: any) => {
    // Let turndown handle the table inside
    return turndown.turndown(node.innerHTML);
  },
});

// Placeholder blocks → custom markdown syntax ⬡ PLACEHOLDER: label
turndown.addRule("placeholder", {
  filter: (node: HTMLElement) =>
    node.nodeName === "DIV" && node.getAttribute("data-type") === "placeholder",
  replacement: (_content: string, node: any) => {
    const label = node.getAttribute("data-label") || "Content";
    return `\n\n⬡ PLACEHOLDER: ${label}\n\n`;
  },
});

// ── Decode HTML entities in an attribute value string ─────────────────
function decodeAttr(s: string): string {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

/**
 * Chart nodes are Tiptap `atom` nodes — they are always empty `<div>`s.
 * Turndown's `blankRule` fires for empty elements BEFORE any custom rule,
 * so we must extract chart divs from the HTML ourselves before Turndown
 * sees them.  We replace each one with a `<p>CHART_PLACEHOLDER_N</p>` tag
 * that Turndown converts to a plain-text paragraph, then swap the placeholder
 * text back to our `<!-- chart-node:{json} -->` token in the markdown output.
 */
export function htmlToMarkdown(html: string): string {
  if (!html || !html.trim()) return "";
  try {
    // ── 1. Pre-extract chart divs ────────────────────────────────────
    const placeholders = new Map<string, string>(); // placeholder → JSON
    let idx = 0;

    const preprocessed = html.replace(
      /<div\b([^>]*?)data-type=["']chart["']([^>]*?)(?:\/>|><\/div>)/gi,
      (_match, before, after) => {
        const allAttrs = before + " " + after;
        const get = (name: string) =>
          decodeAttr(
            (allAttrs.match(new RegExp(`${name}=["']([^"']*)["']`)) ||
              [])[1] || "",
          );

        const attrs = JSON.stringify({
          chartType: get("data-chart-type") || "bar",
          title: get("data-title"),
          data: get("data-data") || "[]",
          currency: get("data-currency"),
        });

        const key = `CHART_PLACEHOLDER_${idx++}`;
        placeholders.set(key, attrs);
        // Wrap in <p> so Turndown treats it as a text paragraph, not blank
        return `<p>${key}</p>`;
      },
    );

    // ── 2. Run Turndown normally ─────────────────────────────────────
    let md = turndown.turndown(preprocessed);

    // ── 3. Swap placeholders back to chart-node comment tokens ───────
    placeholders.forEach((json, key) => {
      md = md.replace(key, `\n\n<!-- chart-node:${json} -->\n\n`);
    });

    return md;
  } catch (err) {
    console.error("[markdown-convert] htmlToMarkdown failed:", err);
    return html.replace(/<[^>]*>/g, "");
  }
}
