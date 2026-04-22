'use client'
import { useRef, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Input, Textarea, Select } from '@/components/ui/FormFields'
import { CheckCircle, Upload, Leaf } from 'lucide-react'
import type { QuestionnaireTemplate, QuestionnaireSubmission, Question } from '@/types'
import { AsyncFeedback } from '@/components/ui/AsyncFeedback'

interface Props {
  submission: QuestionnaireSubmission
  template: QuestionnaireTemplate
}

export function ClientQuestionnaireForm({ submission, template }: Props) {
  const [answers, setAnswers] = useState<Record<string, unknown>>(submission.answers || {})
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [submitMessage, setSubmitMessage] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [currentSection, setCurrentSection] = useState(0)
  const feedbackRef = useRef<HTMLDivElement>(null)

  const sections = template.sections.sort((a, b) => a.order - b.order)
  const section = sections[currentSection]
  const sectionQuestions = template.questions
    .filter(q => q.section_id === section?.id)
    .filter(q => isVisible(q, answers))
    .sort((a, b) => a.order - b.order)

  function isVisible(q: Question, ans: Record<string, unknown>): boolean {
    if (!q.conditions?.length) return true
    return q.conditions.every(c => {
      const val = ans[c.question_id]
      if (c.operator === 'equals') return val === c.value
      if (c.operator === 'is_true') return val === true || val === 'true'
      if (c.operator === 'contains') return Array.isArray(val) ? val.includes(c.value) : false
      return true
    })
  }

  function setAnswer(questionId: string, value: unknown) {
    setAnswers(prev => ({ ...prev, [questionId]: value }))
  }

  async function submitAnswers() {
    setSubmitStatus('loading')
    setSubmitMessage(null)
    try {
      const res = await fetch(`/api/questionnaire/${submission.token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers }),
      })
      if (!res.ok) throw new Error('Submission failed')
      setSubmitStatus('success')
      setSubmitMessage('Answers submitted successfully. Thank you for completing the questionnaire.')
      setSubmitted(true)
    } catch {
      setSubmitStatus('error')
      setSubmitMessage('Submission failed. Please review your answers and try again.')
      setTimeout(() => feedbackRef.current?.focus(), 0)
    }
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-green-700" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Thank you!</h1>
          <p className="text-slate-600">Your answers have been submitted. Your consultant will be in touch shortly.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-2xl mx-auto px-4 py-5 flex items-center gap-3">
          <div className="w-8 h-8 bg-green-800 rounded-lg flex items-center justify-center">
            <Leaf className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-green-900">AgriAI Platform</p>
            <p className="text-xs text-slate-500">{template.name}</p>
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-slate-200">
        <div
          className="h-full bg-green-700 transition-all duration-300"
          style={{ width: `${((currentSection + 1) / sections.length) * 100}%` }}
        />
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Section header */}
        <div className="mb-6">
          <p className="text-xs font-medium text-green-700 uppercase tracking-wide mb-1">
            Section {currentSection + 1} of {sections.length}
          </p>
          <h2 className="text-xl font-bold text-slate-900">{section?.title}</h2>
          {section?.description && (
            <p className="text-sm text-slate-600 mt-1">{section.description}</p>
          )}
        </div>
        <div aria-live="polite" className="sr-only">{submitMessage || ''}</div>
        {submitMessage && !submitted && (
          <div
            ref={feedbackRef}
            tabIndex={-1}
            className="mb-4 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 rounded-lg"
          >
            <AsyncFeedback message={submitMessage} tone={submitStatus === 'error' ? 'error' : 'success'} />
          </div>
        )}

        {/* Questions */}
        <div className="space-y-5">
          {sectionQuestions.map(q => (
            <QuestionField
              key={q.id}
              question={q}
              value={answers[q.id]}
              onChange={v => setAnswer(q.id, v)}
            />
          ))}
        </div>

        {/* Navigation */}
        <div className="flex gap-3 mt-8">
          {currentSection > 0 && (
            <Button
              variant="outline"
              onClick={() => setCurrentSection(s => s - 1)}
              className="flex-1"
            >
              Back
            </Button>
          )}
          {currentSection < sections.length - 1 ? (
            <Button
              onClick={() => setCurrentSection(s => s + 1)}
              className="flex-1"
            >
              Continue →
            </Button>
          ) : (
            <Button
              onClick={submitAnswers}
              loading={submitStatus === 'loading'}
              disabled={submitStatus === 'loading'}
              className="flex-1"
            >
              Submit answers
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Individual question renderer ──────────────────────────────────────
function QuestionField({
  question, value, onChange
}: {
  question: Question
  value: unknown
  onChange: (v: unknown) => void
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <label className="block text-sm font-semibold text-slate-900 mb-1">
        {question.label}
        {question.required && <span className="text-red-500 ml-1">*</span>}
      </label>
      {question.helper_text && (
        <p className="text-xs text-slate-500 mb-3">{question.helper_text}</p>
      )}

      {question.type === 'text' && (
        <Input
          value={(value as string) || ''}
          onChange={e => onChange(e.target.value)}
          placeholder={question.placeholder}
        />
      )}

      {question.type === 'textarea' && (
        <Textarea
          value={(value as string) || ''}
          onChange={e => onChange(e.target.value)}
          placeholder={question.placeholder}
        />
      )}

      {question.type === 'number' && (
        <Input
          type="number"
          value={(value as string) || ''}
          onChange={e => onChange(e.target.value)}
          placeholder={question.placeholder}
        />
      )}

      {question.type === 'boolean' && (
        <div className="flex gap-3">
          {['Yes', 'No'].map(opt => (
            <button
              key={opt}
              type="button"
              onClick={() => onChange(opt === 'Yes')}
              className={`flex-1 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                value === (opt === 'Yes')
                  ? 'bg-green-800 text-white border-green-800'
                  : 'bg-white text-slate-700 border-slate-300 hover:border-green-400'
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
      )}

      {question.type === 'select' && (
        <div className="space-y-2">
          {question.options?.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              className={`w-full text-left px-4 py-3 rounded-lg border text-sm transition-colors ${
                value === opt.value
                  ? 'bg-green-50 border-green-600 text-green-800 font-medium'
                  : 'bg-white border-slate-200 text-slate-700 hover:border-slate-400'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}

      {question.type === 'multiselect' && (
        <div className="flex flex-wrap gap-2">
          {question.options?.map(opt => {
            const selected = Array.isArray(value) && (value as string[]).includes(opt.value)
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  const current = Array.isArray(value) ? (value as string[]) : []
                  onChange(selected ? current.filter(v => v !== opt.value) : [...current, opt.value])
                }}
                className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                  selected
                    ? 'bg-green-800 text-white border-green-800'
                    : 'bg-white text-slate-600 border-slate-300 hover:border-green-400'
                }`}
              >
                {opt.label}
              </button>
            )
          })}
        </div>
      )}

      {question.type === 'file_upload' && (
        <label className="flex flex-col items-center gap-2 p-6 border-2 border-dashed border-slate-300 rounded-lg cursor-pointer hover:border-green-400 transition-colors">
          <Upload className="w-6 h-6 text-slate-400" />
          <span className="text-sm text-slate-600">Click to upload file</span>
          <span className="text-xs text-slate-400">PDF, JPG, PNG up to 10MB</span>
          <input
            type="file"
            className="hidden"
            onChange={e => {
              const file = e.target.files?.[0]
              if (file) onChange({ name: file.name, size: file.size })
            }}
          />
          {value && typeof value === 'object' && (value as { name?: string }).name ? (
            <span className="text-xs text-green-700 font-medium">
              ✓ {String((value as { name: string }).name)}
            </span>
          ) : null}
        </label>
      )}

      {question.type === 'gps' && (
        <Input
          value={(value as string) || ''}
          onChange={e => onChange(e.target.value)}
          placeholder="Paste Google Maps link or enter lat, lon"
        />
      )}

      {question.type === 'currency' && (
        <Select
          {...{
            value: (value as string) || 'OMR',
            onChange: (e: { target: { value: string } }) => onChange(e.target.value),
            options: [
              { value: 'OMR', label: 'OMR - Omani Rial' },
              { value: 'USD', label: 'USD - US Dollar' },
              { value: 'AED', label: 'AED - UAE Dirham' },
              { value: 'SAR', label: 'SAR - Saudi Riyal' },
              { value: 'QAR', label: 'QAR - Qatari Riyal' },
              { value: 'KWD', label: 'KWD - Kuwaiti Dinar' },
              { value: 'BHD', label: 'BHD - Bahraini Dinar' },
            ]
          }}
        />
      )}
    </div>
  )
}
