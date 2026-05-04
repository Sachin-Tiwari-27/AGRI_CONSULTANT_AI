import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const ALLOWED_FIELDS = [
  "full_name",
  "phone",
  "company_name",
  "bio",
  "website",
  "linkedin_url",
  "avatar_url",
  "logo_url",
  "brand_primary_color",
  "brand_secondary_color",
  "brand_footer_text",
  "payment_preference",
  "default_currency",
  "default_amount",
] as const;

type AllowedField = (typeof ALLOWED_FIELDS)[number];

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const body = await req.json();

  // Only allow whitelisted fields — never let client set stripe_connected etc.
  const updates = Object.fromEntries(
    Object.entries(body).filter(([k]) =>
      ALLOWED_FIELDS.includes(k as AllowedField),
    ),
  );

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { error: "No valid fields to update" },
      { status: 400 },
    );
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .update(updates)
    .eq("id", user.id)
    .select("*")
    .single();

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, profile });
}
