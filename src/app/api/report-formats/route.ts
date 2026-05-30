// ── src/app/api/report-formats/route.ts ─────────────────────────────────────
// GET  /api/report-formats        — list consultant's formats
// POST /api/report-formats        — create new format
// Also handles seeding the default format on first call.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  DEFAULT_FORMAT_SECTIONS,
  DEFAULT_FORMAT_EXCERPT_KEYS,
  DEFAULT_FORMAT_EXCERPT_WORD_LIMIT,
} from "@/lib/report-format-defaults";

export async function GET(_req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  // Auto-seed default format if none exist
  const { data: existing } = await supabase
    .from("report_formats")
    .select("id")
    .eq("consultant_id", user.id)
    .limit(1);

  if (!existing?.length) {
    await supabase.from("report_formats").insert({
      consultant_id: user.id,
      name: "Standard Agricultural Feasibility (17 sections)",
      description:
        "The default AgriAI report format covering all standard feasibility sections.",
      is_default: true,
      sections: DEFAULT_FORMAT_SECTIONS,
      excerpt_section_keys: DEFAULT_FORMAT_EXCERPT_KEYS,
      excerpt_word_limit: DEFAULT_FORMAT_EXCERPT_WORD_LIMIT,
    });
  }

  const { data: formats, error } = await supabase
    .from("report_formats")
    .select("*")
    .eq("consultant_id", user.id)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: true });

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(formats ?? []);
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const body = await req.json();
  const {
    name,
    description,
    sections,
    excerpt_section_keys,
    excerpt_word_limit,
  } = body;

  if (!name?.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const { data: format, error } = await supabase
    .from("report_formats")
    .insert({
      consultant_id: user.id,
      name: name.trim(),
      description: description ?? null,
      is_default: false,
      sections: sections ?? DEFAULT_FORMAT_SECTIONS,
      excerpt_section_keys: excerpt_section_keys ?? DEFAULT_FORMAT_EXCERPT_KEYS,
      excerpt_word_limit:
        excerpt_word_limit ?? DEFAULT_FORMAT_EXCERPT_WORD_LIMIT,
    })
    .select("*")
    .single();

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(format, { status: 201 });
}
