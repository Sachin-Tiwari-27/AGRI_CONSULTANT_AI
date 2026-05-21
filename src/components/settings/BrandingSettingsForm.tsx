"use client";

import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { InlineAlert } from "@/components/ui/status";
import { Separator } from "@/components/ui/separator";
import {
  Save,
  Upload,
  Image as ImageIcon,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
} from "lucide-react";

const DEFAULT_PRIMARY = "#1A5C38";
const DEFAULT_SECONDARY = "#2E7D52";

interface BrandingProfile {
  logo_url?: string | null;
  brand_primary_color?: string | null;
  brand_secondary_color?: string | null;
  brand_footer_text?: string | null;
  full_name?: string | null;
  company_name?: string | null;
}

export function BrandingSettingsForm({
  profile,
}: {
  profile: BrandingProfile | null;
}) {
  const [logoUrl, setLogoUrl] = useState(profile?.logo_url ?? "");
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
      const res = await fetch("/api/profile/update/upload-avatar", {
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

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Report branding</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Applied to every new report you generate.
            </p>
          </div>
          <button
            onClick={() => setPreview((v) => !v)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground px-2.5 py-1.5 rounded-lg border border-border hover:bg-muted transition-colors"
          >
            {preview ? (
              <EyeOff className="size-3.5" />
            ) : (
              <Eye className="size-3.5" />
            )}
            {preview ? "Hide preview" : "Preview"}
          </button>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
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
                  className="h-7 mb-3 object-contain brightness-0 invert"
                />
              )}
              <p className="text-[10px] font-bold uppercase tracking-widest opacity-70 mb-1">
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
          <p className="text-xs font-medium text-foreground/80 mb-2">
            Company logo
          </p>
          <div className="flex items-center gap-4">
            <div className="w-24 h-12 rounded-lg bg-muted border border-border flex items-center justify-center overflow-hidden flex-shrink-0">
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt="Logo"
                  className="w-full h-full object-contain p-1"
                />
              ) : (
                <ImageIcon className="size-5 text-muted-foreground/40" />
              )}
            </div>
            <div>
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="flex items-center gap-1.5 text-xs text-brand-700 hover:text-brand-800 font-medium px-3 py-1.5 rounded-lg border border-brand-200 hover:bg-brand-50 transition-colors disabled:opacity-50"
              >
                <Upload className="size-3" />
                {uploading
                  ? "Uploading…"
                  : logoUrl
                    ? "Replace logo"
                    : "Upload logo"}
              </button>
              <p className="text-[11px] text-muted-foreground mt-1">
                PNG or SVG · shown on report cover
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
                className="text-xs text-destructive hover:text-destructive/80 ml-auto"
              >
                Remove
              </button>
            )}
          </div>
        </div>

        <Separator />

        {/* Colour pickers */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium text-foreground/80">
              Brand colours
            </p>
            <button
              onClick={() => {
                setPrimary(DEFAULT_PRIMARY);
                setSecondary(DEFAULT_SECONDARY);
                setStatus("idle");
              }}
              className="text-[11px] text-muted-foreground hover:text-foreground"
            >
              Reset to default
            </button>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[11px] text-muted-foreground block mb-1.5">
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
                  className="w-8 h-8 rounded-lg border border-border cursor-pointer p-0.5 bg-background"
                />
                <Input
                  value={primary}
                  onChange={(e) => {
                    setPrimary(e.target.value);
                    setStatus("idle");
                  }}
                  placeholder="#1A5C38"
                  className="font-mono text-xs"
                />
              </div>
            </div>
            <div>
              <label className="text-[11px] text-muted-foreground block mb-1.5">
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
                  className="w-8 h-8 rounded-lg border border-border cursor-pointer p-0.5 bg-background"
                />
                <Input
                  value={secondary}
                  onChange={(e) => {
                    setSecondary(e.target.value);
                    setStatus("idle");
                  }}
                  placeholder="#2E7D52"
                  className="font-mono text-xs"
                />
              </div>
            </div>
          </div>
          {/* Gradient preview strip */}
          <div
            className="mt-3 h-2 rounded-full"
            style={{
              background: `linear-gradient(to right, ${primary}, ${secondary})`,
            }}
          />
        </div>

        <Separator />

        {/* Footer text */}
        <Field label="Report footer text" htmlFor="footer_text">
          <Input
            id="footer_text"
            value={footerText}
            onChange={(e) => {
              setFooterText(e.target.value);
              setStatus("idle");
            }}
            placeholder="© 2025 Your Company · Confidential Business Intelligence Report"
          />
        </Field>

        {/* Status + save */}
        <div className="flex items-center justify-between">
          <div>
            {status === "saved" && (
              <InlineAlert tone="success" icon={<CheckCircle2 />}>
                Branding saved
              </InlineAlert>
            )}
            {status === "error" && (
              <InlineAlert tone="error" icon={<AlertCircle />}>
                {errorMsg}
              </InlineAlert>
            )}
          </div>
          <Button onClick={handleSave} loading={saving}>
            <Save className="size-4" /> Save branding
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
