import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/analysis/notes?projectId=xxx
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const projectId = req.nextUrl.searchParams.get("projectId");
  if (!projectId)
    return NextResponse.json({ error: "projectId required" }, { status: 400 });

  // Verify ownership
  const { data: project } = await supabase
    .from("projects")
    .select("id, consultant_id")
    .eq("id", projectId)
    .eq("consultant_id", user.id)
    .single();

  if (!project)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: notes, error } = await supabase
    .from("consultant_notes")
    .select("*")
    .eq("project_id", projectId)
    .order("is_pinned", { ascending: false })
    .order("created_at", { ascending: false });

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(notes || []);
}

// POST /api/analysis/notes
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { projectId, title, content, category } = await req.json();

  if (!projectId || !title || !content) {
    return NextResponse.json(
      { error: "projectId, title, and content are required" },
      { status: 400 },
    );
  }

  // Verify ownership
  const { data: project } = await supabase
    .from("projects")
    .select("id, consultant_id")
    .eq("id", projectId)
    .eq("consultant_id", user.id)
    .single();

  if (!project)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data: note, error } = await supabase
    .from("consultant_notes")
    .insert({
      project_id: projectId,
      consultant_id: user.id,
      title,
      content,
      category: category || "general",
      is_pinned: false,
    })
    .select("*")
    .single();

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ note }, { status: 201 });
}
