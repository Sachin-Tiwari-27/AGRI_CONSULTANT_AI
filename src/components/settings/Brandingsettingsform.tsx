"use client";
import { useState, useRef } from "react";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/FormFields";
import { Button } from "@/components/ui/Button";
import {
  Save,
  Upload,
  Palette,
  Image,
  CheckCircle2,
  AlertCircle,
  Eye,
} from "lucide-react";

interface Props {
  profile: any;
}

const DEFAULT_PRIMARY = "#1A5C38";
const DEFAULT_SECONDARY = "#2E7D52";

export function BrandingSettingsForm({ profile }: Props) {
  const [logoUrl, setLogoUrl] = useState<string>(profile?.logo_url ?? "");
  const [primary, setPrimary] = useState(
    profile?.brand_primary_color ?? DEFAULT_PRIMARY,
  );
  const [secondary, setSecondary] = useState(
    profile?.brand_secondary_color ?? DEFAULT_SECONDARY,
  );
  const [footerText, setFooterText] = useState(
    profile?.brand_footer_text ?? "",
  );
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [preview, setPreview] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function uploadLogo(file: File) {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("type", "logo");
      const res = await fetch("/api/profile/upload-avatar", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      setLogoUrl(data.url);
    } catch (e: any) {
      setErrorMsg(e.message || "Logo upload failed");
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
        body: JSON.stringify({
          logo_url: logoUrl,
          brand_primary_color: primary,
          brand_secondary_color: secondary,
          brand_footer_text: footerText,
        }),
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

  function resetColors() {
    setPrimary(DEFAULT_PRIMARY);
    setSecondary(DEFAULT_SECONDARY);
    setStatus("idle");
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-slate-900">Report branding</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              These defaults are applied to every new report you generate.
            </p>
          </div>
          <button
            onClick={() => setPreview((p) => !p)}
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
          >
            <Eye className="w-3 h-3" /> {preview ? "Hide" : "Preview"}
          </button>
        </div>
      </CardHeader>
      <CardBody className="space-y-5">
        {/* Live preview */}
        {preview && (
          <div
            className="rounded-xl p-5 text-white relative overflow-hidden"
            style={{
              background: `linear-gradient(135deg, ${primary}, ${secondary})`,
            }}
          >
            <div className="relative z-10">
              {logoUrl && (
                <img
                  src={logoUrl}
                  alt="Logo"
                  className="h-8 mb-3 object-contain brightness-0 invert"
                />
              )}
              <p className="text-xs font-bold uppercase tracking-widest opacity-70 mb-1">
                Feasibility Report
              </p>
              <h3 className="text-lg font-bold">
                Agricultural Project Synthesis
              </h3>
              <p className="text-white/70 text-xs mt-1">
                By {profile?.full_name || "Your Name"} ·{" "}
                {profile?.company_name || "Your Company"}
              </p>
              {footerText && (
                <p className="text-white/50 text-[10px] mt-3 border-t border-white/20 pt-2">
                  {footerText}
                </p>
              )}
            </div>
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16 blur-2xl" />
          </div>
        )}

        {/* Logo upload */}
        <div>
          <p className="text-xs font-medium text-slate-600 mb-2">
            Company logo
          </p>
          <div className="flex items-center gap-4">
            <div className="w-24 h-12 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center overflow-hidden">
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt="Logo"
                  className="w-full h-full object-contain p-1"
                />
              ) : (
                <Image className="w-5 h-5 text-slate-300" />
              )}
            </div>
            <div>
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="flex items-center gap-1.5 text-xs text-green-700 hover:text-green-800 font-medium px-3 py-1.5 rounded-lg border border-green-200 hover:bg-green-50 transition-colors disabled:opacity-50"
              >
                <Upload className="w-3 h-3" />
                {uploading
                  ? "Uploading…"
                  : logoUrl
                    ? "Replace logo"
                    : "Upload logo"}
              </button>
              <p className="text-[11px] text-slate-400 mt-1">
                PNG or SVG recommended · shown on report header
              </p>
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/svg+xml,image/jpeg,image/webp"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) uploadLogo(f);
                }}
              />
            </div>
            {logoUrl && (
              <button
                onClick={() => setLogoUrl("")}
                className="text-xs text-red-500 hover:text-red-700"
              >
                Remove
              </button>
            )}
          </div>
        </div>

        {/* Colour pickers */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium text-slate-600">Brand colours</p>
            <button
              onClick={resetColors}
              className="text-xs text-slate-400 hover:text-slate-600"
            >
              Reset to default
            </button>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[11px] text-slate-500 block mb-1.5">
                Primary colour
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={primary}
                  onChange={(e) => {
                    setPrimary(e.target.value);
                    setStatus("idle");
                  }}
                  className="w-9 h-9 rounded-lg border border-slate-200 cursor-pointer p-0.5 bg-white"
                />
                <Input
                  value={primary}
                  onChange={(e) => {
                    setPrimary(e.target.value);
                    setStatus("idle");
                  }}
                  placeholder="#1A5C38"
                  className="font-mono text-sm"
                />
              </div>
            </div>
            <div>
              <label className="text-[11px] text-slate-500 block mb-1.5">
                Secondary colour
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={secondary}
                  onChange={(e) => {
                    setSecondary(e.target.value);
                    setStatus("idle");
                  }}
                  className="w-9 h-9 rounded-lg border border-slate-200 cursor-pointer p-0.5 bg-white"
                />
                <Input
                  value={secondary}
                  onChange={(e) => {
                    setSecondary(e.target.value);
                    setStatus("idle");
                  }}
                  placeholder="#2E7D52"
                  className="font-mono text-sm"
                />
              </div>
            </div>
          </div>

          {/* Colour preview strip */}
          <div
            className="mt-3 h-3 rounded-full overflow-hidden"
            style={{
              background: `linear-gradient(to right, ${primary}, ${secondary})`,
            }}
          />
        </div>

        {/* Footer text */}
        <Field label="Report footer text">
          <Input
            value={footerText}
            onChange={(e) => {
              setFooterText(e.target.value);
              setStatus("idle");
            }}
            placeholder="© 2025 Your Company · Confidential Business Intelligence Report"
          />
        </Field>

        {/* Status + save */}
        <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
          <div>
            {status === "saved" && (
              <p className="flex items-center gap-1.5 text-sm text-green-700">
                <CheckCircle2 className="w-4 h-4" /> Branding saved
              </p>
            )}
            {status === "error" && (
              <p className="flex items-center gap-1.5 text-sm text-red-600">
                <AlertCircle className="w-4 h-4" /> {errorMsg}
              </p>
            )}
          </div>
          <Button onClick={handleSave} loading={saving}>
            <Save className="w-4 h-4" /> Save branding
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}
