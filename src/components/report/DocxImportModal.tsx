"use client";

// ── src/components/report/DocxImportModal.tsx ─────────────────────────────────
import { useState, useRef } from "react";
import {
  X,
  Upload,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Loader2,
  FileText,
  ChevronDown,
  ChevronUp,
  Plus,
  Check,
  HelpCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/toast";
import type { DocxImportPendingSection } from "@/types/report-format";

interface Props {
  projectId: string;
  onClose: () => void;
  onApplied: () => void;
}

type ImportStep = "upload" | "review" | "applying";

export function DocxImportModal({ projectId, onClose, onApplied }: Props) {
  const [step, setStep] = useState<ImportStep>("upload");
  const [uploading, setUploading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [parseResult, setParseResult] = useState<{
    pending: DocxImportPendingSection[];
    matched: DocxImportPendingSection[];
    unmatched: DocxImportPendingSection[];
    missingSectionKeys: string[];
  } | null>(null);

  // Per-section decisions
  const [sectionDecisions, setSectionDecisions] = useState<
    Record<
      string,
      { include: boolean; addToFormat: boolean; assignedKey?: string }
    >
  >({});
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFileUpload(file: File) {
    if (!file.name.endsWith(".docx") && !file.name.endsWith(".doc")) {
      toast.error("Please upload a .docx Word document");
      return;
    }

    setUploading(true);
    try {
      const form = new FormData();
      form.append("projectId", projectId);
      form.append("file", file);

      const res = await fetch("/api/report/import-docx", {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Parse failed");

      setParseResult(data);

      // Default decisions: include all matched, exclude unmatched
      const defaults: typeof sectionDecisions = {};
      for (const p of data.pending) {
        const idx = data.pending.indexOf(p);
        defaults[idx] = {
          include: !p.is_new_section,
          addToFormat: false,
        };
      }
      setSectionDecisions(defaults);
      setStep("review");
    } catch (e: any) {
      toast.error(e.message || "Failed to parse document");
    } finally {
      setUploading(false);
    }
  }

  async function handleApply() {
    if (!parseResult) return;
    setApplying(true);

    const sectionsToUpdate: Array<{ key: string; content: string }> = [];
    const newSections: Array<{
      key: string;
      title: string;
      content: string;
      addToFormat: boolean;
    }> = [];

    parseResult.pending.forEach((p, idx) => {
      const decision = sectionDecisions[idx];
      if (!decision?.include) return;

      if (!p.is_new_section && p.matched_key) {
        sectionsToUpdate.push({ key: p.matched_key, content: p.content });
      } else if (p.is_new_section) {
        const key =
          decision.assignedKey ||
          `custom_${p.title
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "_")
            .slice(0, 30)}`;
        newSections.push({
          key,
          title: p.title,
          content: p.content,
          addToFormat: decision.addToFormat,
        });
      }
    });

    try {
      const res = await fetch("/api/report/import-docx/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          sections: sectionsToUpdate,
          newSections,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Apply failed");

      toast.success(
        `${data.updatedCount} section${data.updatedCount !== 1 ? "s" : ""} updated from Word document`,
      );
      onApplied();
    } catch (e: any) {
      toast.error(e.message || "Failed to apply changes");
    } finally {
      setApplying(false);
    }
  }

  const includedCount = Object.values(sectionDecisions).filter(
    (d) => d.include,
  ).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative bg-card border border-border rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-50">
              <Upload className="size-4 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">
                Import from Word document
              </p>
              <p className="text-[11px] text-muted-foreground">
                {step === "upload"
                  ? "Upload a .docx file to update report sections"
                  : `${parseResult?.pending.length ?? 0} sections found`}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {step === "upload" && (
            <div className="px-6 py-8 space-y-4">
              <div
                className="border-2 border-dashed border-border rounded-xl p-10 text-center cursor-pointer hover:border-brand-300 hover:bg-brand-50/20 transition-colors"
                onClick={() => fileRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const f = e.dataTransfer.files[0];
                  if (f) handleFileUpload(f);
                }}
              >
                {uploading ? (
                  <Loader2 className="size-8 text-muted-foreground/40 mx-auto mb-3 animate-spin" />
                ) : (
                  <Upload className="size-8 text-muted-foreground/30 mx-auto mb-3" />
                )}
                <p className="text-sm font-medium text-foreground mb-1">
                  {uploading
                    ? "Parsing document…"
                    : "Drop your .docx file here"}
                </p>
                <p className="text-xs text-muted-foreground">
                  or click to browse · .docx files only
                </p>
              </div>

              <input
                ref={fileRef}
                type="file"
                accept=".docx,.doc"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFileUpload(f);
                }}
              />

              <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3">
                <p className="text-xs font-semibold text-blue-700 mb-1.5">
                  How it works
                </p>
                <ul className="space-y-1 text-[11px] text-blue-600">
                  <li>
                    • Headings in the Word doc are matched to report sections by
                    title
                  </li>
                  <li>
                    • Matched sections update automatically — you confirm before
                    applying
                  </li>
                  <li>
                    • New headings not found in the report can be added as new
                    sections
                  </li>
                  <li>
                    • Charts inserted in the report are not preserved — add them
                    manually after import
                  </li>
                </ul>
              </div>
            </div>
          )}

          {step === "review" && parseResult && (
            <div className="px-6 py-4 space-y-3">
              {/* Summary strip */}
              <div className="grid grid-cols-3 gap-3 mb-2">
                {[
                  {
                    label: "Matched",
                    count: parseResult.matched.length,
                    icon: CheckCircle2,
                    color: "text-brand-600",
                  },
                  {
                    label: "New sections",
                    count: parseResult.unmatched.length,
                    icon: HelpCircle,
                    color: "text-amber-500",
                  },
                  {
                    label: "Missing from doc",
                    count: parseResult.missingSectionKeys.length,
                    icon: AlertCircle,
                    color: "text-muted-foreground",
                  },
                ].map(({ label, count, icon: Icon, color }) => (
                  <div
                    key={label}
                    className="rounded-lg border border-border bg-muted/30 px-3 py-2 flex items-center gap-2"
                  >
                    <Icon className={`size-4 flex-shrink-0 ${color}`} />
                    <div>
                      <p className="text-sm font-bold text-foreground">
                        {count}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {label}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Section decisions */}
              {parseResult.pending.map((p, idx) => {
                const decision = sectionDecisions[idx] ?? {
                  include: false,
                  addToFormat: false,
                };
                const isExpanded = expandedIdx === idx;
                const matchPct = Math.round(p.match_confidence * 100);

                return (
                  <div
                    key={idx}
                    className={`rounded-xl border-2 transition-colors ${
                      decision.include
                        ? p.is_new_section
                          ? "border-amber-200 bg-amber-50/20"
                          : "border-brand-200 bg-brand-50/20"
                        : "border-border bg-card opacity-60"
                    }`}
                  >
                    {/* Row */}
                    <div className="flex items-center gap-3 px-4 py-3">
                      {/* Toggle include */}
                      <button
                        onClick={() =>
                          setSectionDecisions((prev) => ({
                            ...prev,
                            [idx]: { ...decision, include: !decision.include },
                          }))
                        }
                        className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                          decision.include
                            ? "bg-brand-700 border-brand-700"
                            : "border-border hover:border-brand-300"
                        }`}
                      >
                        {decision.include && (
                          <Check className="size-3 text-white" />
                        )}
                      </button>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-medium text-foreground truncate">
                            {p.title}
                          </p>
                          {p.is_new_section ? (
                            <Badge
                              variant="amber"
                              className="text-[9px] py-0 flex-shrink-0"
                            >
                              New
                            </Badge>
                          ) : (
                            <Badge
                              variant="green"
                              className="text-[9px] py-0 flex-shrink-0"
                            >
                              {matchPct}% match
                            </Badge>
                          )}
                        </div>
                        {!p.is_new_section && p.matched_key && (
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            → Updates:{" "}
                            <code className="bg-muted px-1 rounded">
                              {p.matched_key}
                            </code>
                          </p>
                        )}
                      </div>

                      <button
                        onClick={() => setExpandedIdx(isExpanded ? null : idx)}
                        className="p-1 rounded text-muted-foreground hover:text-foreground"
                      >
                        {isExpanded ? (
                          <ChevronUp className="size-3.5" />
                        ) : (
                          <ChevronDown className="size-3.5" />
                        )}
                      </button>
                    </div>

                    {/* Expanded: content preview + options */}
                    {isExpanded && (
                      <div className="px-4 pb-4 space-y-3 border-t border-border/50 pt-3">
                        {/* Content preview */}
                        <div>
                          <p className="text-[10px] font-medium text-muted-foreground mb-1">
                            Content preview
                          </p>
                          <pre className="text-[10px] text-muted-foreground bg-muted rounded px-3 py-2 max-h-28 overflow-y-auto whitespace-pre-wrap font-sans leading-relaxed">
                            {p.content.slice(0, 400)}
                            {p.content.length > 400 ? "…" : ""}
                          </pre>
                        </div>

                        {/* New section options */}
                        {p.is_new_section && decision.include && (
                          <label className="flex items-start gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={decision.addToFormat}
                              onChange={(e) =>
                                setSectionDecisions((prev) => ({
                                  ...prev,
                                  [idx]: {
                                    ...decision,
                                    addToFormat: e.target.checked,
                                  },
                                }))
                              }
                              className="mt-0.5 rounded"
                            />
                            <div>
                              <p className="text-xs font-medium text-foreground">
                                Add to report format
                              </p>
                              <p className="text-[10px] text-muted-foreground">
                                Creates a new section in the project's format so
                                it can be AI-regenerated later
                              </p>
                            </div>
                          </label>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Missing sections note */}
              {parseResult.missingSectionKeys.length > 0 && (
                <div className="rounded-lg border border-border bg-muted/30 px-4 py-3">
                  <p className="text-[11px] font-medium text-muted-foreground mb-1">
                    {parseResult.missingSectionKeys.length} existing section
                    {parseResult.missingSectionKeys.length !== 1 ? "s" : ""} not
                    found in the Word document:
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {parseResult.missingSectionKeys.map((k) => (
                      <code
                        key={k}
                        className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground"
                      >
                        {k}
                      </code>
                    ))}
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    These sections will keep their existing content.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {step === "review" && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-muted/30 flex-shrink-0">
            <p className="text-xs text-muted-foreground">
              {includedCount} section{includedCount !== 1 ? "s" : ""} will be
              updated
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={onClose}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleApply}
                loading={applying}
                disabled={includedCount === 0}
              >
                <Check className="size-3.5" /> Apply {includedCount} update
                {includedCount !== 1 ? "s" : ""}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
