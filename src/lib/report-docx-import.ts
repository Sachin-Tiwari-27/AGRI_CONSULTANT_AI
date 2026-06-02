// ── src/lib/report-docx-import.ts ────────────────────────────────────────────
// Parses an uploaded Word document (.docx) and maps its headings back to
// report sections using fuzzy title matching.
//
// Flow:
//   1. User uploads .docx → passes ArrayBuffer to parseDocx()
//   2. mammoth extracts HTML from the docx
//   3. We split on H1/H2 headings to get section content blocks
//   4. Each block is matched against known section titles (fuzzy)
//   5. Returns { matched, unmatched } for the UI to handle
//
// CLIENT-SIDE ONLY — uses mammoth which runs in browser.

import type { ReportFormatSection } from "@/types/report-format";
import type { DocxImportPendingSection } from "@/types/report-format";

// ── Fuzzy title matching ──────────────────────────────────────────────────────
// Simple Levenshtein-based similarity score.

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

function similarity(a: string, b: string): number {
  const na = normaliseTitle(a);
  const nb = normaliseTitle(b);
  if (na === nb) return 1;
  if (na.includes(nb) || nb.includes(na)) return 0.9;
  const maxLen = Math.max(na.length, nb.length);
  if (maxLen === 0) return 1;
  return 1 - levenshtein(na, nb) / maxLen;
}

function normaliseTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/^\d+\.\s*/, "") // strip leading "1. "
    .replace(/[^a-z0-9\s]/g, " ") // punctuation → space
    .replace(/\s+/g, " ")
    .trim();
}

// ── HTML → plain text for a block ────────────────────────────────────────────

function htmlToPlainText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<\/tr>/gi, "\n")
    .replace(/<\/th>/gi, "\t")
    .replace(/<\/td>/gi, "\t")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\t\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// ── HTML → markdown-ish for storage ──────────────────────────────────────────
// We store section content as markdown, so convert the Word HTML accordingly.

function htmlBlockToMarkdown(html: string): string {
  let md = html;

  // Headings
  md = md.replace(/<h1[^>]*>(.*?)<\/h1>/gi, "# $1\n\n");
  md = md.replace(/<h2[^>]*>(.*?)<\/h2>/gi, "## $1\n\n");
  md = md.replace(/<h3[^>]*>(.*?)<\/h3>/gi, "### $1\n\n");

  // Bold / italic
  md = md.replace(/<strong[^>]*>(.*?)<\/strong>/gi, "**$1**");
  md = md.replace(/<b[^>]*>(.*?)<\/b>/gi, "**$1**");
  md = md.replace(/<em[^>]*>(.*?)<\/em>/gi, "*$1*");
  md = md.replace(/<i[^>]*>(.*?)<\/i>/gi, "*$1*");

  // Lists
  md = md.replace(/<li[^>]*>(.*?)<\/li>/gi, "- $1\n");
  md = md.replace(/<\/?[uo]l[^>]*>/gi, "\n");

  // Tables — keep as markdown tables
  md = md.replace(/<table[^>]*>/gi, "\n");
  md = md.replace(/<\/table>/gi, "\n");
  md = md.replace(/<thead[^>]*>|<\/thead>|<tbody[^>]*>|<\/tbody>/gi, "");
  md = md.replace(/<tr[^>]*>/gi, "| ");
  md = md.replace(/<\/tr>/gi, "\n");
  md = md.replace(/<th[^>]*>(.*?)<\/th>/gi, "$1 | ");
  md = md.replace(/<td[^>]*>(.*?)<\/td>/gi, "$1 | ");

  // Paragraphs + line breaks
  md = md.replace(/<p[^>]*>/gi, "");
  md = md.replace(/<\/p>/gi, "\n\n");
  md = md.replace(/<br\s*\/?>/gi, "\n");

  // Strip remaining tags
  md = md.replace(/<[^>]+>/g, "");

  // Decode entities
  md = md
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");

  // Clean up whitespace
  md = md.replace(/\n{3,}/g, "\n\n").trim();

  return md;
}

// ── Parsed section from mammoth output ───────────────────────────────────────

interface ParsedSection {
  heading: string;
  htmlContent: string;
  markdownContent: string;
}

// ── Split mammoth HTML output into sections by heading ────────────────────────

function splitByHeadings(html: string): ParsedSection[] {
  // Split on H1 or H2 tags
  const headingPattern = /<h[12][^>]*>(.*?)<\/h[12]>/gi;
  const sections: ParsedSection[] = [];

  const headings: Array<{ title: string; index: number }> = [];
  let match: RegExpExecArray | null;

  while ((match = headingPattern.exec(html)) !== null) {
    headings.push({
      title: match[1].replace(/<[^>]+>/g, "").trim(),
      index: match.index,
    });
  }

  for (let i = 0; i < headings.length; i++) {
    const start = headings[i].index;
    const end = i < headings.length - 1 ? headings[i + 1].index : html.length;
    const block = html.slice(start, end);
    const htmlContent = block.replace(/<h[12][^>]*>.*?<\/h[12]>/i, "").trim();

    sections.push({
      heading: headings[i].title,
      htmlContent,
      markdownContent: htmlBlockToMarkdown(htmlContent),
    });
  }

  return sections;
}

// ── Match parsed sections against known format sections ───────────────────────

const MATCH_THRESHOLD = 0.55; // minimum similarity to count as a match

function matchSections(
  parsed: ParsedSection[],
  formatSections: ReportFormatSection[],
): DocxImportPendingSection[] {
  const results: DocxImportPendingSection[] = [];
  const usedKeys = new Set<string>();

  for (const p of parsed) {
    let bestKey: string | null = null;
    let bestScore = 0;

    for (const fs of formatSections) {
      if (usedKeys.has(fs.key)) continue;
      const score = similarity(p.heading, fs.title);
      if (score > bestScore) {
        bestScore = score;
        bestKey = fs.key;
      }
    }

    const isMatch = bestScore >= MATCH_THRESHOLD;
    if (isMatch && bestKey) usedKeys.add(bestKey);

    results.push({
      matched_key: isMatch ? bestKey : null,
      title: p.heading,
      content: p.markdownContent,
      is_new_section: !isMatch,
      match_confidence: bestScore,
    });
  }

  return results;
}

// ── Main parse function ───────────────────────────────────────────────────────

export interface DocxParseResult {
  pending: DocxImportPendingSection[];
  /** Sections successfully matched — ready to apply immediately */
  matched: DocxImportPendingSection[];
  /** Sections with no match — need user decision */
  unmatched: DocxImportPendingSection[];
  /** Format section keys that were NOT found in the docx */
  missingSectionKeys: string[];
}

export async function parseDocxForImport(
  buffer: ArrayBuffer,
  formatSections: ReportFormatSection[],
): Promise<DocxParseResult> {
  // Dynamically import mammoth (it's heavy — only load when needed)
  let mammoth: any;
  try {
    mammoth = await import("mammoth");
  } catch {
    throw new Error("mammoth is not installed. Run: npm install mammoth");
  }

  const { value: html } = await mammoth.convertToHtml({ arrayBuffer: buffer });

  const parsed = splitByHeadings(html);
  const pending = matchSections(parsed, formatSections);

  const matched = pending.filter((p) => !p.is_new_section);
  const unmatched = pending.filter((p) => p.is_new_section);

  // Which format sections were not covered at all?
  const coveredKeys = new Set(
    matched.map((p) => p.matched_key).filter(Boolean),
  );
  const missingSectionKeys = formatSections
    .map((fs) => fs.key)
    .filter((k) => !coveredKeys.has(k));

  return { pending, matched, unmatched, missingSectionKeys };
}
