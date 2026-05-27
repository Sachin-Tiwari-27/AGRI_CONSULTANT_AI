// ── src/app/api/report-formats/[id]/route.ts ────────────────────────────────
// GET    /api/report-formats/[id]   — fetch single format
// PATCH  /api/report-formats/[id]   — update format (name, sections, excerpt config)
// DELETE /api/report-formats/[id]   — delete format (not allowed for is_default)

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { data: format, error } = await supabase
    .from("report_formats")
    .select("*")
    .eq("id", id)
    .eq("consultant_id", user.id)
    .single();

  if (error || !format)
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(format);
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { data: existing } = await supabase
    .from("report_formats")
    .select("id, consultant_id")
    .eq("id", id)
    .eq("consultant_id", user.id)
    .single();

  if (!existing)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const ALLOWED = [
    "name",
    "description",
    "sections",
    "excerpt_section_keys",
    "excerpt_word_limit",
  ];
  const updates = Object.fromEntries(
    Object.entries(body).filter(([k]) => ALLOWED.includes(k)),
  );

  if (!Object.keys(updates).length)
    return NextResponse.json({ error: "No valid fields" }, { status: 400 });

  const { data: updated, error } = await supabase
    .from("report_formats")
    .update(updates)
    .eq("id", id)
    .select("*")
    .single();

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { data: format } = await supabase
    .from("report_formats")
    .select("id, consultant_id, is_default")
    .eq("id", id)
    .eq("consultant_id", user.id)
    .single();

  if (!format)
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (format.is_default)
    return NextResponse.json(
      { error: "Cannot delete the default format" },
      { status: 400 },
    );

  // Check if any projects use this format
  const { count } = await supabase
    .from("projects")
    .select("id", { count: "exact", head: true })
    .eq("report_format_id", id);

  if (count && count > 0) {
    return NextResponse.json(
      {
        error: `This format is used by ${count} project${count > 1 ? "s" : ""}. Remove it from those projects before deleting.`,
      },
      { status: 409 },
    );
  }

  const { error } = await supabase.from("report_formats").delete().eq("id", id);

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
