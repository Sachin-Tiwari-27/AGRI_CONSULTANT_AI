import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

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

  // Fetch the template
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

  // Save answers + mark submitted
  await supabase.from('questionnaire_submissions').update({
    answers,
    uploaded_files: Array.isArray(uploaded_files) ? uploaded_files : [],
    submitted_at: new Date().toISOString(),
  }).eq('token', token)

  // Update project status
  const newStatus = submission.round === 1 ? 'questionnaire_submitted' : 'questionnaire_submitted'
  await supabase.from('projects').update({ status: newStatus }).eq('id', submission.project_id)

  // Notify consultant
  await supabase.from('notifications').insert({
    user_id: submission.project.consultant_id,
    type: 'questionnaire_submitted',
    message: `Client submitted the questionnaire for project.`,
    project_id: submission.project_id,
  })

  return NextResponse.json({ success: true })
}
