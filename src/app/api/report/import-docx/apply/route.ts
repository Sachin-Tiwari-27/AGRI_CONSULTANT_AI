// ── src/app/api/report/import-docx/apply/route.ts ────────────────────────────
// POST /api/report/import-docx/apply
//
// Called after the consultant reviews matches in DocxImportModal.
// Body:
//   projectId: string
//   sections: Array<{
//     key: string           — existing section key to update
//     content: string       — new markdown content from Word doc
//   }>
//   newSections?: Array<{
//     key: string           — consultant-assigned key (or auto-generated)
//     title: string
//     content: string
//     addToFormat: boolean  — if true, also adds to the project's report format
//   }>

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logProjectEvent } from "@/lib/events";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { projectId, sections = [], newSections = [] } = await req.json();

  if (!projectId) {
    return NextResponse.json({ error: "projectId required" }, { status: 400 });
  }

  // Verify ownership
  const { data: project } = await supabase
    .from("projects")
    .select("id, consultant_id, report_format_id")
    .eq("id", projectId)
    .eq("consultant_id", user.id)
    .single();

  if (!project)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Load existing report
  const { data: report } = await supabase
    .from("reports")
    .select("sections, report_format_id")
    .eq("project_id", projectId)
    .single();

  if (!report)
    return NextResponse.json({ error: "Report not found" }, { status: 404 });

  const now = new Date().toISOString();
  const updatedSections = { ...(report.sections || {}) };

  // Apply matched section updates
  for (const { key, content } of sections) {
    if (!key || !content) continue;
    updatedSections[key] = {
      ...(updatedSections[key] || {}),
      key,
      content,
      ai_generated: false,
      last_edited_at: now,
      approved: false,
      imported_from_docx: true,
    };
  }

  // Apply new sections accepted by consultant
  for (const ns of newSections) {
    if (!ns.key || !ns.content) continue;
    updatedSections[ns.key] = {
      key: ns.key,
      title: ns.title,
      content: ns.content,
      ai_generated: false,
      last_edited_at: now,
      approved: false,
      imported_from_docx: true,
    };

    // If consultant chose to add this section to the format
    if (ns.addToFormat && project.report_format_id) {
      const { data: fmt } = await supabase
        .from("report_formats")
        .select("sections")
        .eq("id", project.report_format_id)
        .single();

      if (fmt) {
        const existingKeys = (fmt.sections || []).map((s: any) => s.key);
        if (!existingKeys.includes(ns.key)) {
          const newFormatSection = {
            key: ns.key,
            number: (fmt.sections || []).length + 1,
            title: ns.title,
            description: `Imported from Word document`,
            section_type: "custom",
            word_count_target: 400,
            has_placeholders: false,
            generation_phase: 3,
            max_tokens: 2000,
            prompt_hint: "",
            ai_generated_prompt: null,
            prompt_confirmed: false,
            is_financial: false,
            is_excerpt_default: false,
            builtin_ai_task: null,
          };

          await supabase
            .from("report_formats")
            .update({
              sections: [...(fmt.sections || []), newFormatSection],
            })
            .eq("id", project.report_format_id);
        }
      }
    }
  }

  // Save updated sections + clear pending
  const { error } = await supabase
    .from("reports")
    .update({
      sections: updatedSections,
      docx_import_pending_sections: [],
      last_docx_exported_at: null, // Reset so next export reflects new content
    })
    .eq("project_id", projectId);

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  const totalUpdated = sections.length + newSections.length;

  await logProjectEvent(supabase, {
    projectId,
    eventType: "report_generated" as any,
    actor: "consultant",
    title: `Report updated from Word document`,
    detail: `${sections.length} section${sections.length !== 1 ? "s" : ""} updated · ${newSections.length} new section${newSections.length !== 1 ? "s" : ""} added`,
    metadata: {
      updated_sections: sections.map((s: any) => s.key),
      new_sections: newSections.map((s: any) => s.key),
    },
  });

  return NextResponse.json({ success: true, updatedCount: totalUpdated });
}
