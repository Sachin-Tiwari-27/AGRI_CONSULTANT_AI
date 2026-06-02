// ── src/app/project/[id]/excerpt/page.tsx ────────────────────────────────────
// Public excerpt report page — accessible without login.
// Shows only the consultant-selected sections, each truncated to word_limit.

import { notFound } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/server";
import { ExcerptReportView } from "@/components/report/ExcerptReportView";
import type { Report } from "@/types";

export default async function ExcerptPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServiceClient();

  const [{ data: report }, { data: project }] = await Promise.all([
    supabase
      .from("reports")
      .select(
        "sections, financial_model, branding, excerpt_status, excerpt_sections, status",
      )
      .eq("project_id", id)
      .single(),
    supabase
      .from("projects")
      .select("title, client_name, status")
      .eq("id", id)
      .single(),
  ]);

  if (!report || report.excerpt_status !== "published") notFound();

  return (
    <div className="min-h-screen bg-slate-50">
      <ExcerptReportView
        report={report as unknown as Report}
        projectId={id}
        projectTitle={project?.title ?? "Feasibility Report"}
        excerptSections={(report.excerpt_sections as any[]) ?? []}
        fullReportPublished={report.status === "published"}
      />
    </div>
  );
}
