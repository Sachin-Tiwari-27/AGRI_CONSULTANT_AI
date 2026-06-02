// ── src/app/api/report/import-docx/route.ts ──────────────────────────────────
// POST /api/report/import-docx
//
// Accepts a multipart form with:
//   - projectId: string
//   - file: .docx file
//
// Returns the parsed + matched sections. Does NOT apply changes to the DB —
// the client reviews the matches in DocxImportModal and then calls
// PATCH /api/report/import-docx/apply to commit.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_FORMAT_SECTIONS } from "@/lib/report-format-defaults";
import type { ReportFormatSection } from "@/types/report-format";

// We parse the docx server-side using mammoth running in Node.js.
// mammoth works in both browser and Node environments.

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const form = await req.formData();
  const projectId = String(form.get("projectId") || "");
  const file = form.get("file");

  if (!projectId) {
    return NextResponse.json({ error: "projectId required" }, { status: 400 });
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file required" }, { status: 400 });
  }

  // Verify ownership + load format
  const { data: project } = await supabase
    .from("projects")
    .select("id, consultant_id, report_format_id")
    .eq("id", projectId)
    .eq("consultant_id", user.id)
    .single();

  if (!project)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Load format sections for matching
  let formatSections: ReportFormatSection[] = DEFAULT_FORMAT_SECTIONS;
  if (project.report_format_id) {
    const { data: fmt } = await supabase
      .from("report_formats")
      .select("sections")
      .eq("id", project.report_format_id)
      .single();
    if (fmt?.sections?.length) formatSections = fmt.sections;
  }

  // Parse the docx server-side
  let mammoth: any;
  try {
    mammoth = require("mammoth");
  } catch {
    return NextResponse.json(
      { error: "mammoth package not installed. Run: npm install mammoth" },
      { status: 500 },
    );
  }

  const buffer = await file.arrayBuffer();

  let html: string;
  try {
    const result = await mammoth.convertToHtml({ buffer: Buffer.from(buffer) });
    html = result.value;
  } catch (err) {
    console.error("[DocxImport] mammoth parse failed:", err);
    return NextResponse.json(
      {
        error:
          "Failed to parse Word document. Ensure the file is a valid .docx.",
      },
      { status: 422 },
    );
  }

  // Split by headings and match
  const parsed = splitByHeadings(html);
  const pending = matchSections(parsed, formatSections);

  const matched = pending.filter((p) => !p.is_new_section);
  const unmatched = pending.filter((p) => p.is_new_section);
  const coveredKeys = new Set(
    matched.map((p) => p.matched_key).filter(Boolean),
  );
  const missingSectionKeys = formatSections
    .map((fs) => fs.key)
    .filter((k) => !coveredKeys.has(k));

  // Store pending sections on the report for the apply step
  await supabase
    .from("reports")
    .update({ docx_import_pending_sections: pending })
    .eq("project_id", projectId);

  return NextResponse.json({
    pending,
    matched,
    unmatched,
    missingSectionKeys,
    totalParsed: parsed.length,
  });
}

// ── Helpers (duplicated from client lib — server needs its own copy) ──────────

function levenshtein(a: string, b: string): number {
  const m = a.length,
    n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
  return dp[m][n];
}

function normaliseTitle(t: string): string {
  return t
    .toLowerCase()
    .replace(/^\d+\.\s*/, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function similarity(a: string, b: string): number {
  const na = normaliseTitle(a),
    nb = normaliseTitle(b);
  if (na === nb) return 1;
  if (na.includes(nb) || nb.includes(na)) return 0.9;
  const maxLen = Math.max(na.length, nb.length);
  return maxLen === 0 ? 1 : 1 - levenshtein(na, nb) / maxLen;
}

function htmlBlockToMarkdown(html: string): string {
  let md = html;
  md = md.replace(/<h1[^>]*>(.*?)<\/h1>/gi, "# $1\n\n");
  md = md.replace(/<h2[^>]*>(.*?)<\/h2>/gi, "## $1\n\n");
  md = md.replace(/<h3[^>]*>(.*?)<\/h3>/gi, "### $1\n\n");
  md = md.replace(/<strong[^>]*>(.*?)<\/strong>/gi, "**$1**");
  md = md.replace(/<b[^>]*>(.*?)<\/b>/gi, "**$1**");
  md = md.replace(/<em[^>]*>(.*?)<\/em>/gi, "*$1*");
  md = md.replace(/<i[^>]*>(.*?)<\/i>/gi, "*$1*");
  md = md.replace(/<li[^>]*>(.*?)<\/li>/gi, "- $1\n");
  md = md.replace(/<\/?[uo]l[^>]*>/gi, "\n");
  md = md.replace(/<table[^>]*>/gi, "\n");
  md = md.replace(/<\/table>/gi, "\n");
  md = md.replace(/<thead[^>]*>|<\/thead>|<tbody[^>]*>|<\/tbody>/gi, "");
  md = md.replace(/<tr[^>]*>/gi, "| ");
  md = md.replace(/<\/tr>/gi, "\n");
  md = md.replace(/<th[^>]*>(.*?)<\/th>/gi, "$1 | ");
  md = md.replace(/<td[^>]*>(.*?)<\/td>/gi, "$1 | ");
  md = md.replace(/<p[^>]*>/gi, "").replace(/<\/p>/gi, "\n\n");
  md = md.replace(/<br\s*\/?>/gi, "\n");
  md = md.replace(/<[^>]+>/g, "");
  md = md
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
  return md.replace(/\n{3,}/g, "\n\n").trim();
}

interface ParsedSection {
  heading: string;
  htmlContent: string;
  markdownContent: string;
}

function splitByHeadings(html: string): ParsedSection[] {
  const headingPattern = /<h[12][^>]*>(.*?)<\/h[12]>/gi;
  const headings: Array<{ title: string; index: number }> = [];
  let match: RegExpExecArray | null;
  while ((match = headingPattern.exec(html)) !== null) {
    headings.push({
      title: match[1].replace(/<[^>]+>/g, "").trim(),
      index: match.index,
    });
  }
  return headings.map((h, i) => {
    const start = h.index;
    const end = i < headings.length - 1 ? headings[i + 1].index : html.length;
    const block = html.slice(start, end);
    const htmlContent = block.replace(/<h[12][^>]*>.*?<\/h[12]>/i, "").trim();
    return {
      heading: h.title,
      htmlContent,
      markdownContent: htmlBlockToMarkdown(htmlContent),
    };
  });
}

const MATCH_THRESHOLD = 0.55;

function matchSections(
  parsed: ParsedSection[],
  formatSections: ReportFormatSection[],
) {
  const usedKeys = new Set<string>();
  return parsed.map((p) => {
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
    return {
      matched_key: isMatch ? bestKey : null,
      title: p.heading,
      content: p.markdownContent,
      is_new_section: !isMatch,
      match_confidence: bestScore,
    };
  });
}
