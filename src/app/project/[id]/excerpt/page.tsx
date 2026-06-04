// ── src/app/project/[id]/excerpt/page.tsx ────────────────────────────────────
// Public excerpt report page — accessible without login.
//
// SECURITY: Queries the `public_report_excerpts` view instead of the raw
// `reports` table. The view exposes ONLY:
//   - excerpt_status, excerpt_sections, branding
//   - fm_capex_total, fm_annual_revenue, fm_payback_years  (safe scalars)
//   - excerpt_content  (section text pre-truncated to word_limit, excerpt keys only)
//
// The full `sections` JSONB and `financial_model` JSONB are never returned.

import { notFound } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/server";
import { ExcerptReportView } from "@/components/report/ExcerptReportView";

export default async function ExcerptPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServiceClient();

  const [{ data: excerptRow }, { data: project }] = await Promise.all([
    (supabase as any)
      .from("public_report_excerpts")
      .select(
        "excerpt_status, excerpt_sections, branding, report_status, " +
          "fm_capex_total, fm_annual_revenue, fm_payback_years, excerpt_content",
      )
      .eq("project_id", id)
      .single() as Promise<{
        data: {
          excerpt_status: string;
          excerpt_sections: any[];
          branding: any;
          report_status: string;
          fm_capex_total: number | null;
          fm_annual_revenue: number | null;
          fm_payback_years: number | null;
          excerpt_content: Record<string, string | null> | null;
        } | null;
        error: any;
      }>,
    supabase
      .from("projects")
      .select("title, client_name, status")
      .eq("id", id)
      .single(),
  ]);

  if (!excerptRow || excerptRow.excerpt_status !== "published") notFound();

  return (
    <div className="min-h-screen bg-slate-50">
      <ExcerptReportView
        projectId={id}
        projectTitle={project?.title ?? "Feasibility Report"}
        excerptSections={(excerptRow.excerpt_sections as any[]) ?? []}
        excerptContent={(excerptRow.excerpt_content as Record<string, string | null>) ?? {}}
        financialHighlights={
          excerptRow.fm_capex_total != null ||
          excerptRow.fm_annual_revenue != null ||
          excerptRow.fm_payback_years != null
            ? {
                capex_total: excerptRow.fm_capex_total,
                total_annual_revenue: excerptRow.fm_annual_revenue,
                payback_years: excerptRow.fm_payback_years,
              }
            : null
        }
        branding={excerptRow.branding as any}
        fullReportPublished={excerptRow.report_status === "published"}
      />
    </div>
  );
}
