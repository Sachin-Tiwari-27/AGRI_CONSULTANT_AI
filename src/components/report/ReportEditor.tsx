"use client";

import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MarkdownRenderer } from "@/components/ui/markdown-renderer";
import { RichEditor } from "@/components/report/RichEditor";
import { createClient } from "@/lib/supabase/client";
import { REPORT_SECTIONS } from "@/lib/report-section-config";
import {
  CheckCircle,
  Edit3,
  RefreshCw,
  Sparkles,
  Loader2,
  Eye,
  EyeOff,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import type { Report, ReportSectionKey, Project } from "@/types";
import { SectionInstructionsPanel } from "@/components/report/SectionInstructionsPanel";
import { RegenerateButton } from "@/components/report/RegenerateModal";
import { ReportEditorFooter, useAutosave } from "@/components/report/ReportEditorFooter";

const SECTION_TITLES: Record<string, string> = Object.fromEntries(
  REPORT_SECTIONS.map((s) => [s.key, s.title]),
);
const ORDERED_KEYS = REPORT_SECTIONS.map((s) => s.key) as ReportSectionKey[];

interface Props {
  report: Report;
  project: Project;
  projectId: string;
  onUpdate: (report: Report) => void;
  onProjectUpdate: (patch: Partial<Project>) => void;
  streamingSection?: string | null;
  activeSection: ReportSectionKey;
  onSectionChange: (key: ReportSectionKey) => void;
  sectionInstructions?: Record<string, string>;
  onInstructionSaved?: (sectionKey: string, instruction: string) => void;
}

export function ReportEditor({
  report,
  project,
  projectId,
  onUpdate,
  onProjectUpdate,
  streamingSection,
  activeSection,
  onSectionChange,
  sectionInstructions,
  onInstructionSaved,
}: Props) {
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const editContentRef = useRef<string>("");
  const [regenerating, setRegenerating] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const supabase = createClient();

  const { triggerAutosave, lastSaved, saving: autoSaving } = useAutosave({
    onSave: () => saveSection(activeSection),
    isEditing: editingSection === activeSection,
    delay: 30_000,
  });

  const section = report.sections[activeSection];
  const isStreaming = streamingSection === activeSection;
  const isEditing = editingSection === activeSection;
  const hasContent = !!section?.content;

  // Calculate word and character counts
  const contentToCount = isEditing ? editContentRef.current : (section?.content || "");
  const wordCount = contentToCount
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
  const charCount = contentToCount.length;

  // Navigate between sections
  const currentIdx = ORDERED_KEYS.indexOf(activeSection);
  const prevKey = currentIdx > 0 ? ORDERED_KEYS[currentIdx - 1] : null;
  const nextKey =
    currentIdx < ORDERED_KEYS.length - 1 ? ORDERED_KEYS[currentIdx + 1] : null;

  async function saveSection(key: string) {
    setSaving(true);
    const updated = {
      ...report.sections,
      [key]: {
        ...report.sections[key as ReportSectionKey],
        content: editContentRef.current,
        ai_generated: false,
        last_edited_at: new Date().toISOString(),
      },
    };
    await supabase
      .from("reports")
      .update({ sections: updated })
      .eq("project_id", projectId);
    onUpdate({ ...report, sections: updated as typeof report.sections });
    setEditingSection(null);
    setSaving(false);
  }

  async function approveSection(key: string) {
    const updated = {
      ...report.sections,
      [key]: { ...report.sections[key as ReportSectionKey], approved: true },
    };
    await supabase
      .from("reports")
      .update({ sections: updated })
      .eq("project_id", projectId);
    onUpdate({ ...report, sections: updated as typeof report.sections });
  }

  async function regenerateSection(key: string) {
    setRegenerating(key);
    try {
      await fetch("/api/report/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, sectionsToGenerate: [key] }),
      });
      const { data } = await supabase
        .from("reports")
        .select("*")
        .eq("project_id", projectId)
        .single();
      if (data) onUpdate(data as Report);
    } finally {
      setRegenerating(null);
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Section header */}
      <div className="flex items-center justify-between mb-4 gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <h2 className="text-base font-semibold text-foreground truncate">
            {SECTION_TITLES[activeSection] || activeSection}
          </h2>
          {section?.ai_generated && !isStreaming && (
            <Badge variant="purple">
              <Sparkles className="size-3" /> AI draft
            </Badge>
          )}
          {section?.approved && (
            <Badge variant="green">
              <CheckCircle className="size-3" /> Approved
            </Badge>
          )}
          {isStreaming && (
            <Badge variant="green">
              <Loader2 className="size-3 animate-spin" /> Generating…
            </Badge>
          )}
        </div>

        {/* Section navigation */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <Button
            size="icon-sm"
            variant="ghost"
            disabled={!prevKey}
            onClick={() => prevKey && onSectionChange(prevKey)}
            title="Previous section"
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            disabled={!nextKey}
            onClick={() => nextKey && onSectionChange(nextKey)}
            title="Next section"
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>

      {/* Section Instructions Panel */}
      {!isStreaming && hasContent && (
        <SectionInstructionsPanel
          projectId={projectId}
          sectionKey={activeSection}
          initialValue={sectionInstructions?.[activeSection] || ""}
          onSaved={onInstructionSaved}
        />
      )}

      {/* Content area */}
      <div className="flex-1 min-h-0 flex flex-col">
        {/* Streaming skeleton */}
        {isStreaming && !hasContent && (
          <div className="rounded-xl border border-brand-200 bg-brand-50/20 p-6 space-y-3 animate-pulse">
            {[90, 75, 85, 60, 70, 50].map((w, i) => (
              <div
                key={i}
                className="h-3 bg-brand-100 rounded"
                style={{ width: `${w}%` }}
              />
            ))}
          </div>
        )}

        {/* No content yet */}
        {!hasContent && !isStreaming && (
          <div className="flex-1 flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/20 py-16">
            <p className="text-sm text-muted-foreground mb-3">
              This section hasn't been generated yet
            </p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => regenerateSection(activeSection)}
              loading={regenerating === activeSection}
            >
              <RefreshCw className="size-3.5" /> Generate section
            </Button>
          </div>
        )}

        {/* Content */}
        {hasContent && !isStreaming && (
          <>
            {isEditing ? (
              <div className="flex-1 flex flex-col gap-3">
                {/* Edit / Preview toggle */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPreviewMode((v) => !v)}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground px-2.5 py-1.5 rounded-lg border border-border hover:bg-muted transition-colors"
                  >
                    {previewMode ? (
                      <>
                        <Edit3 className="size-3" /> Edit
                      </>
                    ) : (
                      <>
                        <Eye className="size-3" /> Preview
                      </>
                    )}
                  </button>
                  <span className="text-[11px] text-muted-foreground">
                    Editing: {SECTION_TITLES[activeSection]}
                  </span>
                </div>

                {previewMode ? (
                  <div className="flex-1 border border-border rounded-xl px-6 py-5 bg-card overflow-y-auto">
                    <MarkdownRenderer content={editContentRef.current} />
                  </div>
                ) : (
                  <RichEditor
                    content={editContentRef.current}
                    onChange={(md) => {
                      editContentRef.current = md;
                      triggerAutosave();
                    }}
                    projectId={projectId}
                    placeholder={`Edit ${SECTION_TITLES[activeSection] || activeSection}…`}
                    className="flex-1"
                  />
                )}

                <ReportEditorFooter
                  wordCount={wordCount}
                  charCount={charCount}
                  sectionKey={activeSection}
                  lastSaved={lastSaved}
                  saving={autoSaving}
                />
              </div>
            ) : (
              <div className="flex-1 flex flex-col gap-4">
                {/* Read view */}
                <div className="flex-1 border border-border rounded-xl px-6 py-5 bg-card overflow-y-auto">
                  <MarkdownRenderer content={section!.content} />
                </div>

                {/* Action bar */}
                <div className="flex items-center gap-2 pt-1">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      editContentRef.current = section!.content;
                      setEditingSection(activeSection);
                    }}
                  >
                    <Edit3 className="size-3.5" /> Edit
                  </Button>
                  <RegenerateButton
                    sectionTitle={SECTION_TITLES[activeSection] || activeSection}
                    onRegenerate={async (oneTimeInstructions) => {
                      setRegenerating(activeSection);
                      try {
                        await fetch("/api/report/generate", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            projectId,
                            sectionsToGenerate: [activeSection],
                            oneTimeInstructions: oneTimeInstructions
                              ? { [activeSection]: oneTimeInstructions }
                              : undefined,
                          }),
                        });
                        const { data } = await supabase
                          .from("reports")
                          .select("*")
                          .eq("project_id", projectId)
                          .single();
                        if (data) onUpdate(data as Report);
                      } finally {
                        setRegenerating(null);
                      }
                    }}
                  />
                  {!section?.approved && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => approveSection(activeSection)}
                      className="ml-auto border-brand-300 text-brand-700 hover:bg-brand-50"
                    >
                      <CheckCircle className="size-3.5" /> Approve section
                    </Button>
                  )}
                  {section?.approved && (
                    <span className="ml-auto flex items-center gap-1.5 text-xs text-brand-700">
                      <CheckCircle className="size-3.5" /> Approved
                    </span>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
