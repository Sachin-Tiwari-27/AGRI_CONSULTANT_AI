import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// POST /api/ai/flags — consultant manually adds a custom gap/flag
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const {
    projectId,
    submissionId,
    field_name,
    reason,
    suggested_question,
    severity,
  } = await req.json();

  if (!projectId || !field_name || !reason || !suggested_question) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 },
    );
  }

  // Verify consultant owns this project
  const { data: project } = await supabase
    .from("projects")
    .select("id, consultant_id")
    .eq("id", projectId)
    .single();

  if (!project || project.consultant_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: flag, error } = await supabase
    .from("ai_flags")
    .insert({
      project_id: projectId,
      submission_id: submissionId || null,
      field_name,
      reason,
      suggested_question,
      severity: severity || "recommended",
      status: "pending",
    })
    .select("*")
    .single();

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ flag }, { status: 201 });
}
