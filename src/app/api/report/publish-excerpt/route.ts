// ── src/app/api/report/publish-excerpt/route.ts ───────────────────────────────
// POST /api/report/publish-excerpt
//
// Publishes a teaser excerpt of the report. The excerpt:
//   - Shows only the sections selected in the format's excerpt config
//   - Truncates each section to the format's excerpt_word_limit
//   - Is accessible at /project/[id]/excerpt (no login required)
//   - Does NOT require the full report to be published first

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logProjectEvent } from "@/lib/events";
import type { ReportFormatSection } from "@/types/report-format";
import {
  DEFAULT_FORMAT_SECTIONS,
  DEFAULT_FORMAT_EXCERPT_KEYS,
  DEFAULT_FORMAT_EXCERPT_WORD_LIMIT,
} from "@/lib/report-format-defaults";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { projectId } = await req.json();
  if (!projectId)
    return NextResponse.json({ error: "projectId required" }, { status: 400 });

  // Verify ownership
  const { data: project } = await supabase
    .from("projects")
    .select(
      "id, consultant_id, title, client_email, client_name, report_format_id",
    )
    .eq("id", projectId)
    .eq("consultant_id", user.id)
    .single();

  if (!project)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Load report
  const { data: report } = await supabase
    .from("reports")
    .select("sections, status, financial_model, branding")
    .eq("project_id", projectId)
    .single();

  if (!report)
    return NextResponse.json(
      { error: "Report not found — generate it first" },
      { status: 404 },
    );

  // Resolve excerpt config from format
  let excerptKeys: string[] = DEFAULT_FORMAT_EXCERPT_KEYS;
  let wordLimit: number = DEFAULT_FORMAT_EXCERPT_WORD_LIMIT;
  let excerptSections: Array<{
    key: string;
    title: string;
    word_limit: number;
  }> = [];

  if (project.report_format_id) {
    const { data: fmt } = await supabase
      .from("report_formats")
      .select("sections, excerpt_section_keys, excerpt_word_limit")
      .eq("id", project.report_format_id)
      .single();

    if (fmt) {
      excerptKeys = fmt.excerpt_section_keys?.length
        ? fmt.excerpt_section_keys
        : DEFAULT_FORMAT_EXCERPT_KEYS;
      wordLimit = fmt.excerpt_word_limit ?? DEFAULT_FORMAT_EXCERPT_WORD_LIMIT;

      // Build excerpt section metadata
      excerptSections = excerptKeys
        .map((key) => {
          const fs = (fmt.sections as ReportFormatSection[])?.find(
            (s) => s.key === key,
          );
          return fs ? { key, title: fs.title, word_limit: wordLimit } : null;
        })
        .filter(Boolean) as Array<{
        key: string;
        title: string;
        word_limit: number;
      }>;
    }
  }

  if (!excerptSections.length) {
    // Fall back to default section titles
    excerptSections = excerptKeys.map((key) => {
      const ds = DEFAULT_FORMAT_SECTIONS.find((s) => s.key === key);
      return { key, title: ds?.title ?? key, word_limit: wordLimit };
    });
  }

  // Validate that at least one selected section has content
  const sectionsWithContent = excerptSections.filter(
    (es) => !!(report.sections as any)?.[es.key]?.content,
  );

  if (!sectionsWithContent.length) {
    return NextResponse.json(
      {
        error:
          "None of the selected excerpt sections have content yet. Generate the report first.",
      },
      { status: 400 },
    );
  }

  // Publish excerpt
  const { error } = await supabase
    .from("reports")
    .update({
      excerpt_status: "published",
      excerpt_published_at: new Date().toISOString(),
      excerpt_sections: excerptSections,
    })
    .eq("project_id", projectId);

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  const excerptUrl = `${process.env.NEXT_PUBLIC_APP_URL}/project/${projectId}/excerpt`;

  await logProjectEvent(supabase, {
    projectId,
    eventType: "report_published" as any,
    actor: "consultant",
    title: "Report excerpt published",
    detail: `${sectionsWithContent.length} section${sectionsWithContent.length !== 1 ? "s" : ""} · ${wordLimit} words per section · ${project.client_email}`,
    metadata: {
      excerpt_sections: excerptSections.map((s) => s.key),
      word_limit: wordLimit,
      excerpt_url: excerptUrl,
    },
  });

  return NextResponse.json({
    success: true,
    excerptUrl,
    sectionsIncluded: sectionsWithContent.length,
  });
}
