import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const body = await req.json();
  const allowedFields = ["title", "content", "category", "is_pinned"];
  const updates = Object.fromEntries(
    Object.entries(body).filter(([k]) => allowedFields.includes(k)),
  );

  // Verify ownership via join
  const { data: existing } = await supabase
    .from("consultant_notes")
    .select("id, consultant_id")
    .eq("id", id)
    .eq("consultant_id", user.id)
    .single();

  if (!existing)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: note, error } = await supabase
    .from("consultant_notes")
    .update(updates)
    .eq("id", id)
    .select("*")
    .single();

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ note });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { data: existing } = await supabase
    .from("consultant_notes")
    .select("id, consultant_id")
    .eq("id", id)
    .eq("consultant_id", user.id)
    .single();

  if (!existing)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { error } = await supabase
    .from("consultant_notes")
    .delete()
    .eq("id", id);

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
