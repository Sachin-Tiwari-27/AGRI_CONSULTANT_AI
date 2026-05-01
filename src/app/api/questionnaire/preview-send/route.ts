import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { sendQuestionnaireInvite } from '@/lib/email.service'
import { logProjectEvent, logQuestionnaireSend } from '@/lib/events'
import type { QuestionnaireTemplate } from '@/types'

/**
 * POST /api/questionnaire/preview-send
 *
 * Called after the consultant finishes editing the questionnaire in the
 * preview modal. Accepts the final (possibly mutated) template, upserts
 * it in the DB, creates / reuses a submission record, sends the email,
 * and logs the send event.
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const {
    projectId,
    template,   // the consultant-edited QuestionnaireTemplate
    round = 1,
  } = await req.json() as {
    projectId: string
    template: QuestionnaireTemplate
    round?: number
  }

  if (!projectId || !template) {
    return NextResponse.json({ error: 'projectId and template required' }, { status: 400 })
  }

  const { data: project } = await supabase
    .from('projects')
    .select('*')
    .eq('id', projectId)
    .eq('consultant_id', user.id)
    .single()

  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, company_name')
    .eq('id', user.id)
    .single()

  const serviceClient = await createServiceClient()

  // 1. Upsert the edited template
  //    Strip deleted questions and recalculate order before saving
  const cleanedQuestions = template.questions
    .filter(q => !q.deleted)
    .map((q, idx) => ({ ...q, order: idx + 1, deleted: undefined, ai_suggested: undefined }))

  let savedTemplateId: string

  if (template.id && template.id !== 'default') {
    // Update existing custom template
    await serviceClient
      .from('questionnaire_templates')
      .update({
        name: template.name,
        sections: template.sections,
        questions: cleanedQuestions,
      })
      .eq('id', template.id)
    savedTemplateId = template.id
  } else {
    // Create a new template from the edited default
    const { data: newTpl } = await serviceClient
      .from('questionnaire_templates')
      .insert({
        consultant_id: user.id,
        name: `${project.title} — Round ${round}`,
        sections: template.sections,
        questions: cleanedQuestions,
      })
      .select('id')
      .single()
    savedTemplateId = newTpl?.id ?? ''
  }

  // 2. Check for existing pending submission for this round
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
    const { data: newSub } = await serviceClient
      .from('questionnaire_submissions')
      .insert({
        project_id: projectId,
        template_id: savedTemplateId,
        client_email: project.client_email,
        round,
      })
      .select()
      .single()
    submission = newSub
  }

  if (!submission) {
    return NextResponse.json({ error: 'Failed to create submission' }, { status: 500 })
  }

  // 3. Send email
  await sendQuestionnaireInvite({
    clientEmail: project.client_email,
    clientName: project.client_name,
    consultantName: profile?.full_name || user.email || 'Your Consultant',
    projectTitle: project.title,
    token: submission.token,
  })

  // 4. Update project status
  await supabase
    .from('projects')
    .update({ status: 'questionnaire_sent' })
    .eq('id', projectId)

  // 5. Log the send in questionnaire_send_log
  await logQuestionnaireSend(supabase, {
    projectId,
    submissionId: submission.id,
    round,
    recipient: project.client_email,
    sentBy: user.id,
    isResend,
  })

  // 6. Log project event
  await logProjectEvent(supabase, {
    projectId,
    eventType: isResend ? 'questionnaire_resent' : 'questionnaire_sent',
    actor: 'consultant',
    title: isResend
      ? `Questionnaire resent to ${project.client_email}`
      : `Questionnaire sent to ${project.client_email}`,
    detail: `Round ${round} · ${cleanedQuestions.length} questions`,
    metadata: {
      round,
      recipient: project.client_email,
      question_count: cleanedQuestions.length,
      template_id: savedTemplateId,
      is_resend: isResend,
    },
  })

  return NextResponse.json({
    success: true,
    token: submission.token,
    isResend,
    questionCount: cleanedQuestions.length,
  })
}
