import { createClient } from "@/lib/supabase/server";
import { TopBar } from "@/components/layout/Sidebar";
import { ReportFormatsClient } from "./ReportFormatsClient";
import {
  DEFAULT_FORMAT_SECTIONS,
  DEFAULT_FORMAT_EXCERPT_KEYS,
  DEFAULT_FORMAT_EXCERPT_WORD_LIMIT,
} from "@/lib/report-format-defaults";

export default async function ReportFormatsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Check whether this consultant already has at least one format
  const { count } = await supabase
    .from("report_formats")
    .select("id", { count: "exact", head: true })
    .eq("consultant_id", user!.id);

  // Seed the default format server-side if none exist.
  // This mirrors the logic in GET /api/report-formats so both entry points
  // (direct page visit and first API call) produce the same result.
  if (!count || count === 0) {
    await supabase.from("report_formats").insert({
      consultant_id: user!.id,
      name: "Standard Agricultural Feasibility (17 sections)",
      description:
        "The default AgriAI report format covering all standard feasibility sections.",
      is_default: true,
      sections: DEFAULT_FORMAT_SECTIONS,
      excerpt_section_keys: DEFAULT_FORMAT_EXCERPT_KEYS,
      excerpt_word_limit: DEFAULT_FORMAT_EXCERPT_WORD_LIMIT,
    });
  }

  // Now fetch — guaranteed to have at least one row
  const { data: formats } = await supabase
    .from("report_formats")
    .select("*")
    .eq("consultant_id", user!.id)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: true });

  return (
    <div className="flex flex-col h-full">
      <TopBar title="Report Formats" />
      <div className="flex-1 overflow-y-auto">
        <ReportFormatsClient initialFormats={formats ?? []} />
      </div>
    </div>
  );
}
