"use client";
import { useState, useRef } from "react";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Field, Input, Textarea } from "@/components/ui/FormFields";
import { Button } from "@/components/ui/Button";
import {
  Save,
  Upload,
  User,
  Camera,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

interface Props {
  profile: any;
}

export function ProfileSettingsForm({ profile }: Props) {
  const [form, setForm] = useState({
    full_name: profile?.full_name ?? "",
    phone: profile?.phone ?? "",
    company_name: profile?.company_name ?? "",
    bio: profile?.bio ?? "",
    website: profile?.website ?? "",
    linkedin_url: profile?.linkedin_url ?? "",
  });
  const [avatarUrl, setAvatarUrl] = useState<string>(profile?.avatar_url ?? "");
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
      const res = await fetch("/api/profile/upload-avatar", {
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
        <h2 className="font-semibold text-slate-900">Profile</h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Your consultant identity shown to clients and in reports.
        </p>
      </CardHeader>
      <CardBody className="space-y-5">
        {/* Avatar upload */}
        <div className="flex items-center gap-5">
          <div className="relative flex-shrink-0">
            <div className="w-16 h-16 rounded-full bg-slate-100 border-2 border-slate-200 overflow-hidden flex items-center justify-center">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt="Avatar"
                  className="w-full h-full object-cover"
                />
              ) : (
                <User className="w-7 h-7 text-slate-400" />
              )}
            </div>
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="absolute -bottom-1 -right-1 w-6 h-6 bg-green-700 rounded-full flex items-center justify-center border-2 border-white hover:bg-green-600 transition-colors disabled:opacity-50"
            >
              <Camera className="w-3 h-3 text-white" />
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
            <p className="text-sm font-medium text-slate-800">Profile photo</p>
            <p className="text-xs text-slate-500 mt-0.5">
              {uploading ? "Uploading…" : "JPEG, PNG or WebP up to 5MB"}
            </p>
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="text-xs text-green-700 hover:text-green-800 font-medium mt-1 disabled:opacity-50"
            >
              {avatarUrl ? "Change photo" : "Upload photo"}
            </button>
          </div>
        </div>

        {/* Core fields */}
        <div className="grid grid-cols-2 gap-4">
          <Field label="Full name" required>
            <Input
              value={form.full_name}
              onChange={(e) => set("full_name", e.target.value)}
              placeholder="Your full name"
            />
          </Field>
          <Field label="Phone number">
            <Input
              value={form.phone}
              onChange={(e) => set("phone", e.target.value)}
              placeholder="+968 9XXX XXXX"
            />
          </Field>
          <Field label="Company / organisation">
            <Input
              value={form.company_name}
              onChange={(e) => set("company_name", e.target.value)}
              placeholder="AgriConsult Ltd."
            />
          </Field>
          <Field label="Website">
            <Input
              value={form.website}
              onChange={(e) => set("website", e.target.value)}
              placeholder="https://yoursite.com"
              type="url"
            />
          </Field>
          <Field label="LinkedIn URL" className="col-span-2">
            <Input
              value={form.linkedin_url}
              onChange={(e) => set("linkedin_url", e.target.value)}
              placeholder="https://linkedin.com/in/yourname"
              type="url"
            />
          </Field>
        </div>

        {/* Bio */}
        <Field label="Bio / specialisations">
          <Textarea
            value={form.bio}
            onChange={(e) => set("bio", e.target.value)}
            placeholder="Brief description of your expertise, crops specialised in, regions covered…"
            className="min-h-[80px]"
          />
        </Field>

        {/* Email (read-only) */}
        <div>
          <p className="text-xs font-medium text-slate-600 mb-1.5">
            Email address
          </p>
          <p className="text-sm text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
            {profile?.email ?? "—"}
            <span className="ml-2 text-[10px] text-slate-400">
              (cannot be changed here)
            </span>
          </p>
        </div>

        {/* Status + save */}
        <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
          <div>
            {status === "saved" && (
              <p className="flex items-center gap-1.5 text-sm text-green-700">
                <CheckCircle2 className="w-4 h-4" /> Profile saved
              </p>
            )}
            {status === "error" && (
              <p className="flex items-center gap-1.5 text-sm text-red-600">
                <AlertCircle className="w-4 h-4" /> {errorMsg}
              </p>
            )}
          </div>
          <Button onClick={handleSave} loading={saving}>
            <Save className="w-4 h-4" /> Save profile
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}
