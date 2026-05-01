import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { sendQuestionnaireInvite } from '@/lib/email.service'
import { logProjectEvent, logQuestionnaireSend } from '@/lib/events'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { projectId, templateId, round = 1 } = await req.json()

  const { data: project } = await supabase
    .from('projects').select('*').eq('id', projectId).single()

  if (!project || project.consultant_id !== user.id)
    return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: profile } = await supabase
    .from('profiles').select('full_name, company_name').eq('id', user.id).single()

  const { data: existing } = await supabase
    .from('questionnaire_submissions')
    .select('*')
    .eq('project_id', projectId)
    .eq('round', round)
    .is('submitted_at', null)
    .maybeSingle()

  let submission = existing
  const isResend = !!existing

  if (!submission) {
    const serviceClient = await createServiceClient()
    const { data: newSubmission, error } = await serviceClient
      .from('questionnaire_submissions')
      .insert({
        project_id: projectId,
        template_id: templateId,
        client_email: project.client_email,
        round,
      })
      .select()
      .single()

    if (error || !newSubmission)
      return NextResponse.json({ error: 'Failed to create submission' }, { status: 500 })

    submission = newSubmission
  }

  await sendQuestionnaireInvite({
    clientEmail: project.client_email,
    clientName: project.client_name,
    consultantName: profile?.full_name || user.email || 'Your Consultant',
    projectTitle: project.title,
    token: submission.token,
  })

  await supabase.from('projects')
    .update({ status: 'questionnaire_sent' })
    .eq('id', projectId)

  // Log to send history
  await logQuestionnaireSend(supabase, {
    projectId,
    submissionId: submission.id,
    round,
    recipient: project.client_email,
    sentBy: user.id,
    isResend,
  })

  // Log project event
  await logProjectEvent(supabase, {
    projectId,
    eventType: isResend ? 'questionnaire_resent' : 'questionnaire_sent',
    actor: 'consultant',
    title: isResend
      ? `Questionnaire resent to ${project.client_email}`
      : `Questionnaire sent to ${project.client_email}`,
    detail: `Round ${round}`,
    metadata: { round, recipient: project.client_email, is_resend: isResend },
  })

  return NextResponse.json({ success: true, token: submission.token })
}
