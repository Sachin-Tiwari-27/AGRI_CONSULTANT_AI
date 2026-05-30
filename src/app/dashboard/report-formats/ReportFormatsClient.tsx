"use client";

// ── src/app/dashboard/report-formats/ReportFormatsClient.tsx ─────────────────
import { useState } from "react";
import {
  Plus,
  FileText,
  Copy,
  Trash2,
  ChevronRight,
  Star,
  Edit3,
  LayoutTemplate,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/toast";
import { formatDate } from "@/lib/utils";
import { ReportFormatEditorModal } from "@/components/report-formats/ReportFormatEditorModal";
import { CreateFormatModal } from "@/components/report-formats/CreateFormatModal";
import type { ReportFormat } from "@/types/report-format";

interface Props {
  initialFormats: ReportFormat[];
}

export function ReportFormatsClient({ initialFormats }: Props) {
  const [formats, setFormats] = useState<ReportFormat[]>(initialFormats);
  const [editingFormat, setEditingFormat] = useState<ReportFormat | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleDuplicate(format: ReportFormat) {
    try {
      const res = await fetch("/api/report-formats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `${format.name} (copy)`,
          description: format.description,
          sections: format.sections,
          excerpt_section_keys: format.excerpt_section_keys,
          excerpt_word_limit: format.excerpt_word_limit,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setFormats((prev) => [...prev, data]);
      toast.success("Format duplicated");
    } catch (e: any) {
      toast.error(e.message || "Failed to duplicate");
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/report-formats/${id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setFormats((prev) => prev.filter((f) => f.id !== id));
      toast.success("Format deleted");
    } catch (e: any) {
      toast.error(e.message || "Failed to delete");
    } finally {
      setDeletingId(null);
    }
  }

  function handleFormatSaved(updated: ReportFormat) {
    setFormats((prev) => prev.map((f) => (f.id === updated.id ? updated : f)));
    setEditingFormat(null);
    toast.success("Format saved");
  }

  function handleFormatCreated(newFormat: ReportFormat) {
    setFormats((prev) => [...prev, newFormat]);
    setShowCreate(false);
    setEditingFormat(newFormat);
    toast.success("Format created — now configure its sections");
  }

  const sectionTypeColors: Record<string, string> = {
    content: "gray",
    financial: "green",
    market: "blue",
    risk: "amber",
    technical: "purple",
    operational: "violet",
    custom: "orange",
  };

  return (
    <>
      {editingFormat && (
        <ReportFormatEditorModal
          format={editingFormat}
          onClose={() => setEditingFormat(null)}
          onSaved={handleFormatSaved}
        />
      )}
      {showCreate && (
        <CreateFormatModal
          existingFormats={formats}
          onClose={() => setShowCreate(false)}
          onCreated={handleFormatCreated}
        />
      )}

      <div className="max-w-5xl mx-auto px-6 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground max-w-lg">
              Create custom report formats with different sections, word
              targets, and AI prompts. Assign a format to each project when it's
              created.
            </p>
          </div>
          <Button size="sm" onClick={() => setShowCreate(true)}>
            <Plus className="size-4" /> New format
          </Button>
        </div>

        {/* Format list */}
        <div className="space-y-3">
          {formats.map((format) => {
            const sectionCount = format.sections?.length ?? 0;
            const confirmedCount = (format.sections ?? []).filter(
              (s: any) => s.prompt_confirmed,
            ).length;
            const allConfirmed =
              sectionCount > 0 && confirmedCount === sectionCount;

            return (
              <div
                key={format.id}
                className="rounded-xl border border-border bg-card hover:border-brand-200 transition-colors"
              >
                <div className="flex items-start gap-4 px-5 py-4">
                  {/* Icon */}
                  <div className="w-10 h-10 rounded-xl bg-brand-50 border border-brand-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <LayoutTemplate className="size-5 text-brand-700" />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-semibold text-foreground truncate">
                        {format.name}
                      </p>
                      {format.is_default && (
                        <Badge variant="green">
                          <Star className="size-2.5" /> Default
                        </Badge>
                      )}
                      {!allConfirmed && sectionCount > 0 && (
                        <Badge variant="amber">
                          {sectionCount - confirmedCount} prompts pending
                        </Badge>
                      )}
                    </div>
                    {format.description && (
                      <p className="text-xs text-muted-foreground mb-2 truncate">
                        {format.description}
                      </p>
                    )}

                    {/* Section type breakdown */}
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      <span className="text-[10px] text-muted-foreground mr-1">
                        {sectionCount} sections:
                      </span>
                      {Object.entries(
                        (format.sections ?? []).reduce(
                          (acc: Record<string, number>, s: any) => {
                            acc[s.section_type] =
                              (acc[s.section_type] || 0) + 1;
                            return acc;
                          },
                          {},
                        ),
                      ).map(([type, count]) => (
                        <Badge
                          key={type}
                          variant={(sectionTypeColors[type] as any) || "gray"}
                          className="text-[9px] py-0"
                        >
                          {count} {type}
                        </Badge>
                      ))}
                    </div>

                    <p className="text-[10px] text-muted-foreground mt-2">
                      Updated {formatDate(format.updated_at)}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDuplicate(format)}
                    >
                      <Copy className="size-3.5" /> Duplicate
                    </Button>
                    <Button size="sm" onClick={() => setEditingFormat(format)}>
                      <Edit3 className="size-3.5" /> Edit
                      <ChevronRight className="size-3.5" />
                    </Button>
                    {!format.is_default && (
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        loading={deletingId === format.id}
                        onClick={() => handleDelete(format.id)}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {formats.length === 0 && (
            <div className="rounded-xl border border-dashed border-border bg-muted/20 px-8 py-14 text-center">
              <LayoutTemplate className="size-8 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm font-medium text-foreground">
                No report formats yet
              </p>
              <p className="text-xs text-muted-foreground mt-1 mb-4">
                Your default format will be created automatically.
              </p>
              <Button size="sm" onClick={() => setShowCreate(false)}>
                Refresh
              </Button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
