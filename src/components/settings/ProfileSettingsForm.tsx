"use client";

import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { InlineAlert } from "@/components/ui/status";
import { Separator } from "@/components/ui/separator";
import { Save, User, Camera, CheckCircle2, AlertCircle } from "lucide-react";

interface ProfileSettings {
  full_name?: string | null;
  phone?: string | null;
  company_name?: string | null;
  bio?: string | null;
  website?: string | null;
  linkedin_url?: string | null;
  avatar_url?: string | null;
  email?: string | null;
}

export function ProfileSettingsForm({
  profile,
}: {
  profile: ProfileSettings | null;
}) {
  const [form, setForm] = useState({
    full_name: profile?.full_name ?? "",
    phone: profile?.phone ?? "",
    company_name: profile?.company_name ?? "",
    bio: profile?.bio ?? "",
    website: profile?.website ?? "",
    linkedin_url: profile?.linkedin_url ?? "",
  });
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url ?? "");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  function set(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setStatus("idle");
  }

  async function uploadAvatar(file: File) {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("type", "avatar");
      const res = await fetch("/api/profile/update/upload-avatar", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      setAvatarUrl(data.url);
    } catch (e: any) {
      setErrorMsg(e.message || "Avatar upload failed");
      setStatus("error");
    } finally {
      setUploading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setStatus("idle");
    try {
      const res = await fetch("/api/profile/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error);
      }
      setStatus("saved");
    } catch (e: any) {
      setErrorMsg(e.message || "Failed to save");
      setStatus("error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile</CardTitle>
        <p className="text-xs text-muted-foreground">
          Your consultant identity shown to clients and in reports.
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Avatar */}
        <div className="flex items-center gap-5">
          <div className="relative flex-shrink-0">
            <div className="w-16 h-16 rounded-full bg-muted border-2 border-border overflow-hidden flex items-center justify-center">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt="Avatar"
                  className="w-full h-full object-cover"
                />
              ) : (
                <User className="size-7 text-muted-foreground" />
              )}
            </div>
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="absolute -bottom-1 -right-1 w-6 h-6 bg-brand-700 rounded-full flex items-center justify-center border-2 border-background hover:bg-brand-600 transition-colors disabled:opacity-50"
            >
              <Camera className="size-3 text-white" />
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) uploadAvatar(f);
              }}
            />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">Profile photo</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {uploading ? "Uploading…" : "JPEG, PNG or WebP up to 5 MB"}
            </p>
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="text-xs text-brand-700 hover:text-brand-800 font-medium mt-1 disabled:opacity-50"
            >
              {avatarUrl ? "Change photo" : "Upload photo"}
            </button>
          </div>
        </div>

        <Separator />

        {/* Core fields */}
        <div className="grid grid-cols-2 gap-4">
          <Field label="Full name" required htmlFor="full_name">
            <Input
              id="full_name"
              value={form.full_name}
              onChange={(e) => set("full_name", e.target.value)}
              placeholder="Your full name"
            />
          </Field>
          <Field label="Phone number" htmlFor="phone">
            <Input
              id="phone"
              value={form.phone}
              onChange={(e) => set("phone", e.target.value)}
              placeholder="+968 9XXX XXXX"
            />
          </Field>
          <Field label="Company / Organisation" htmlFor="company_name">
            <Input
              id="company_name"
              value={form.company_name}
              onChange={(e) => set("company_name", e.target.value)}
              placeholder="AgriConsult Ltd."
            />
          </Field>
          <Field label="Website" htmlFor="website">
            <Input
              id="website"
              value={form.website}
              onChange={(e) => set("website", e.target.value)}
              placeholder="https://yoursite.com"
              type="url"
            />
          </Field>
          <Field
            label="LinkedIn URL"
            htmlFor="linkedin_url"
            className="col-span-2"
          >
            <Input
              id="linkedin_url"
              value={form.linkedin_url}
              onChange={(e) => set("linkedin_url", e.target.value)}
              placeholder="https://linkedin.com/in/yourname"
              type="url"
            />
          </Field>
        </div>

        <Field label="Bio / specialisations" htmlFor="bio">
          <Textarea
            id="bio"
            value={form.bio}
            onChange={(e) => set("bio", e.target.value)}
            placeholder="Brief description of your expertise, crops specialised in, regions covered…"
            className="min-h-[72px]"
          />
        </Field>

        {/* Email (read-only) */}
        <div>
          <p className="text-xs font-medium text-foreground/80 mb-1.5">
            Email address
          </p>
          <div className="flex h-9 items-center px-3 rounded-lg border border-border bg-muted/40 text-sm text-muted-foreground">
            {profile?.email ?? "—"}
            <span className="ml-2 text-[11px] text-muted-foreground/60">
              (cannot be changed here)
            </span>
          </div>
        </div>

        <Separator />

        {/* Status + save */}
        <div className="flex items-center justify-between">
          <div>
            {status === "saved" && (
              <InlineAlert tone="success" icon={<CheckCircle2 />}>
                Profile saved
              </InlineAlert>
            )}
            {status === "error" && (
              <InlineAlert tone="error" icon={<AlertCircle />}>
                {errorMsg}
              </InlineAlert>
            )}
          </div>
          <Button onClick={handleSave} loading={saving}>
            <Save className="size-4" /> Save profile
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
