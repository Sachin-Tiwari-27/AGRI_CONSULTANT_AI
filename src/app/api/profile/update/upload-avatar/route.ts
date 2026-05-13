import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const MAX_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/svg+xml",
] as const;

const FILE_EXTENSIONS: Record<(typeof ALLOWED_TYPES)[number], string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/svg+xml": "svg",
};

const UPLOAD_TYPES = ["avatar", "logo"] as const;

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const form = await req.formData();
  const file = form.get("file");
  const rawType = String(form.get("type") || "avatar");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }

  if (file.size > MAX_SIZE) {
    return NextResponse.json(
      { error: "File exceeds 5MB limit" },
      { status: 400 },
    );
  }

  if (!UPLOAD_TYPES.includes(rawType as (typeof UPLOAD_TYPES)[number])) {
    return NextResponse.json(
      { error: "Upload type must be avatar or logo" },
      { status: 400 },
    );
  }

  const type = rawType as (typeof UPLOAD_TYPES)[number];

  if (!ALLOWED_TYPES.includes(file.type as (typeof ALLOWED_TYPES)[number])) {
    return NextResponse.json(
      { error: "Only JPEG, PNG, WebP, GIF, and SVG are allowed" },
      { status: 400 },
    );
  }

  const ext = FILE_EXTENSIONS[file.type as (typeof ALLOWED_TYPES)[number]];
  const path = `${user.id}/${type}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(path, file, {
      contentType: file.type,
      upsert: true, // Replace existing
    });

  if (uploadError) {
    return NextResponse.json(
      { error: "Upload failed", details: uploadError.message },
      { status: 500 },
    );
  }

  // Get public URL (bucket is public)
  const {
    data: { publicUrl },
  } = supabase.storage.from("avatars").getPublicUrl(path);

  // Save URL back to profile
  const field = type === "logo" ? "logo_url" : "avatar_url";
  await supabase
    .from("profiles")
    .update({ [field]: publicUrl })
    .eq("id", user.id);

  return NextResponse.json({ success: true, url: publicUrl, field });
}
