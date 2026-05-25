/**
 * src/lib/markdown-convert.ts
 *
 * Bidirectional Markdown ↔ HTML conversion for the Tiptap rich editor.
 *
 * Charts are serialised as custom fenced blocks:
 *
 *   :::chart
 *   {"chartType":"bar","title":"Revenue","data":"[...]","currency":"OMR"}
 *   :::
 *
 * This survives the round-trip through markdown storage and is restored to
 * the correct <div data-type="chart" ...> HTML on load. HTML comments were
 * used previously but are silently stripped by marked — this format is not.
 *
 * Placeholders are serialised as:
 *   ⬡ PLACEHOLDER: Label
 */

import { marked } from "marked";
import TurndownService from "turndown";
// @ts-ignore
import { gfm } from "turndown-plugin-gfm";

// ── Decode HTML entities in an attribute value string ─────────────────────────
function decodeAttr(s: string): string {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

// ── Markdown → HTML ───────────────────────────────────────────────────────────
// Called when loading content into the Tiptap editor.

marked.setOptions({
  gfm: true,
  breaks: false,
});

export function markdownToHtml(markdown: string): string {
  if (!markdown || !markdown.trim()) return "<p></p>";
  try {
    // ── Step 1: restore :::chart fenced blocks before marked sees them ────────
    // marked would treat these as unknown directives and mangle them.
    // We replace them with raw <div> tags that Tiptap's ChartNode parseHTML
    // rule recognises.
    let preprocessed = markdown.replace(
      /^:::chart\n([\s\S]*?)\n:::$/gm,
      (_match, json) => {
        try {
          const attrs = JSON.parse(json.trim()) as {
            chartType: string;
            title: string;
            data: string;
            currency: string;
          };
          // Re-encode the data string for a double-quoted HTML attribute
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
          return ""; // malformed block — drop silently
        }
      },
    );

    // ── Step 2: restore placeholder nodes ─────────────────────────────────────
    // marked will wrap ⬡ PLACEHOLDER: ... lines in <p> tags, which we then
    // convert back to data-type="placeholder" divs after parsing.
    let html = marked.parse(preprocessed) as string;

    html = html.replace(
      /<p>⬡ PLACEHOLDER: (.*?)<\/p>/g,
      '<div data-type="placeholder" data-label="$1"></div>',
    );

    // ── Step 3: restore any legacy chart-node comment tokens ──────────────────
    // For backward compatibility with content saved before the :::chart format.
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
          return "";
        }
      },
    );

    return html;
  } catch (err) {
    console.error("[markdown-convert] markdownToHtml failed:", err);
    return `<p>${markdown}</p>`;
  }
}

// ── HTML → Markdown ───────────────────────────────────────────────────────────
// Called when saving content from Tiptap to the database.

const turndown = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
  bulletListMarker: "-",
  hr: "---",
});
turndown.use(gfm);

// Preserve table-wrapper divs — just output their inner table
turndown.addRule("tableWrapper", {
  filter: (node: HTMLElement) =>
    node.nodeName === "DIV" && node.classList.contains("table-wrapper"),
  replacement: (_content: string, node: any) => {
    return turndown.turndown(node.innerHTML);
  },
});

// Placeholder blocks → ⬡ PLACEHOLDER: label
turndown.addRule("placeholder", {
  filter: (node: HTMLElement) =>
    node.nodeName === "DIV" &&
    node.getAttribute("data-type") === "placeholder",
  replacement: (_content: string, node: any) => {
    const label = node.getAttribute("data-label") || "Content";
    return `\n\n⬡ PLACEHOLDER: ${label}\n\n`;
  },
});

export function htmlToMarkdown(html: string): string {
  if (!html || !html.trim()) return "";
  try {
    // ── Step 1: Pre-extract chart divs BEFORE Turndown sees them ─────────────
    //
    // Tiptap's ChartNode is an atom node — it renders as an empty <div> with
    // data attributes. Turndown's blankRule fires for empty elements BEFORE
    // any custom rule, so we must intercept chart divs ourselves.
    //
    // The previous regex only matched self-closing or immediately-closed forms:
    //   /<div\b([^>]*?)data-type=["']chart["']([^>]*?)(?:\/>|><\/div>)/gi
    //
    // The correct pattern must handle ANY content between the tags (including
    // whitespace, <br>, nested elements inserted by the browser's serialiser):
    //   /<div\b[^>]*?data-type=["']chart["'][^>]*?>[\s\S]*?<\/div>/gi

    const placeholders = new Map<string, string>();
    let idx = 0;

    const preprocessed = html.replace(
      /<div\b[^>]*?data-type=["']chart["'][^>]*?>[\s\S]*?<\/div>/gi,
      (match) => {
        // Extract each data attribute from the full matched string
        const get = (name: string): string => {
          const m = match.match(new RegExp(`${name}=["']([^"']*)["']`));
          return m ? decodeAttr(m[1]) : "";
        };

        const attrs = JSON.stringify({
          chartType: get("data-chart-type") || "bar",
          title: get("data-title"),
          data: get("data-data") || "[]",
          currency: get("data-currency"),
        });

        const key = `CHART_PLACEHOLDER_${idx++}`;
        placeholders.set(key, attrs);
        // Wrap in <p> so Turndown treats it as a text paragraph, not a blank
        return `<p>${key}</p>`;
      },
    );

    // ── Step 2: Run Turndown on the pre-processed HTML ─────────────────────
    let md = turndown.turndown(preprocessed);

    // ── Step 3: Swap placeholder tokens back to :::chart fenced blocks ──────
    // We use :::chart fenced blocks instead of HTML comments because marked
    // strips HTML comments during markdown → html conversion, breaking the
    // round-trip. The :::chart format survives as a code-fence-like block
    // which we intercept in markdownToHtml before passing to marked.
    placeholders.forEach((json, key) => {
      md = md.replace(key, `\n\n:::chart\n${json}\n:::\n\n`);
    });

    return md;
  } catch (err) {
    console.error("[markdown-convert] htmlToMarkdown failed:", err);
    return html.replace(/<[^>]*>/g, "");
  }
}