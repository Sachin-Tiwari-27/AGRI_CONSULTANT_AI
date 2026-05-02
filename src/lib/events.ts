import type { SupabaseClient } from '@supabase/supabase-js'
import type { ProjectEventType, ProjectEventActor } from '@/types'

interface EventPayload {
  projectId: string
  eventType: ProjectEventType
  actor?: ProjectEventActor
  title: string
  detail?: string
  metadata?: Record<string, unknown>
}

/**
 * Insert a project_event row.
 * Fails silently — never throws, so it never blocks the main action.
 */
export async function logProjectEvent(
  supabase: SupabaseClient,
  payload: EventPayload,
): Promise<void> {
  try {
    await supabase.from('project_events').insert({
      project_id: payload.projectId,
      event_type: payload.eventType,
      actor: payload.actor ?? 'system',
      title: payload.title,
      detail: payload.detail ?? null,
      metadata: payload.metadata ?? {},
    })
  } catch (err) {
    console.error('[logProjectEvent] Failed to insert event:', err)
  }
}

/**
 * Insert a questionnaire_send_log row.
 * Fails silently.
 */
export async function logQuestionnaireSend(
  supabase: SupabaseClient,
  payload: {
    projectId: string
    submissionId: string | null
    round: number
    recipient: string
    sentBy: string | null
    isResend: boolean
  },
): Promise<void> {
  try {
    await supabase.from('questionnaire_send_log').insert({
      project_id: payload.projectId,
      submission_id: payload.submissionId,
      round: payload.round,
      recipient: payload.recipient,
      sent_by: payload.sentBy,
      is_resend: payload.isResend,
    })
  } catch (err) {
    console.error('[logQuestionnaireSend] Failed to insert log:', err)
  }
}
