"use client";

// ── src/components/report-formats/ReportFormatEditorModal.tsx ────────────────
import { useState, useCallback } from "react";
import {
  X,
  Plus,
  GripVertical,
  Trash2,
  Wand2,
  Check,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  Eye,
  Settings2,
  FileText,
  Loader2,
  Save,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { toast } from "@/components/ui/toast";
import { PromptReviewModal } from "./PromptReviewModal";
import { ExcerptConfigPanel } from "./ExcerptConfigPanel";
import type {
  ReportFormat,
  ReportFormatSection,
  SectionType,
  GenerationPhase,
} from "@/types/report-format";

interface Props {
  format: ReportFormat;
  onClose: () => void;
  onSaved: (format: ReportFormat) => void;
}

const SECTION_TYPE_OPTIONS = [
  { value: "content", label: "Content — general narrative" },
  { value: "financial", label: "Financial — numbers & tables" },
  { value: "market", label: "Market — analysis & research" },
  { value: "risk", label: "Risk — mitigation & scenarios" },
  { value: "technical", label: "Technical — engineering & specs" },
  { value: "operational", label: "Operational — timelines, QA, CSR" },
  { value: "custom", label: "Custom — consultant-defined" },
];

const PHASE_OPTIONS = [
  { value: "1", label: "Phase 1 — Foundation (early, sequential)" },
  { value: "2", label: "Phase 2 — Analysis (parallel)" },
  { value: "3", label: "Phase 3 — Business & Revenue (sequential)" },
  { value: "4", label: "Phase 4 — Risk, Benefits, CSR (parallel)" },
  { value: "5", label: "Phase 5 — Timelines (parallel)" },
  { value: "6", label: "Phase 6 — LAST (synthesises everything)" },
];

const TYPE_BADGE_VARIANT: Record<string, any> = {
  content: "gray",
  financial: "green",
  market: "blue",
  risk: "amber",
  technical: "purple",
  operational: "violet",
  custom: "orange",
};

function generateKey(title: string, existing: string[]): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 40);
  let key = `custom_${base}`;
  let i = 2;
  while (existing.includes(key)) {
    key = `custom_${base}_${i++}`;
  }
  return key;
}

export function ReportFormatEditorModal({ format, onClose, onSaved }: Props) {
  const [name, setName] = useState(format.name);
  const [description, setDescription] = useState(format.description ?? "");
  const [sections, setSections] = useState<ReportFormatSection[]>(
    (format.sections ?? []).map((s, i) => ({ ...s, number: i + 1 })),
  );
  const [excerptKeys, setExcerptKeys] = useState<string[]>(
    format.excerpt_section_keys ?? [],
  );
  const [excerptWordLimit, setExcerptWordLimit] = useState(
    format.excerpt_word_limit ?? 300,
  );
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [generatingPromptFor, setGeneratingPromptFor] = useState<string | null>(
    null,
  );
  const [promptReview, setPromptReview] = useState<{
    sectionKey: string;
    prompt: string;
  } | null>(null);
  const [activeTab, setActiveTab] = useState<"sections" | "excerpt">(
    "sections",
  );

  // Drag state
  const [dragSrc, setDragSrc] = useState<number | null>(null);

  const confirmedCount = sections.filter((s) => s.prompt_confirmed).length;
  const allConfirmed =
    sections.length > 0 && confirmedCount === sections.length;

  function updateSection(key: string, patch: Partial<ReportFormatSection>) {
    setSections((prev) =>
      prev.map((s) => (s.key === key ? { ...s, ...patch } : s)),
    );
  }

  function addSection() {
    const existingKeys = sections.map((s) => s.key);
    const newSection: ReportFormatSection = {
      key: generateKey("new section", existingKeys),
      number: sections.length + 1,
      title: `${sections.length + 1}. New Section`,
      description: "",
      section_type: "content",
      word_count_target: 400,
      has_placeholders: false,
      generation_phase: 3,
      max_tokens: 2000,
      prompt_hint: "",
      ai_generated_prompt: null,
      prompt_confirmed: false,
      is_financial: false,
      is_excerpt_default: false,
      builtin_ai_task: null,
    };
    setSections((prev) => [...prev, newSection]);
    setExpandedKey(newSection.key);
  }

  function removeSection(key: string) {
    setSections((prev) =>
      prev
        .filter((s) => s.key !== key)
        .map((s, i) => ({ ...s, number: i + 1 })),
    );
    setExcerptKeys((prev) => prev.filter((k) => k !== key));
    if (expandedKey === key) setExpandedKey(null);
  }

  function handleDrop(targetIdx: number) {
    if (dragSrc === null || dragSrc === targetIdx) return;
    const reordered = [...sections];
    const [moved] = reordered.splice(dragSrc, 1);
    reordered.splice(targetIdx, 0, moved);
    setSections(reordered.map((s, i) => ({ ...s, number: i + 1 })));
    setDragSrc(null);
  }

  async function generatePrompt(section: ReportFormatSection) {
    if (!section.prompt_hint?.trim()) {
      toast.error(
        "Add a prompt hint first — describe what this section should cover.",
      );
      return;
    }
    setGeneratingPromptFor(section.key);
    try {
      const res = await fetch(
        `/api/report-formats/${format.id}/generate-prompt`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ section }),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Generation failed");

      // Show prompt in review modal
      setPromptReview({ sectionKey: section.key, prompt: data.prompt });
    } catch (e: any) {
      toast.error(e.message || "Failed to generate prompt");
    } finally {
      setGeneratingPromptFor(null);
    }
  }

  function handlePromptConfirmed(sectionKey: string, prompt: string) {
    updateSection(sectionKey, {
      ai_generated_prompt: prompt,
      prompt_confirmed: true,
    });
    setPromptReview(null);
    toast.success("Prompt saved and confirmed");
  }

  async function handleSave() {
    if (!name.trim()) {
      toast.error("Format name is required");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/report-formats/${format.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          sections,
          excerpt_section_keys: excerptKeys,
          excerpt_word_limit: excerptWordLimit,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      onSaved(data);
    } catch (e: any) {
      toast.error(e.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      {promptReview && (
        <PromptReviewModal
          sectionKey={promptReview.sectionKey}
          sectionTitle={
            sections.find((s) => s.key === promptReview.sectionKey)?.title ?? ""
          }
          initialPrompt={promptReview.prompt}
          onConfirm={handlePromptConfirmed}
          onClose={() => setPromptReview(null)}
        />
      )}

      {/* Full-screen overlay */}
      <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-stretch justify-end">
        <div className="w-full max-w-3xl bg-background flex flex-col h-full shadow-2xl border-l border-border">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
            <div className="min-w-0 flex-1 mr-4">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="text-base font-semibold text-foreground bg-transparent border-none outline-none w-full focus:ring-0 p-0"
                placeholder="Format name"
              />
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="text-xs text-muted-foreground bg-transparent border-none outline-none w-full focus:ring-0 p-0 mt-0.5"
                placeholder="Optional description"
              />
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {!allConfirmed && (
                <span className="text-[11px] text-amber-600 font-medium">
                  {sections.length - confirmedCount} prompts need review
                </span>
              )}
              <Button size="sm" onClick={handleSave} loading={saving}>
                <Save className="size-3.5" /> Save
              </Button>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground"
              >
                <X className="size-4" />
              </button>
            </div>
          </div>

          {/* Tab nav */}
          <div className="flex gap-0 border-b border-border px-6 flex-shrink-0">
            {(["sections", "excerpt"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 h-10 text-xs font-medium border-b-2 transition-colors capitalize ${
                  activeTab === tab
                    ? "border-brand-800 text-brand-800"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab === "sections"
                  ? `Sections (${sections.length})`
                  : "Excerpt config"}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            {activeTab === "sections" && (
              <div className="px-6 py-4 space-y-2">
                {/* Instructions */}
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground mb-3">
                  <GripVertical className="size-3" /> Drag to reorder
                  <span className="mx-1">·</span>
                  <Wand2 className="size-3" /> Generate AI prompt from hint
                  <span className="mx-1">·</span>
                  <CheckCircle2 className="size-3 text-brand-500" /> Confirm
                  before generating report
                </div>

                {sections.map((section, idx) => (
                  <SectionRow
                    key={section.key}
                    section={section}
                    index={idx}
                    isExpanded={expandedKey === section.key}
                    isGenerating={generatingPromptFor === section.key}
                    onToggle={() =>
                      setExpandedKey(
                        expandedKey === section.key ? null : section.key,
                      )
                    }
                    onUpdate={(patch) => updateSection(section.key, patch)}
                    onRemove={() => removeSection(section.key)}
                    onGeneratePrompt={() => generatePrompt(section)}
                    onDragStart={() => setDragSrc(idx)}
                    onDrop={() => handleDrop(idx)}
                  />
                ))}

                <button
                  onClick={addSection}
                  className="w-full flex items-center gap-2 px-4 py-3 rounded-xl border border-dashed border-border text-xs text-muted-foreground hover:border-brand-300 hover:text-brand-700 hover:bg-brand-50/30 transition-colors"
                >
                  <Plus className="size-3.5" /> Add section
                </button>
              </div>
            )}

            {activeTab === "excerpt" && (
              <ExcerptConfigPanel
                sections={sections}
                excerptKeys={excerptKeys}
                excerptWordLimit={excerptWordLimit}
                onExcerptKeysChange={setExcerptKeys}
                onWordLimitChange={setExcerptWordLimit}
              />
            )}
          </div>
        </div>
      </div>
    </>
  );
}

// ── Section row component ─────────────────────────────────────────────────────

interface SectionRowProps {
  section: ReportFormatSection;
  index: number;
  isExpanded: boolean;
  isGenerating: boolean;
  onToggle: () => void;
  onUpdate: (patch: Partial<ReportFormatSection>) => void;
  onRemove: () => void;
  onGeneratePrompt: () => void;
  onDragStart: () => void;
  onDrop: () => void;
}

function SectionRow({
  section,
  index,
  isExpanded,
  isGenerating,
  onToggle,
  onUpdate,
  onRemove,
  onGeneratePrompt,
  onDragStart,
  onDrop,
}: SectionRowProps) {
  const hasPrompt = !!(section.ai_generated_prompt || section.builtin_ai_task);
  const needsPrompt = !section.prompt_confirmed;

  return (
    <div
      className={`rounded-xl border transition-colors ${
        isExpanded
          ? "border-brand-200 bg-brand-50/20"
          : needsPrompt
            ? "border-amber-200 bg-amber-50/10"
            : "border-border bg-card"
      }`}
      draggable
      onDragStart={onDragStart}
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
    >
      {/* Row header */}
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer"
        onClick={onToggle}
      >
        <GripVertical className="size-3.5 text-muted-foreground/40 cursor-grab flex-shrink-0" />
        <span className="text-[11px] text-muted-foreground w-5 text-right flex-shrink-0">
          {index + 1}
        </span>

        {/* Status icon */}
        <div className="flex-shrink-0">
          {section.prompt_confirmed ? (
            <CheckCircle2 className="size-3.5 text-brand-500" />
          ) : section.prompt_hint ? (
            <AlertCircle className="size-3.5 text-amber-500" />
          ) : (
            <div className="size-3.5 rounded-full border-2 border-border" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-foreground truncate">
            {section.title}
          </p>
          {section.description && !isExpanded && (
            <p className="text-[10px] text-muted-foreground truncate mt-0.5">
              {section.description}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <Badge
            variant={TYPE_BADGE_VARIANT[section.section_type] || "gray"}
            className="text-[9px] py-0"
          >
            {section.section_type}
          </Badge>
          <span className="text-[10px] text-muted-foreground">
            {section.word_count_target}w
          </span>
          {!section.builtin_ai_task && section.prompt_confirmed && (
            <Badge variant="purple" className="text-[9px] py-0">
              <Sparkles className="size-2.5" /> Custom
            </Badge>
          )}
          {isExpanded ? (
            <ChevronUp className="size-3.5 text-muted-foreground" />
          ) : (
            <ChevronDown className="size-3.5 text-muted-foreground" />
          )}
        </div>
      </div>

      {/* Expanded edit form */}
      {isExpanded && (
        <div
          className="px-4 pb-4 space-y-4 border-t border-border/50 pt-4"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Title + description */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-medium text-muted-foreground block mb-1">
                Section title *
              </label>
              <Input
                value={section.title}
                onChange={(e) => onUpdate({ title: e.target.value })}
                className="h-8 text-xs"
              />
            </div>
            <div>
              <label className="text-[10px] font-medium text-muted-foreground block mb-1">
                Description (sidebar)
              </label>
              <Input
                value={section.description}
                onChange={(e) => onUpdate({ description: e.target.value })}
                className="h-8 text-xs"
                placeholder="One-line summary"
              />
            </div>
          </div>

          {/* Type + Phase + Word count + Max tokens */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-medium text-muted-foreground block mb-1">
                Section type
              </label>
              <Select
                value={section.section_type}
                onChange={(e) =>
                  onUpdate({ section_type: e.target.value as SectionType })
                }
                options={SECTION_TYPE_OPTIONS}
                className="h-8 text-xs"
              />
            </div>
            <div>
              <label className="text-[10px] font-medium text-muted-foreground block mb-1">
                Generation phase
              </label>
              <Select
                value={String(section.generation_phase)}
                onChange={(e) =>
                  onUpdate({
                    generation_phase: Number(e.target.value) as GenerationPhase,
                  })
                }
                options={PHASE_OPTIONS}
                className="h-8 text-xs"
              />
            </div>
            <div>
              <label className="text-[10px] font-medium text-muted-foreground block mb-1">
                Word count target
              </label>
              <Input
                type="number"
                value={section.word_count_target}
                onChange={(e) =>
                  onUpdate({ word_count_target: Number(e.target.value) })
                }
                className="h-8 text-xs"
                min={50}
                step={50}
              />
            </div>
            <div>
              <label className="text-[10px] font-medium text-muted-foreground block mb-1">
                Max AI tokens
              </label>
              <Input
                type="number"
                value={section.max_tokens}
                onChange={(e) =>
                  onUpdate({ max_tokens: Number(e.target.value) })
                }
                className="h-8 text-xs"
                min={500}
                step={500}
              />
            </div>
          </div>

          {/* Toggles */}
          <div className="flex flex-wrap gap-4">
            {[
              {
                key: "is_financial",
                label: "Financial section",
                hint: "Contains numbers from the financial model",
              },
              {
                key: "has_placeholders",
                label: "Has placeholders",
                hint: "Section contains ⬡ PLACEHOLDER blocks",
              },
              {
                key: "is_excerpt_default",
                label: "Include in excerpt by default",
                hint: "Pre-selected when configuring excerpt report",
              },
            ].map(({ key, label, hint }) => (
              <label
                key={key}
                className="flex items-start gap-2 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={(section as any)[key]}
                  onChange={(e) => onUpdate({ [key]: e.target.checked })}
                  className="mt-0.5 rounded"
                />
                <div>
                  <p className="text-xs font-medium text-foreground">{label}</p>
                  <p className="text-[10px] text-muted-foreground">{hint}</p>
                </div>
              </label>
            ))}
          </div>

          {/* Prompt hint */}
          <div>
            <label className="text-[10px] font-medium text-muted-foreground block mb-1">
              Prompt hint{" "}
              <span className="text-muted-foreground/60">
                — plain text describing what this section should cover
              </span>
            </label>
            <Textarea
              value={section.prompt_hint}
              onChange={(e) =>
                onUpdate({
                  prompt_hint: e.target.value,
                  prompt_confirmed: false,
                })
              }
              placeholder="e.g. Cover the project's environmental impact, water efficiency vs conventional farming, and alignment with the country's sustainability goals. Include a comparison table."
              className="min-h-[80px] text-xs"
            />
          </div>

          {/* Prompt status + actions */}
          <div className="rounded-lg border border-border bg-muted/30 p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <p className="text-xs font-medium text-foreground">
                  AI Prompt Template
                </p>
                {section.prompt_confirmed ? (
                  <Badge variant="green" className="text-[9px] py-0">
                    <Check className="size-2.5" /> Confirmed
                  </Badge>
                ) : section.ai_generated_prompt ? (
                  <Badge variant="amber" className="text-[9px] py-0">
                    Needs review
                  </Badge>
                ) : section.builtin_ai_task ? (
                  <Badge variant="blue" className="text-[9px] py-0">
                    Using built-in
                  </Badge>
                ) : (
                  <Badge variant="gray" className="text-[9px] py-0">
                    Not generated
                  </Badge>
                )}
              </div>

              <div className="flex items-center gap-2">
                {section.builtin_ai_task && !section.ai_generated_prompt && (
                  <span className="text-[10px] text-muted-foreground">
                    Using default prompt for{" "}
                    <code className="bg-muted px-1 rounded">
                      {section.builtin_ai_task}
                    </code>
                  </span>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onGeneratePrompt}
                  loading={isGenerating}
                  disabled={!section.prompt_hint?.trim()}
                >
                  <Wand2 className="size-3" />
                  {section.ai_generated_prompt
                    ? "Regenerate prompt"
                    : "Generate prompt"}
                </Button>
              </div>
            </div>

            {section.ai_generated_prompt && (
              <pre className="text-[10px] text-muted-foreground bg-muted rounded px-3 py-2 max-h-28 overflow-y-auto whitespace-pre-wrap font-sans leading-relaxed">
                {section.ai_generated_prompt.slice(0, 300)}
                {section.ai_generated_prompt.length > 300 && "…"}
              </pre>
            )}
          </div>

          {/* Delete */}
          {!section.builtin_ai_task && (
            <div className="flex justify-end">
              <Button
                size="sm"
                variant="ghost"
                onClick={onRemove}
                className="text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="size-3.5" /> Remove section
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
