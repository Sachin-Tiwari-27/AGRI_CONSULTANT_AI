import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
 
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
 
  const { projectId, sectionKey, instruction } = await req.json();
 
  if (!projectId || !sectionKey) {
    return NextResponse.json(
      { error: "projectId and sectionKey are required" },
      { status: 400 },
    );
  }
 
  // Fetch current instructions
  const { data: project } = await supabase
    .from("projects")
    .select("consultant_id, section_instructions")
    .eq("id", projectId)
    .single();
 
  if (!project || project.consultant_id !== user.id) {
    return NextResponse.json(
      { error: "Not found or forbidden" },
      { status: 404 },
    );
  }
 
  const current = (project.section_instructions as Record<string, string>) || {};
 
  // Update or clear the instruction for this section
  const updated = { ...current };
  if (instruction && instruction.trim()) {
    updated[sectionKey] = instruction.trim();
  } else {
    delete updated[sectionKey]; // clear if empty
  }
 
  const { error } = await supabase
    .from("projects")
    .update({ section_instructions: updated })
    .eq("id", projectId);
 
  if (error) {
    return NextResponse.json(
      { error: "Failed to save instructions", details: error.message },
      { status: 500 },
    );
  }
 
  return NextResponse.json({ success: true, section_instructions: updated });
}
 
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
 
  const { data: project } = await supabase
    .from("projects")
    .select("consultant_id, section_instructions")
    .eq("id", projectId)
    .single();
 
  if (!project || project.consultant_id !== user.id) {
    return NextResponse.json(
      { error: "Not found or forbidden" },
      { status: 404 },
    );
  }
 
  return NextResponse.json({
    section_instructions: project.section_instructions || {},
  });
}