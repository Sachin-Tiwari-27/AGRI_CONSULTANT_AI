'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Card, CardBody, CardHeader, CardFooter } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Card'
import { ReportEditor } from '@/components/report/ReportEditor'
import {
  Video, Send, Zap, FileText, CheckCircle,
  AlertTriangle, ExternalLink, Calendar, MapPin,
  Wheat, Users, DollarSign, Clock
} from 'lucide-react'
import { formatDate, formatCurrency } from '@/lib/utils'
import type { Project, Report, AIFlag } from '@/types'

interface Props {
  project: Project & {
    questionnaire_submissions: Array<{
      id: string; round: number; submitted_at: string | null; token: string
    }>
    ai_flags: AIFlag[]
  }
  report: Report | null
  userId: string
}

export function ProjectWorkspace({ project: initial, report: initialReport, userId }: Props) {
  const [project, setProject] = useState(initial)
  const [report, setReport] = useState(initialReport)
  const [activeTab, setActiveTab] = useState<'overview' | 'questionnaire' | 'analysis' | 'report'>('overview')
  const [loading, setLoading] = useState<string | null>(null)
  const [flags, setFlags] = useState<AIFlag[]>(initial.ai_flags || [])

  const submissions = project.questionnaire_submissions || []
  const latestSubmission = submissions.filter(s => s.submitted_at).sort((a, b) =>
    new Date(b.submitted_at!).getTime() - new Date(a.submitted_at!).getTime()
  )[0]
  const pendingFlags = flags.filter(f => f.status === 'pending')

  async function sendQuestionnaire() {
    setLoading('send_q')
    try {
      // Use the default template — in production, let consultant choose
      const res = await fetch('/api/questionnaire/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: project.id, templateId: null, round: 1 }),
      })
      if (!res.ok) throw new Error('Failed')
      setProject(p => ({ ...p, status: 'questionnaire_sent' }))
      alert('Questionnaire sent to ' + project.client_email)
    } catch { alert('Failed to send questionnaire') }
    finally { setLoading(null) }
  }

  async function runClarificationCheck() {
    if (!latestSubmission) return
    setLoading('clarify')
    try {
      const res = await fetch('/api/ai/clarify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: project.id, submissionId: latestSubmission.id }),
      })
      const data = await res.json()
      setFlags(data.flags || [])
      setActiveTab('questionnaire')
    } catch { alert('Clarification check failed') }
    finally { setLoading(null) }
  }

  async function generateReport() {
    setLoading('report')
    try {
      await fetch('/api/report/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: project.id }),
      })
      // Reload report from server
      const res = await fetch(`/api/projects/${project.id}`)
      const updated = await res.json()
      if (updated.reports?.[0]) setReport(updated.reports[0])
      setProject(p => ({ ...p, status: 'report_draft' }))
      setActiveTab('report')
    } catch { alert('Report generation failed') }
    finally { setLoading(null) }
  }

  async function acceptFlag(flagId: string) {
    setFlags(f => f.map(x => x.id === flagId ? { ...x, status: 'accepted' } : x))
  }

  async function dismissFlag(flagId: string) {
    setFlags(f => f.map(x => x.id === flagId ? { ...x, status: 'dismissed' } : x))
  }

  const TABS: { id: 'overview' | 'questionnaire' | 'analysis' | 'report'; label: string; badge?: number }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'questionnaire', label: 'Questionnaire', badge: pendingFlags.length || undefined },
    { id: 'analysis', label: 'Analysis' },
    { id: 'report', label: 'Report' },
  ]

  return (
    <div className="px-8 py-6">
      {/* Tab bar */}
      <div className="flex gap-1 border-b border-slate-200 mb-6">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 text-sm font-medium rounded-t-lg border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === tab.id
                ? 'border-green-700 text-green-800'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab.label}
            {tab.badge ? (
              <span className="bg-amber-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
                {tab.badge}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW TAB ──────────────────────────────────────── */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-3 gap-5">
          {/* Left: project details */}
          <div className="col-span-2 space-y-4">
            {/* Pipeline */}
            <Card>
              <CardHeader>
                <h3 className="font-semibold text-slate-900 text-sm">Project pipeline</h3>
              </CardHeader>
              <CardBody className="py-4">
                <div className="flex items-center gap-2">
                  {[
                    { key: 'call', label: '1. Call', done: ['call_completed','questionnaire_sent','questionnaire_submitted','analysis_running','report_draft','report_published','completed'].includes(project.status) },
                    { key: 'q',    label: '2. Questionnaire', done: ['questionnaire_submitted','analysis_running','report_draft','report_published','completed'].includes(project.status) },
                    { key: 'ai',   label: '3. Analysis', done: ['report_draft','report_published','completed'].includes(project.status) },
                    { key: 'rep',  label: '4. Report', done: ['report_published','completed'].includes(project.status) },
                    { key: 'pay',  label: '5. Delivered', done: project.status === 'completed' },
                  ].map((step, i, arr) => (
                    <div key={step.key} className="flex items-center gap-2 flex-1">
                      <div className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full ${
                        step.done ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-500'
                      }`}>
                        {step.done && <CheckCircle className="w-3 h-3" />}
                        {step.label}
                      </div>
                      {i < arr.length - 1 && <div className="flex-1 h-px bg-slate-200" />}
                    </div>
                  ))}
                </div>
              </CardBody>
            </Card>

            {/* Actions */}
            <Card>
              <CardHeader>
                <h3 className="font-semibold text-slate-900 text-sm">Actions</h3>
              </CardHeader>
              <CardBody className="space-y-3">
                {/* Schedule call */}
                {project.meet_link ? (
                  <a href={project.meet_link} target="_blank" rel="noreferrer"
                    className="flex items-center gap-3 p-3 rounded-lg bg-blue-50 border border-blue-200 hover:bg-blue-100 transition-colors">
                    <Video className="w-4 h-4 text-blue-700" />
                    <div>
                      <p className="text-sm font-medium text-blue-800">Open Google Meet</p>
                      {project.meet_scheduled_at && (
                        <p className="text-xs text-blue-600">{formatDate(project.meet_scheduled_at)}</p>
                      )}
                    </div>
                    <ExternalLink className="w-3.5 h-3.5 text-blue-500 ml-auto" />
                  </a>
                ) : (
                  <ScheduleCallCard projectId={project.id} onScheduled={link =>
                    setProject(p => ({ ...p, meet_link: link, status: 'call_scheduled' }))
                  } />
                )}

                {/* Send questionnaire */}
                <div className="flex items-center justify-between p-3 rounded-lg border border-slate-200">
                  <div className="flex items-center gap-3">
                    <Send className="w-4 h-4 text-slate-500" />
                    <div>
                      <p className="text-sm font-medium text-slate-800">Send questionnaire</p>
                      <p className="text-xs text-slate-500">
                        {latestSubmission
                          ? `Submitted ${formatDate(latestSubmission.submitted_at!)}`
                          : submissions.length > 0 ? 'Sent — awaiting response' : 'Not sent yet'}
                      </p>
                    </div>
                  </div>
                  <Button size="sm" variant="secondary" onClick={sendQuestionnaire} loading={loading === 'send_q'}
                    disabled={!!latestSubmission}>
                    Send
                  </Button>
                </div>

                {/* AI clarification */}
                {latestSubmission && (
                  <div className="flex items-center justify-between p-3 rounded-lg border border-slate-200">
                    <div className="flex items-center gap-3">
                      <Zap className="w-4 h-4 text-purple-500" />
                      <div>
                        <p className="text-sm font-medium text-slate-800">Run AI gap check</p>
                        <p className="text-xs text-slate-500">
                          {flags.length > 0 ? `${pendingFlags.length} gaps pending review` : 'Check questionnaire for missing data'}
                        </p>
                      </div>
                    </div>
                    <Button size="sm" variant="secondary" onClick={runClarificationCheck} loading={loading === 'clarify'}>
                      Run
                    </Button>
                  </div>
                )}

                {/* Generate report */}
                {latestSubmission && (
                  <div className="flex items-center justify-between p-3 rounded-lg border border-slate-200">
                    <div className="flex items-center gap-3">
                      <FileText className="w-4 h-4 text-green-600" />
                      <div>
                        <p className="text-sm font-medium text-slate-800">Generate feasibility report</p>
                        <p className="text-xs text-slate-500">
                          {report ? 'Report exists — regenerate sections' : 'AI-draft all sections from project data'}
                        </p>
                      </div>
                    </div>
                    <Button size="sm" onClick={generateReport} loading={loading === 'report'}>
                      Generate
                    </Button>
                  </div>
                )}
              </CardBody>
            </Card>
          </div>

          {/* Right: project info */}
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <h3 className="font-semibold text-slate-900 text-sm">Project details</h3>
              </CardHeader>
              <CardBody className="space-y-3">
                {[
                  { icon: Users, label: 'Client', value: project.client_name },
                  { icon: MapPin, label: 'Location', value: project.region ? `${project.region}, ${project.country}` : '—' },
                  { icon: Wheat, label: 'Crops', value: project.crop_types?.join(', ') || '—' },
                  { icon: DollarSign, label: 'Budget', value: project.budget_range || '—' },
                  { icon: Clock, label: 'Created', value: formatDate(project.created_at) },
                ].map(({ icon: Icon, label, value }) => (
                  <div key={label} className="flex items-start gap-3">
                    <Icon className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs text-slate-500">{label}</p>
                      <p className="text-sm text-slate-800">{value}</p>
                    </div>
                  </div>
                ))}
              </CardBody>
            </Card>

            {project.consultant_notes && (
              <Card>
                <CardHeader>
                  <h3 className="font-semibold text-slate-900 text-sm">Call notes</h3>
                </CardHeader>
                <CardBody>
                  <p className="text-sm text-slate-600 whitespace-pre-wrap">{project.consultant_notes}</p>
                </CardBody>
              </Card>
            )}
          </div>
        </div>
      )}

      {/* ── QUESTIONNAIRE TAB ─────────────────────────────────── */}
      {activeTab === 'questionnaire' && (
        <div className="max-w-2xl space-y-4">
          {submissions.length === 0 ? (
            <Card>
              <CardBody className="text-center py-12">
                <p className="text-slate-500 text-sm">No questionnaire sent yet.</p>
                <Button className="mt-4" onClick={sendQuestionnaire} loading={loading === 'send_q'}>
                  Send questionnaire
                </Button>
              </CardBody>
            </Card>
          ) : (
            <>
              {submissions.map(s => (
                <Card key={s.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm text-slate-900">
                          {s.round === 1 ? 'Initial questionnaire' : `Follow-up (round ${s.round})`}
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {s.submitted_at
                            ? `Submitted ${formatDate(s.submitted_at)}`
                            : 'Awaiting response'}
                        </p>
                      </div>
                      <Badge variant={s.submitted_at ? 'green' : 'amber'}>
                        {s.submitted_at ? 'Submitted' : 'Pending'}
                      </Badge>
                    </div>
                  </CardHeader>
                  {s.submitted_at && (
                    <CardFooter>
                      <a
                        href={`/q/${s.token}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-green-700 hover:underline flex items-center gap-1"
                      >
                        <ExternalLink className="w-3 h-3" /> View client portal
                      </a>
                    </CardFooter>
                  )}
                </Card>
              ))}

              {/* AI flags */}
              {flags.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-500" />
                    AI gap flags ({pendingFlags.length} pending)
                  </h3>
                  <div className="space-y-2">
                    {flags.map(flag => (
                      <Card key={flag.id}>
                        <CardBody className="py-3">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                                  {flag.field_name}
                                </span>
                                <Badge variant={flag.severity === 'required' ? 'red' : 'amber'}>
                                  {flag.severity}
                                </Badge>
                                {flag.status !== 'pending' && (
                                  <Badge variant={flag.status === 'accepted' ? 'green' : 'gray'}>
                                    {flag.status}
                                  </Badge>
                                )}
                              </div>
                              <p className="text-sm text-slate-700">{flag.reason}</p>
                              <p className="text-xs text-slate-500 mt-1 italic">
                                Suggested: "{flag.suggested_question}"
                              </p>
                            </div>
                            {flag.status === 'pending' && (
                              <div className="flex gap-2 flex-shrink-0">
                                <Button size="sm" variant="secondary" onClick={() => acceptFlag(flag.id)}>Accept</Button>
                                <Button size="sm" variant="ghost" onClick={() => dismissFlag(flag.id)}>Dismiss</Button>
                              </div>
                            )}
                          </div>
                        </CardBody>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── ANALYSIS TAB ──────────────────────────────────────── */}
      {activeTab === 'analysis' && (
        <div className="max-w-2xl space-y-4">
          {!latestSubmission ? (
            <Card>
              <CardBody className="text-center py-12">
                <p className="text-slate-500 text-sm">Questionnaire must be submitted before analysis.</p>
              </CardBody>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <h3 className="font-semibold text-slate-900 text-sm">AI analysis</h3>
              </CardHeader>
              <CardBody className="space-y-4">
                <p className="text-sm text-slate-600">
                  The analysis engine runs automatically when you generate the report. It covers
                  technical feasibility, climate risk, financial projections, and live market research.
                </p>
                <Button onClick={generateReport} loading={loading === 'report'}>
                  <Zap className="w-4 h-4" /> Run analysis &amp; generate report
                </Button>
              </CardBody>
            </Card>
          )}
        </div>
      )}

      {/* ── REPORT TAB ────────────────────────────────────────── */}
      {activeTab === 'report' && (
        <div className="max-w-3xl">
          {!report ? (
            <Card>
              <CardBody className="text-center py-12">
                <FileText className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-600 text-sm font-medium">No report yet</p>
                <p className="text-slate-400 text-xs mt-1">
                  {latestSubmission
                    ? 'Click "Generate" in the overview tab to create the AI draft.'
                    : 'Send and receive the questionnaire first.'}
                </p>
              </CardBody>
            </Card>
          ) : (
            <ReportEditor
              report={report}
              projectId={project.id}
              onUpdate={setReport}
            />
          )}
        </div>
      )}
    </div>
  )
}

// ── Inline schedule call card ─────────────────────────────────────────
function ScheduleCallCard({
  projectId,
  onScheduled,
}: {
  projectId: string
  onScheduled: (link: string) => void
}) {
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [loading, setLoading] = useState(false)

  async function schedule() {
    if (!date || !time) return
    setLoading(true)
    try {
      const scheduledAt = new Date(`${date}T${time}:00`).toISOString()
      const res = await fetch('/api/calendar/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, scheduledAt }),
      })
      const data = await res.json()
      if (data.error === 'google_not_connected') {
        window.location.href = '/login'
        return
      }
      if (data.meetLink) onScheduled(data.meetLink)
    } catch { alert('Failed to schedule') }
    finally { setLoading(false) }
  }

  return (
    <div className="p-3 rounded-lg border border-slate-200">
      <div className="flex items-center gap-3 mb-3">
        <Calendar className="w-4 h-4 text-slate-500" />
        <p className="text-sm font-medium text-slate-800">Schedule intro call (Google Meet)</p>
      </div>
      <div className="flex gap-2">
        <input
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
          className="flex-1 px-3 py-1.5 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-green-500"
        />
        <input
          type="time"
          value={time}
          onChange={e => setTime(e.target.value)}
          className="w-28 px-3 py-1.5 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-green-500"
        />
        <Button size="sm" onClick={schedule} loading={loading} disabled={!date || !time}>
          Schedule
        </Button>
      </div>
    </div>
  )
}
