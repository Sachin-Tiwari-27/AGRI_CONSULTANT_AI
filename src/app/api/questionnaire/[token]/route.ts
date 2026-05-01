import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { logProjectEvent } from '@/lib/events'

// GET /api/questionnaire/[token] — fetch questionnaire for client
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  const supabase = await createServiceClient()

  const { data: submission, error } = await supabase
    .from('questionnaire_submissions')
    .select(`
      *,
      project:projects(title, client_name, consultant_id,
        profiles!projects_consultant_id_fkey(full_name, company_name))
    `)
    .eq('token', token)
    .single()

  if (error || !submission)
    return NextResponse.json({ error: 'Questionnaire not found' }, { status: 404 })

  if (submission.submitted_at)
    return NextResponse.json({ error: 'Already submitted', submitted: true }, { status: 410 })

  const { data: template } = await supabase
    .from('questionnaire_templates')
    .select('*')
    .eq('id', submission.template_id)
    .single()

  return NextResponse.json({ submission, template })
}

// POST /api/questionnaire/[token] — submit answers
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  const supabase = await createServiceClient()
  const { answers, uploaded_files } = await req.json()

  const { data: submission } = await supabase
    .from('questionnaire_submissions')
    .select('*, project:projects(consultant_id, status)')
    .eq('token', token)
    .single()

  if (!submission) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (submission.submitted_at) return NextResponse.json({ error: 'Already submitted' }, { status: 410 })

  const answerCount = Object.keys(answers || {}).length
  const filesCount = Array.isArray(uploaded_files) ? uploaded_files.length : 0

  await supabase.from('questionnaire_submissions').update({
    answers,
    uploaded_files: Array.isArray(uploaded_files) ? uploaded_files : [],
    submitted_at: new Date().toISOString(),
  }).eq('token', token)

  await supabase.from('projects')
    .update({ status: 'questionnaire_submitted' })
    .eq('id', submission.project_id)

  // Notify consultant
  await supabase.from('notifications').insert({
    user_id: submission.project.consultant_id,
    type: 'questionnaire_submitted',
    message: `Client submitted the questionnaire for project.`,
    project_id: submission.project_id,
  })

  // Log project event
  await logProjectEvent(supabase, {
    projectId: submission.project_id,
    eventType: 'client_submitted',
    actor: 'client',
    title: `Client submitted questionnaire (Round ${submission.round})`,
    detail: `${answerCount} answers · ${filesCount} file${filesCount !== 1 ? 's' : ''} uploaded`,
    metadata: {
      round: submission.round,
      answer_count: answerCount,
      files_count: filesCount,
      submission_id: submission.id,
    },
  })

  return NextResponse.json({ success: true })
}
