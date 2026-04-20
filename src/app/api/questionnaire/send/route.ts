import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { sendQuestionnaireInvite } from '@/lib/email.service'

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

  // Create submission record with unique token
  const serviceClient = await createServiceClient()
  const { data: submission, error } = await serviceClient
    .from('questionnaire_submissions')
    .insert({
      project_id: projectId,
      template_id: templateId,
      client_email: project.client_email,
      round,
    })
    .select()
    .single()

  if (error || !submission)
    return NextResponse.json({ error: 'Failed to create submission' }, { status: 500 })

  // Send email
  await sendQuestionnaireInvite({
    clientEmail: project.client_email,
    clientName: project.client_name,
    consultantName: profile?.full_name || user.email || 'Your Consultant',
    projectTitle: project.title,
    token: submission.token,
  })

  // Update project status
  await supabase.from('projects')
    .update({ status: 'questionnaire_sent' })
    .eq('id', projectId)

  return NextResponse.json({ success: true, token: submission.token })
}
