"use client";

import { useState, useCallback, useRef } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  GripVertical,
  Trash2,
  Plus,
  RotateCcw,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  Send,
  X,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import type {
  QuestionnaireTemplate,
  Question,
  QuestionSection,
  PersonalisationDiff,
  QuestionType,
} from "@/types";

const TYPE_OPTIONS: { value: QuestionType; label: string }[] = [
  { value: "text", label: "Short text" },
  { value: "textarea", label: "Long text" },
  { value: "number", label: "Number" },
  { value: "boolean", label: "Yes / No" },
  { value: "select", label: "Single select" },
  { value: "multiselect", label: "Multi-select" },
  { value: "file_upload", label: "File upload" },
  { value: "gps", label: "GPS / Location" },
  { value: "date", label: "Date" },
];

type EditableQuestion = Question & {
  deleted?: boolean;
  ai_suggested?: boolean;
};
type SectionState = QuestionSection & { questions: EditableQuestion[] };

function buildSectionState(
  template: QuestionnaireTemplate,
  diff: PersonalisationDiff | null,
): SectionState[] {
  const sections = [...template.sections].sort((a, b) => a.order - b.order);
  return sections.map((sec) => {
    let qs: EditableQuestion[] = template.questions
      .filter((q) => q.section_id === sec.id)
      .sort((a, b) => a.order - b.order)
      .map((q) => ({
        ...q,
        ai_suggested: !!diff?.annotate?.[q.id],
        deleted: false,
      }));

    if (diff?.reorder) {
      for (const [qId, newOrder] of Object.entries(diff.reorder)) {
        const idx = qs.findIndex((q) => q.id === qId);
        if (idx !== -1) qs[idx] = { ...qs[idx], order: newOrder };
      }
      qs = [...qs].sort((a, b) => a.order - b.order);
    }

    if (diff?.add) {
      const additions = diff.add
        .filter((a) => a.section_id === sec.id)
        .map(
          (a, i) =>
            ({
              id: `ai_add_${sec.id}_${i}_${Date.now()}`,
              section_id: sec.id,
              label: a.label,
              type: a.type,
              required: a.required,
              order: qs.length + i + 1,
              ai_suggested: true,
              deleted: false,
              helper_text: a.reason,
            }) as EditableQuestion,
        );
      qs = [...qs, ...additions];
    }

    return { ...sec, questions: qs };
  });
}

interface Props {
  projectId: string;
  template: QuestionnaireTemplate;
  diff: PersonalisationDiff | null;
  round: number;
  onClose: () => void;
  onSent: () => void;
}

export function QuestionnairePreviewModal({
  projectId,
  template,
  diff,
  round,
  onClose,
  onSent,
}: Props) {
  const [sections, setSections] = useState<SectionState[]>(() =>
    buildSectionState(template, diff),
  );
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(
    new Set(template.sections.map((s) => s.id)),
  );
  const [addInputs, setAddInputs] = useState<
    Record<string, { label: string; type: QuestionType; required: boolean }>
  >({});
  const dragSrc = useRef<{ sectionId: string; qIdx: number } | null>(null);

  const totalActive = sections.reduce(
    (acc, s) => acc + s.questions.filter((q) => !q.deleted).length,
    0,
  );
  const aiAdded = sections.reduce(
    (acc, s) =>
      acc + s.questions.filter((q) => q.ai_suggested && !q.deleted).length,
    0,
  );

  function toggleSection(id: string) {
    setExpanded((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }

  function toggleDelete(sectionId: string, qIdx: number) {
    setSections((prev) =>
      prev.map((s) =>
        s.id !== sectionId
          ? s
          : {
              ...s,
              questions: s.questions.map((q, i) =>
                i === qIdx ? { ...q, deleted: !q.deleted } : q,
              ),
            },
      ),
    );
  }

  function handleDragStart(sectionId: string, qIdx: number) {
    dragSrc.current = { sectionId, qIdx };
  }

  function handleDrop(sectionId: string, targetIdx: number) {
    if (!dragSrc.current || dragSrc.current.sectionId !== sectionId) return;
    const { qIdx: srcIdx } = dragSrc.current;
    if (srcIdx === targetIdx) return;
    setSections((prev) =>
      prev.map((s) => {
        if (s.id !== sectionId) return s;
        const qs = [...s.questions];
        const [moved] = qs.splice(srcIdx, 1);
        qs.splice(targetIdx, 0, moved);
        return { ...s, questions: qs.map((q, i) => ({ ...q, order: i + 1 })) };
      }),
    );
    dragSrc.current = null;
  }

  function addQuestion(sectionId: string) {
    const input = addInputs[sectionId];
    if (!input?.label?.trim()) return;
    setSections((prev) =>
      prev.map((s) => {
        if (s.id !== sectionId) return s;
        const newQ: EditableQuestion = {
          id: `custom_${sectionId}_${Date.now()}`,
          section_id: sectionId,
          label: input.label.trim(),
          type: input.type || "text",
          required: input.required || false,
          order: s.questions.length + 1,
          deleted: false,
          ai_suggested: false,
        };
        return { ...s, questions: [...s.questions, newQ] };
      }),
    );
    setAddInputs((prev) => ({
      ...prev,
      [sectionId]: { label: "", type: "text", required: false },
    }));
  }

  function buildFinalTemplate(): QuestionnaireTemplate {
    const allQuestions = sections.flatMap((s) =>
      s.questions
        .filter((q) => !q.deleted)
        .map(
          (q) =>
            ({ ...q, deleted: undefined, ai_suggested: undefined }) as Question,
        ),
    );
    return {
      ...template,
      sections: sections.map((s) => ({
        id: s.id,
        title: s.title,
        description: s.description,
        order: s.order,
      })),
      questions: allQuestions,
    };
  }

  async function handleSend() {
    setSending(true);
    setError(null);
    try {
      const finalTemplate = buildFinalTemplate();
      const res = await fetch("/api/questionnaire/preview-send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, template: finalTemplate, round }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Send failed");
      onSent();
    } catch (e: any) {
      setError(e.message || "Failed to send questionnaire");
      setSending(false);
    }
  }

  return (
    <Sheet open onOpenChange={onClose}>
      <SheetContent side="right" className="w-full max-w-2xl flex flex-col p-0">
        <SheetHeader className="px-6 pt-6 pb-4 border-b border-border">
          <SheetTitle>Review questionnaire</SheetTitle>
          <SheetDescription className="flex items-center gap-3">
            <span>
              {totalActive} questions · {sections.length} sections
            </span>
            {aiAdded > 0 && (
              <Badge variant="purple">
                <Sparkles className="size-3" /> {aiAdded} AI-suggested
              </Badge>
            )}
          </SheetDescription>
          {diff?.covering_note && (
            <div className="flex items-start gap-2 bg-purple-50 border border-purple-200 rounded-lg px-3 py-2.5 mt-2 text-xs text-purple-800">
              <Sparkles className="size-3.5 flex-shrink-0 mt-0.5 text-purple-600" />
              {diff.covering_note}
            </div>
          )}
        </SheetHeader>

        {/* Instructions */}
        <div className="px-6 py-2.5 border-b border-border bg-muted/30">
          <p className="text-[11px] text-muted-foreground flex items-center gap-3 flex-wrap">
            <span className="flex items-center gap-1">
              <GripVertical className="size-3" /> Drag to reorder
            </span>
            <span className="flex items-center gap-1">
              <X className="size-3" /> Click × to remove
            </span>
            <span className="flex items-center gap-1">
              <RotateCcw className="size-3" /> ↩ to restore
            </span>
            <span className="flex items-center gap-1">
              <Plus className="size-3" /> Add questions below each section
            </span>
          </p>
        </div>

        {/* Sections */}
        <ScrollArea className="flex-1">
          <div className="px-6 py-4 space-y-3">
            {sections.map((sec) => {
              const activeQs = sec.questions.filter((q) => !q.deleted);
              const isExpanded = expanded.has(sec.id);

              return (
                <div
                  key={sec.id}
                  className="rounded-xl border border-border overflow-hidden"
                >
                  <button
                    onClick={() => toggleSection(sec.id)}
                    className="w-full flex items-center gap-3 px-4 py-3 bg-muted/40 hover:bg-muted/60 transition-colors text-left"
                  >
                    <span className="text-xs font-semibold text-foreground flex-1">
                      {sec.title}
                    </span>
                    <Badge variant="gray">{activeQs.length} questions</Badge>
                    {isExpanded ? (
                      <ChevronUp className="size-3.5 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="size-3.5 text-muted-foreground" />
                    )}
                  </button>

                  {isExpanded && (
                    <>
                      {sec.questions.map((q, qi) => (
                        <div
                          key={q.id}
                          draggable={!q.deleted}
                          onDragStart={() =>
                            !q.deleted && handleDragStart(sec.id, qi)
                          }
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={() => !q.deleted && handleDrop(sec.id, qi)}
                          className={`flex items-center gap-2.5 px-4 py-2.5 border-t border-border/50 group transition-colors ${
                            q.deleted
                              ? "opacity-40 bg-muted/20"
                              : "bg-card hover:bg-muted/10"
                          }`}
                        >
                          <GripVertical
                            className={`size-3.5 flex-shrink-0 ${q.deleted ? "text-muted-foreground/30" : "text-muted-foreground group-hover:text-foreground cursor-grab"}`}
                          />
                          <span className="text-[11px] text-muted-foreground w-5 text-right flex-shrink-0">
                            {q.deleted
                              ? "–"
                              : sec.questions.filter(
                                  (x, xi) => !x.deleted && xi <= qi,
                                ).length}
                          </span>
                          <span
                            className={`flex-1 text-xs ${q.deleted ? "line-through text-muted-foreground" : "text-foreground"}`}
                          >
                            {q.label}
                            {q.ai_suggested && !q.deleted && (
                              <span className="ml-1.5 text-[10px] text-purple-500 font-medium">
                                · AI
                              </span>
                            )}
                          </span>
                          <Badge
                            variant="gray"
                            className="text-[9px] flex-shrink-0"
                          >
                            {q.type}
                          </Badge>
                          {q.required && !q.deleted && (
                            <Badge
                              variant="red"
                              className="text-[9px] flex-shrink-0"
                            >
                              req
                            </Badge>
                          )}
                          <button
                            onClick={() => toggleDelete(sec.id, qi)}
                            className="flex-shrink-0 p-1 rounded text-muted-foreground/40 hover:text-foreground hover:bg-muted opacity-0 group-hover:opacity-100 transition-all"
                            title={q.deleted ? "Restore" : "Remove"}
                          >
                            {q.deleted ? (
                              <RotateCcw className="size-3" />
                            ) : (
                              <X className="size-3" />
                            )}
                          </button>
                        </div>
                      ))}

                      {/* Add question row */}
                      <div className="flex items-center gap-2 px-4 py-2.5 border-t border-dashed border-border/50 bg-muted/10">
                        <Plus className="size-3 text-muted-foreground flex-shrink-0" />
                        <input
                          value={addInputs[sec.id]?.label || ""}
                          onChange={(e) =>
                            setAddInputs((prev) => ({
                              ...prev,
                              [sec.id]: {
                                ...prev[sec.id],
                                label: e.target.value,
                                type: prev[sec.id]?.type || "text",
                                required: prev[sec.id]?.required || false,
                              },
                            }))
                          }
                          onKeyDown={(e) =>
                            e.key === "Enter" && addQuestion(sec.id)
                          }
                          placeholder="Add a custom question…"
                          className="flex-1 text-xs bg-transparent border-none outline-none placeholder:text-muted-foreground"
                        />
                        <select
                          value={addInputs[sec.id]?.type || "text"}
                          onChange={(e) =>
                            setAddInputs((prev) => ({
                              ...prev,
                              [sec.id]: {
                                ...prev[sec.id],
                                type: e.target.value as QuestionType,
                                label: prev[sec.id]?.label || "",
                                required: prev[sec.id]?.required || false,
                              },
                            }))
                          }
                          className="text-[11px] border border-border rounded px-1.5 py-1 bg-background text-muted-foreground focus:outline-none"
                        >
                          {TYPE_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                        <label className="flex items-center gap-1 text-[11px] text-muted-foreground cursor-pointer">
                          <input
                            type="checkbox"
                            checked={addInputs[sec.id]?.required || false}
                            onChange={(e) =>
                              setAddInputs((prev) => ({
                                ...prev,
                                [sec.id]: {
                                  ...prev[sec.id],
                                  required: e.target.checked,
                                  label: prev[sec.id]?.label || "",
                                  type: prev[sec.id]?.type || "text",
                                },
                              }))
                            }
                            className="rounded"
                          />
                          req
                        </label>
                        <button
                          onClick={() => addQuestion(sec.id)}
                          className="text-[11px] text-brand-700 font-medium hover:text-brand-800 px-2 py-1 rounded hover:bg-brand-50 transition-colors"
                        >
                          Add
                        </button>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </ScrollArea>

        {/* Footer */}
        <SheetFooter className="flex-col gap-3">
          {error && (
            <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/8 border border-destructive/20 rounded-lg px-3 py-2 w-full">
              <AlertCircle className="size-3.5 flex-shrink-0" />
              {error}
            </div>
          )}
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <CheckCircle2 className="size-3.5 text-brand-500" />
              {totalActive} questions ready
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={onClose}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleSend} loading={sending}>
                <Send className="size-3.5" /> Send to client
              </Button>
            </div>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
