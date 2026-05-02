'use client'
import { useState, useEffect, useCallback } from 'react'
import {
  Loader2, RefreshCw, Download, ChevronRight,
  FolderPlus, Calendar, FileText, Send, CheckCircle2,
  AlertTriangle, Sparkles, CreditCard, FileCheck,
  Zap, MessageSquare, Upload, BarChart3, BookOpen,
  TableProperties,
} from 'lucide-react'
import { formatDate } from '@/lib/utils'
import type { ProjectEvent, ProjectEventType, ProjectEventActor } from '@/types'

interface Props {
  projectId: string
}

interface EventMeta {
  icon: React.ElementType
  color: string
  iconColor: string
  tagLabel: string
  tagClass: string
}

const EVENT_META: Record<string, EventMeta> = {
  project_created:              { icon: FolderPlus,      color: 'bg-slate-100',   iconColor: 'text-slate-600',   tagLabel: 'System',     tagClass: 'bg-slate-100 text-slate-600' },
  call_scheduled:               { icon: Calendar,         color: 'bg-blue-50',     iconColor: 'text-blue-600',    tagLabel: 'System',     tagClass: 'bg-blue-50 text-blue-700' },
  call_completed:               { icon: CheckCircle2,     color: 'bg-blue-50',     iconColor: 'text-blue-600',    tagLabel: 'System',     tagClass: 'bg-blue-50 text-blue-700' },
  transcript_uploaded:          { icon: Upload,           color: 'bg-purple-50',   iconColor: 'text-purple-600',  tagLabel: 'AI',         tagClass: 'bg-purple-50 text-purple-700' },
  questionnaire_personalised:   { icon: Sparkles,         color: 'bg-purple-50',   iconColor: 'text-purple-600',  tagLabel: 'AI',         tagClass: 'bg-purple-50 text-purple-700' },
  questionnaire_sent:           { icon: Send,             color: 'bg-sky-50',      iconColor: 'text-sky-600',     tagLabel: 'Email',      tagClass: 'bg-sky-50 text-sky-700' },
  questionnaire_resent:         { icon: Send,             color: 'bg-sky-50',      iconColor: 'text-sky-600',     tagLabel: 'Email',      tagClass: 'bg-sky-50 text-sky-700' },
  client_submitted:             { icon: FileCheck,        color: 'bg-green-50',    iconColor: 'text-green-700',   tagLabel: 'Client',     tagClass: 'bg-green-50 text-green-700' },
  ai_gap_check:                 { icon: Zap,              color: 'bg-amber-50',    iconColor: 'text-amber-600',   tagLabel: 'AI',         tagClass: 'bg-amber-50 text-amber-700' },
  flag_actioned:                { icon: AlertTriangle,    color: 'bg-amber-50',    iconColor: 'text-amber-600',   tagLabel: 'Consultant', tagClass: 'bg-amber-50 text-amber-700' },
  follow_up_sent:               { icon: MessageSquare,    color: 'bg-sky-50',      iconColor: 'text-sky-600',     tagLabel: 'Email',      tagClass: 'bg-sky-50 text-sky-700' },
  financial_model_edited:       { icon: TableProperties,  color: 'bg-emerald-50',  iconColor: 'text-emerald-600', tagLabel: 'Consultant', tagClass: 'bg-emerald-50 text-emerald-700' },
  report_generated:             { icon: BarChart3,        color: 'bg-violet-50',   iconColor: 'text-violet-600',  tagLabel: 'AI',         tagClass: 'bg-violet-50 text-violet-700' },
  report_published:             { icon: FileText,         color: 'bg-red-50',      iconColor: 'text-red-600',     tagLabel: 'Report',     tagClass: 'bg-red-50 text-red-700' },
  payment_initiated:            { icon: CreditCard,       color: 'bg-yellow-50',   iconColor: 'text-yellow-600',  tagLabel: 'Payment',    tagClass: 'bg-yellow-50 text-yellow-700' },
  payment_received:             { icon: CreditCard,       color: 'bg-emerald-50',  iconColor: 'text-emerald-600', tagLabel: 'Payment',    tagClass: 'bg-emerald-50 text-emerald-700' },
  note_added:                   { icon: BookOpen,         color: 'bg-slate-50',    iconColor: 'text-slate-600',   tagLabel: 'System',     tagClass: 'bg-slate-100 text-slate-600' },
}

const FALLBACK_META: EventMeta = {
  icon: BookOpen, color: 'bg-slate-50', iconColor: 'text-slate-600',
  tagLabel: 'System', tagClass: 'bg-slate-100 text-slate-600',
}

const DOT_COLORS: Record<string, string> = {
  project_created: '#64748b',
  call_scheduled: '#2563eb', call_completed: '#2563eb',
  transcript_uploaded: '#7c3aed', questionnaire_personalised: '#7c3aed',
  questionnaire_sent: '#0284c7', questionnaire_resent: '#0284c7',
  client_submitted: '#16a34a',
  ai_gap_check: '#d97706', flag_actioned: '#d97706',
  follow_up_sent: '#0284c7',
  financial_model_edited: '#059669',
  report_generated: '#7c3aed', report_published: '#dc2626',
  payment_initiated: '#ca8a04', payment_received: '#059669',
  note_added: '#64748b',
}

const FILTER_GROUPS = [
  { label: 'All', types: null },
  { label: 'AI actions', types: ['transcript_uploaded','questionnaire_personalised','ai_gap_check','report_generated'] },
  { label: 'Emails', types: ['questionnaire_sent','questionnaire_resent','follow_up_sent','report_published'] },
  { label: 'Client', types: ['client_submitted'] },
  { label: 'Financial', types: ['financial_model_edited'] },
  { label: 'Payments', types: ['payment_initiated','payment_received'] },
  { label: 'Report', types: ['report_generated','report_published'] },
]

function formatEventTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

function groupByDay(events: ProjectEvent[]): { day: string; events: ProjectEvent[] }[] {
  const map = new Map<string, ProjectEvent[]>()
  for (const ev of events) {
    const d = new Date(ev.created_at)
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(today.getDate() - 1)
    let label: string
    if (d.toDateString() === today.toDateString()) label = 'Today'
    else if (d.toDateString() === yesterday.toDateString()) label = 'Yesterday'
    else label = formatDate(ev.created_at)
    if (!map.has(label)) map.set(label, [])
    map.get(label)!.push(ev)
  }
  return Array.from(map.entries()).map(([day, events]) => ({ day, events }))
}

function renderMetadata(metadata: Record<string, unknown>): string | null {
  if (!metadata || Object.keys(metadata).length === 0) return null
  const lines: string[] = []
  for (const [k, v] of Object.entries(metadata)) {
    if (v === null || v === undefined) continue
    const key = k.replace(/_/g, ' ')
    if (Array.isArray(v)) lines.push(`${key}: ${v.join(', ')}`)
    else if (typeof v === 'boolean') lines.push(`${key}: ${v ? 'Yes' : 'No'}`)
    else if (typeof v === 'number') lines.push(`${key}: ${v.toLocaleString()}`)
    else lines.push(`${key}: ${v}`)
  }
  return lines.join('\n')
}

function exportLogAsCsv(events: ProjectEvent[], projectId: string) {
  const rows = [
    ['Timestamp', 'Event Type', 'Actor', 'Title', 'Detail'],
    ...events.map(e => [
      new Date(e.created_at).toISOString(),
      e.event_type, e.actor, e.title, e.detail || '',
    ])
  ]
  const csv = rows.map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `project-${projectId}-log.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export function LogTab({ projectId }: Props) {
  const [events, setEvents] = useState<ProjectEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [activeFilter, setActiveFilter] = useState('All')
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  const loadEvents = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/events`)
      if (res.ok) setEvents(await res.json())
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => { loadEvents() }, [loadEvents])

  function toggleExpand(id: string) {
    setExpandedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const filteredEvents = events.filter(ev => {
    if (activeFilter === 'All') return true
    const group = FILTER_GROUPS.find(g => g.label === activeFilter)
    if (!group?.types) return true
    return group.types.includes(ev.event_type)
  })

  const grouped = groupByDay(filteredEvents)

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Project activity log</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {events.length} event{events.length !== 1 ? 's' : ''} · full chronological history
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={loadEvents} disabled={loading}
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors disabled:opacity-50">
            <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
          {events.length > 0 && (
            <button onClick={() => exportLogAsCsv(events, projectId)}
              className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors">
              <Download className="w-3 h-3" /> Export CSV
            </button>
          )}
        </div>
      </div>

      {/* Filter pills */}
      <div className="flex flex-wrap gap-1.5">
        {FILTER_GROUPS.map(g => {
          const count = g.types ? events.filter(e => g.types!.includes(e.event_type)).length : events.length
          return (
            <button key={g.label} onClick={() => setActiveFilter(g.label)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                activeFilter === g.label
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:text-slate-800'
              }`}>
              {g.label}
              {g.label !== 'All' && count > 0 && (
                <span className="ml-1 opacity-60">{count}</span>
              )}
            </button>
          )
        })}
      </div>

      {/* Timeline */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
        </div>
      ) : events.length === 0 ? (
        <div className="bg-white border border-dashed border-slate-300 rounded-xl p-12 text-center">
          <BarChart3 className="w-8 h-8 text-slate-200 mx-auto mb-3" />
          <p className="text-sm font-medium text-slate-600">No activity yet</p>
          <p className="text-xs text-slate-400 mt-1">Events will appear here as work progresses on this project.</p>
        </div>
      ) : filteredEvents.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-8 text-center">
          <p className="text-sm text-slate-500">No events match this filter.</p>
        </div>
      ) : (
        <div className="relative pl-7">
          {/* Vertical line */}
          <div className="absolute left-2.5 top-0 bottom-4 w-px bg-slate-200" />

          {grouped.map(({ day, events: dayEvents }) => (
            <div key={day}>
              {/* Day divider */}
              <div className="flex items-center gap-3 mb-3 mt-4 first:mt-0">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider ml-2">{day}</span>
                <div className="flex-1 h-px bg-slate-100" />
              </div>

              {dayEvents.map(ev => {
                const meta = EVENT_META[ev.event_type] || FALLBACK_META
                const Icon = meta.icon
                const isExpanded = expandedIds.has(ev.id)
                const dotColor = DOT_COLORS[ev.event_type] || '#64748b'
                const metaStr = renderMetadata(ev.metadata || {})

                return (
                  <div key={ev.id} className="relative mb-2">
                    {/* Dot */}
                    <div
                      className="absolute -left-[18px] top-3.5 w-2.5 h-2.5 rounded-full border-2 border-white z-10"
                      style={{ background: dotColor }}
                    />

                    <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 hover:border-slate-300 transition-colors">
                      <div className="flex items-start gap-3">
                        {/* Icon */}
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${meta.color}`}>
                          <Icon className={`w-3.5 h-3.5 ${meta.iconColor}`} />
                        </div>

                        {/* Body */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-900 leading-snug">{ev.title}</p>
                          {ev.detail && <p className="text-xs text-slate-500 mt-0.5">{ev.detail}</p>}
                          {metaStr && (
                            <button onClick={() => toggleExpand(ev.id)}
                              className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-600 mt-1.5 transition-colors">
                              <ChevronRight className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                              Details
                            </button>
                          )}
                          {isExpanded && metaStr && (
                            <pre className="mt-2 text-[11px] text-slate-600 bg-slate-50 border border-slate-100 rounded-lg px-3 py-2 whitespace-pre-wrap leading-relaxed font-sans">
                              {metaStr}
                            </pre>
                          )}
                        </div>

                        {/* Time + tag */}
                        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                          <span className="text-[11px] text-slate-400 whitespace-nowrap">
                            {formatEventTime(ev.created_at)}
                          </span>
                          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${meta.tagClass}`}>
                            {meta.tagLabel}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
