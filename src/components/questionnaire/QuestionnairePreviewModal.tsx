'use client'
import { useState, useCallback, useRef } from 'react'
import { Button } from '@/components/ui/Button'
import {
  X, Send, GripVertical, Trash2, Plus, RotateCcw,
  Sparkles, AlertCircle, CheckCircle2, ChevronDown, ChevronUp,
} from 'lucide-react'
import type { QuestionnaireTemplate, Question, QuestionSection, PersonalisationDiff, QuestionType } from '@/types'

interface Props {
  projectId: string
  template: QuestionnaireTemplate
  diff: PersonalisationDiff | null
  round: number
  onClose: () => void
  onSent: () => void
}

const TYPE_OPTIONS: { value: QuestionType; label: string }[] = [
  { value: 'text', label: 'Short text' },
  { value: 'textarea', label: 'Long text' },
  { value: 'number', label: 'Number' },
  { value: 'boolean', label: 'Yes / No' },
  { value: 'select', label: 'Single select' },
  { value: 'multiselect', label: 'Multi-select' },
  { value: 'file_upload', label: 'File upload' },
  { value: 'gps', label: 'GPS / Location' },
  { value: 'date', label: 'Date' },
]

type EditableQuestion = Question & { deleted?: boolean; ai_suggested?: boolean }
type SectionState = QuestionSection & { questions: EditableQuestion[] }

function buildSectionState(template: QuestionnaireTemplate, diff: PersonalisationDiff | null): SectionState[] {
  const sections = [...template.sections].sort((a, b) => a.order - b.order)
  return sections.map(sec => {
    let qs: EditableQuestion[] = template.questions
      .filter(q => q.section_id === sec.id)
      .sort((a, b) => a.order - b.order)
      .map(q => ({
        ...q,
        ai_suggested: !!(diff?.annotate?.[q.id]),
        deleted: false,
      }))

    // Apply AI reorder suggestions
    if (diff?.reorder) {
      for (const [qId, newOrder] of Object.entries(diff.reorder)) {
        const idx = qs.findIndex(q => q.id === qId)
        if (idx !== -1) qs[idx] = { ...qs[idx], order: newOrder }
      }
      qs = [...qs].sort((a, b) => a.order - b.order)
    }

    // Append AI-added questions for this section
    if (diff?.add) {
      const additions = diff.add
        .filter(a => a.section_id === sec.id)
        .map((a, i) => ({
          id: `ai_add_${sec.id}_${i}_${Date.now()}`,
          section_id: sec.id,
          label: a.label,
          type: a.type,
          required: a.required,
          order: qs.length + i + 1,
          ai_suggested: true,
          deleted: false,
          helper_text: a.reason,
        } as EditableQuestion))
      qs = [...qs, ...additions]
    }

    return { ...sec, questions: qs }
  })
}

export function QuestionnairePreviewModal({ projectId, template, diff, round, onClose, onSent }: Props) {
  const [sections, setSections] = useState<SectionState[]>(() => buildSectionState(template, diff))
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(template.sections.map(s => s.id))
  )
  const [addInputs, setAddInputs] = useState<Record<string, { label: string; type: QuestionType; required: boolean }>>({})

  const dragSrc = useRef<{ sectionId: string; qIdx: number } | null>(null)

  const totalActive = sections.reduce((acc, s) => acc + s.questions.filter(q => !q.deleted).length, 0)
  const aiAddedCount = sections.reduce((acc, s) => acc + s.questions.filter(q => q.ai_suggested && !q.deleted).length, 0)

  function toggleSection(id: string) {
    setExpandedSections(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleDelete(sectionId: string, qIdx: number) {
    setSections(prev => prev.map(s =>
      s.id !== sectionId ? s : {
        ...s,
        questions: s.questions.map((q, i) =>
          i === qIdx ? { ...q, deleted: !q.deleted } : q
        )
      }
    ))
  }

  function handleDragStart(sectionId: string, qIdx: number) {
    dragSrc.current = { sectionId, qIdx }
  }

  function handleDrop(sectionId: string, targetIdx: number) {
    if (!dragSrc.current || dragSrc.current.sectionId !== sectionId) return
    const { qIdx: srcIdx } = dragSrc.current
    if (srcIdx === targetIdx) return

    setSections(prev => prev.map(s => {
      if (s.id !== sectionId) return s
      const qs = [...s.questions]
      const [moved] = qs.splice(srcIdx, 1)
      qs.splice(targetIdx, 0, moved)
      return { ...s, questions: qs.map((q, i) => ({ ...q, order: i + 1 })) }
    }))
    dragSrc.current = null
  }

  function addQuestion(sectionId: string) {
    const input = addInputs[sectionId]
    if (!input?.label?.trim()) return

    setSections(prev => prev.map(s => {
      if (s.id !== sectionId) return s
      const newQ: EditableQuestion = {
        id: `custom_${sectionId}_${Date.now()}`,
        section_id: sectionId,
        label: input.label.trim(),
        type: input.type || 'text',
        required: input.required || false,
        order: s.questions.length + 1,
        deleted: false,
        ai_suggested: false,
      }
      return { ...s, questions: [...s.questions, newQ] }
    }))

    setAddInputs(prev => ({ ...prev, [sectionId]: { label: '', type: 'text', required: false } }))
  }

  function buildFinalTemplate(): QuestionnaireTemplate {
    const allQuestions = sections.flatMap(s =>
      s.questions
        .filter(q => !q.deleted)
        .map(q => ({
          ...q,
          deleted: undefined,
          ai_suggested: undefined,
        } as Question))
    )
    return { ...template, sections: sections.map(s => ({ id: s.id, title: s.title, description: s.description, order: s.order })), questions: allQuestions }
  }

  async function handleSend() {
    setSending(true)
    setError(null)
    try {
      const finalTemplate = buildFinalTemplate()
      const res = await fetch('/api/questionnaire/preview-send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, template: finalTemplate, round }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Send failed')
      onSent()
    } catch (e: any) {
      setError(e.message || 'Failed to send questionnaire')
      setSending(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col">

        {/* Header */}
        <div className="flex items-start justify-between px-6 py-4 border-b border-slate-100 flex-shrink-0">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Review questionnaire before sending</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {totalActive} questions across {sections.length} sections
              {aiAddedCount > 0 && (
                <span className="ml-2 inline-flex items-center gap-1 text-purple-600 font-medium">
                  <Sparkles className="w-3 h-3" /> {aiAddedCount} AI-suggested
                </span>
              )}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* AI covering note */}
        {diff?.covering_note && (
          <div className="mx-6 mt-4 flex items-start gap-2.5 bg-purple-50 border border-purple-200 rounded-xl p-3 flex-shrink-0">
            <Sparkles className="w-4 h-4 text-purple-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-purple-800">{diff.covering_note}</p>
          </div>
        )}

        {/* Instructions */}
        <div className="mx-6 mt-3 flex items-center gap-2 text-xs text-slate-500 flex-shrink-0">
          <GripVertical className="w-3.5 h-3.5" />
          <span>Drag to reorder within a section</span>
          <span className="mx-1">·</span>
          <Trash2 className="w-3 h-3" />
          <span>Click ✕ to remove · ↩ to restore</span>
          <span className="mx-1">·</span>
          <Plus className="w-3 h-3" />
          <span>Add custom questions below each section</span>
        </div>

        {/* Sections */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
          {sections.map(sec => {
            const activeQs = sec.questions.filter(q => !q.deleted)
            const isExpanded = expandedSections.has(sec.id)

            return (
              <div key={sec.id} className="border border-slate-200 rounded-xl overflow-hidden">
                {/* Section header */}
                <button
                  onClick={() => toggleSection(sec.id)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 bg-slate-50 hover:bg-slate-100 transition-colors text-left"
                >
                  <span className="text-xs font-semibold text-slate-700 flex-1">{sec.title}</span>
                  <span className="text-xs text-slate-400 bg-white border border-slate-200 rounded-full px-2 py-0.5">
                    {activeQs.length} questions
                  </span>
                  {isExpanded
                    ? <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
                    : <ChevronDown className="w-3.5 h-3.5 text-slate-400" />}
                </button>

                {isExpanded && (
                  <>
                    {/* Question rows */}
                    {sec.questions.map((q, qi) => (
                      <div
                        key={q.id}
                        draggable={!q.deleted}
                        onDragStart={() => !q.deleted && handleDragStart(sec.id, qi)}
                        onDragOver={e => { e.preventDefault() }}
                        onDrop={() => !q.deleted && handleDrop(sec.id, qi)}
                        className={`flex items-center gap-2.5 px-4 py-2.5 border-t border-slate-100 group transition-colors ${
                          q.deleted ? 'opacity-40 bg-slate-50' : 'bg-white hover:bg-slate-50/60'
                        }`}
                      >
                        {/* Drag handle */}
                        <GripVertical className={`w-3.5 h-3.5 flex-shrink-0 ${q.deleted ? 'text-slate-200' : 'text-slate-300 group-hover:text-slate-500 cursor-grab active:cursor-grabbing'}`} />

                        {/* Number */}
                        <span className="text-xs text-slate-400 w-5 text-right flex-shrink-0">
                          {q.deleted ? '–' : sec.questions.filter((x, xi) => !x.deleted && xi <= qi).length}
                        </span>

                        {/* Label */}
                        <span className={`flex-1 text-sm ${q.deleted ? 'line-through text-slate-400' : 'text-slate-800'}`}>
                          {q.label}
                          {q.ai_suggested && !q.deleted && (
                            <span className="ml-1.5 text-[10px] font-medium text-purple-600">· AI suggested</span>
                          )}
                        </span>

                        {/* Type badge */}
                        <span className="text-[10px] text-slate-400 bg-slate-100 rounded px-1.5 py-0.5 flex-shrink-0">{q.type}</span>

                        {/* Required badge */}
                        {q.required && !q.deleted && (
                          <span className="text-[10px] font-medium text-red-600 bg-red-50 rounded px-1.5 py-0.5 flex-shrink-0">req</span>
                        )}

                        {/* Delete / restore */}
                        <button
                          onClick={() => toggleDelete(sec.id, qi)}
                          className="flex-shrink-0 p-1 rounded text-slate-300 hover:text-slate-600 hover:bg-slate-100 transition-colors opacity-0 group-hover:opacity-100"
                          title={q.deleted ? 'Restore' : 'Remove'}
                        >
                          {q.deleted ? <RotateCcw className="w-3 h-3" /> : <X className="w-3 h-3" />}
                        </button>
                      </div>
                    ))}

                    {/* Add question row */}
                    <div className="flex items-center gap-2 px-4 py-2.5 border-t border-dashed border-slate-200 bg-slate-50/40">
                      <Plus className="w-3 h-3 text-slate-400 flex-shrink-0" />
                      <input
                        value={addInputs[sec.id]?.label || ''}
                        onChange={e => setAddInputs(prev => ({ ...prev, [sec.id]: { ...prev[sec.id], label: e.target.value, type: prev[sec.id]?.type || 'text', required: prev[sec.id]?.required || false } }))}
                        onKeyDown={e => e.key === 'Enter' && addQuestion(sec.id)}
                        placeholder="Add a custom question…"
                        className="flex-1 text-sm bg-transparent border-none outline-none placeholder:text-slate-400"
                      />
                      <select
                        value={addInputs[sec.id]?.type || 'text'}
                        onChange={e => setAddInputs(prev => ({ ...prev, [sec.id]: { ...prev[sec.id], type: e.target.value as QuestionType, label: prev[sec.id]?.label || '', required: prev[sec.id]?.required || false } }))}
                        className="text-xs border border-slate-200 rounded px-1.5 py-1 bg-white text-slate-600 focus:outline-none"
                      >
                        {TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                      <label className="flex items-center gap-1 text-xs text-slate-500 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={addInputs[sec.id]?.required || false}
                          onChange={e => setAddInputs(prev => ({ ...prev, [sec.id]: { ...prev[sec.id], required: e.target.checked, label: prev[sec.id]?.label || '', type: prev[sec.id]?.type || 'text' } }))}
                          className="rounded"
                        />
                        req
                      </label>
                      <button
                        onClick={() => addQuestion(sec.id)}
                        className="text-xs text-green-700 font-medium hover:text-green-800 px-2 py-1 rounded hover:bg-green-50 transition-colors"
                      >
                        Add
                      </button>
                    </div>
                  </>
                )}
              </div>
            )
          })}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 flex-shrink-0 bg-slate-50/60 rounded-b-2xl">
          {error ? (
            <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          ) : (
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
              {totalActive} questions ready · client receives a personalised link
            </div>
          )}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
            <Button size="sm" onClick={handleSend} loading={sending}>
              <Send className="w-3.5 h-3.5" />
              Send to client
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
