import { createClient } from "@/lib/supabase/server";
import { TopBar } from "@/components/layout/Sidebar";
import { ReportFormatsClient } from "./ReportFormatsClient";

export default async function ReportFormatsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

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
