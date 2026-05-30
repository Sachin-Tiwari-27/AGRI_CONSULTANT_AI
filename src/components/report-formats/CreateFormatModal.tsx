"use client";

// ── src/components/report-formats/CreateFormatModal.tsx ──────────────────────
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Copy, FileText, Plus } from "lucide-react";
import type { ReportFormat } from "@/types/report-format";

interface Props {
  existingFormats: ReportFormat[];
  onClose: () => void;
  onCreated: (format: ReportFormat) => void;
}

export function CreateFormatModal({
  existingFormats,
  onClose,
  onCreated,
}: Props) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [cloneFrom, setCloneFrom] = useState<string>("default");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleCreate() {
    if (!name.trim()) {
      setError("Format name is required");
      return;
    }
    setLoading(true);
    setError("");

    try {
      // Find the source format to clone sections from
      const sourceFormat =
        cloneFrom === "default"
          ? (existingFormats.find((f) => f.is_default) ?? existingFormats[0])
          : existingFormats.find((f) => f.id === cloneFrom);

      const sectionsToClone = sourceFormat?.sections ?? [];

      // Reset prompt_confirmed on cloned sections so consultant reviews them
      const clonedSections = sectionsToClone.map((s: any) => ({
        ...s,
        prompt_confirmed: s.builtin_ai_task ? true : false, // custom sections need re-confirm
        ai_generated_prompt: s.ai_generated_prompt ?? null,
      }));

      const res = await fetch("/api/report-formats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          sections: clonedSections,
          excerpt_section_keys: sourceFormat?.excerpt_section_keys ?? [
            "executive_summary",
          ],
          excerpt_word_limit: sourceFormat?.excerpt_word_limit ?? 300,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create");
      onCreated(data);
    } catch (e: any) {
      setError(e.message || "Failed to create format");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Create report format</DialogTitle>
          <DialogDescription>
            Give your format a name and choose a starting point. You can add,
            remove, and customise sections after creation.
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 py-4 space-y-4">
          <Field label="Format name" required htmlFor="format-name">
            <Input
              id="format-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Livestock Farm Feasibility, Solar Greenhouse Report"
              autoFocus
            />
          </Field>

          <Field label="Description" htmlFor="format-desc">
            <Textarea
              id="format-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional — what project types is this format for?"
              className="min-h-[60px]"
            />
          </Field>

          <div>
            <p className="text-xs font-medium text-foreground/80 mb-2">
              Start from
            </p>
            <div className="space-y-2">
              {/* Blank option */}
              <button
                type="button"
                onClick={() => setCloneFrom("blank")}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-left transition-all ${
                  cloneFrom === "blank"
                    ? "border-brand-600 bg-brand-50"
                    : "border-border hover:border-brand-200"
                }`}
              >
                <Plus className="size-4 text-muted-foreground flex-shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-foreground">
                    Blank format
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Start from scratch — add sections manually
                  </p>
                </div>
              </button>

              {/* Clone from existing */}
              {existingFormats.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setCloneFrom(f.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-left transition-all ${
                    cloneFrom === f.id
                      ? "border-brand-600 bg-brand-50"
                      : "border-border hover:border-brand-200"
                  }`}
                >
                  <Copy className="size-4 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-semibold text-foreground truncate">
                        Copy from: {f.name}
                      </p>
                      {f.is_default && (
                        <Badge variant="green" className="text-[9px] py-0">
                          Default
                        </Badge>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      {f.sections?.length ?? 0} sections
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {error && (
            <p className="text-xs text-destructive bg-destructive/8 border border-destructive/20 px-3 py-2 rounded-lg">
              {error}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleCreate} loading={loading}>
            <FileText className="size-3.5" /> Create format
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
