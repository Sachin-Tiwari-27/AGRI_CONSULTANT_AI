'use client'
import { useState } from 'react'
import type { ChangeEvent } from 'react'
import { Button } from '@/components/ui/Button'
import { Input, Textarea, Select } from '@/components/ui/FormFields'
import { CheckCircle, Upload, Leaf } from 'lucide-react'
import type { QuestionnaireTemplate, QuestionnaireSubmission, Question } from '@/types'
type UploadedFileRef = {
  question_id: string
  filename: string
  path: string
  url?: string | null
  size: number
  mime_type: string
}

interface Props {
  submission: QuestionnaireSubmission
  template: QuestionnaireTemplate
}

export function ClientQuestionnaireForm({ submission, template }: Props) {
  const [answers, setAnswers] = useState<Record<string, unknown>>(submission.answers || {})
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [currentSection, setCurrentSection] = useState(0)
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFileRef[]>(
    (submission.uploaded_files || []).map(file => ({
      question_id: file.question_id,
      filename: file.filename,
      path: file.url,
      url: file.url,
      size: file.size,
      mime_type: file.mime_type,
    }))
  )
  const [uploadingQuestionId, setUploadingQuestionId] = useState<string | null>(null)

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
    setSubmitting(true)
    try {
      const res = await fetch(`/api/questionnaire/${submission.token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers, uploaded_files: uploadedFiles }),
      })
      if (!res.ok) throw new Error('Submission failed')
      setSubmitted(true)
    } catch {
      alert('Submission failed. Please try again.')
    } finally {
      setSubmitting(false)
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

        {/* Questions */}
        <div className="space-y-5">
          {sectionQuestions.map(q => (
            <QuestionField
              key={q.id}
              question={q}
              value={answers[q.id]}
              onChange={v => setAnswer(q.id, v)}
              questionnaireToken={submission.token}
              onFileUploaded={(file) => {
                setUploadedFiles(prev => {
                  const remaining = prev.filter(f => f.question_id !== file.question_id)
                  return [...remaining, file]
                })
                setAnswer(q.id, {
                  file_path: file.path,
                  filename: file.filename,
                  size: file.size,
                  mime_type: file.mime_type,
                })
              }}
              uploading={uploadingQuestionId === q.id}
              setUploading={(uploading) => setUploadingQuestionId(uploading ? q.id : null)}
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
              loading={submitting}
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
  question,
  value,
  onChange,
  questionnaireToken,
  onFileUploaded,
  uploading,
  setUploading,
}: {
  question: Question
  value: unknown
  onChange: (v: unknown) => void
  questionnaireToken: string
  onFileUploaded: (file: UploadedFileRef) => void
  uploading: boolean
  setUploading: (uploading: boolean) => void
}) {
  async function uploadFile(file: File) {
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('question_id', question.id)
      const res = await fetch(`/api/questionnaire/${questionnaireToken}/upload`, {
        method: 'POST',
        body: formData,
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Upload failed')
      onFileUploaded(data.file as UploadedFileRef)
    } catch {
      alert('File upload failed. Please try again.')
    } finally {
      setUploading(false)
    }
  }

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
          <span className="text-sm text-slate-600">{uploading ? 'Uploading...' : 'Click to upload file'}</span>
          <span className="text-xs text-slate-400">PDF, JPG, PNG up to 10MB</span>
          <input
            type="file"
            className="hidden"
            disabled={uploading}
            onChange={async e => {
              const file = e.target.files?.[0]
              if (file) await uploadFile(file)
            }}
          />
          {value && typeof value === 'object' && (value as { filename?: string }).filename ? (
            <span className="text-xs text-green-700 font-medium">
              ✓ {String((value as { filename: string }).filename)}
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
            onChange: (e: ChangeEvent<HTMLSelectElement>) => onChange(e.target.value),
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
