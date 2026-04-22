import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { sendClarificationRequest } from '@/lib/email.service'
import { generateToken } from '@/lib/utils'
import type { AIFlag } from '@/types'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { projectId, acceptedFlags }: { projectId: string; acceptedFlags: AIFlag[] } = await req.json()

  if (!acceptedFlags?.length) {
    return NextResponse.json({ error: 'No accepted flags provided' }, { status: 400 })
  }

  const { data: project } = await supabase
    .from('projects').select('*').eq('id', projectId).single()

  if (!project || project.consultant_id !== user.id)
    return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: profile } = await supabase
    .from('profiles').select('full_name').eq('id', user.id).single()

  // Count existing rounds
  const { data: existingSubmissions } = await supabase
    .from('questionnaire_submissions')
    .select('round')
    .eq('project_id', projectId)
    .order('round', { ascending: false })
    .limit(1)

  const nextRound = (existingSubmissions?.[0]?.round || 1) + 1

  // Build covering message from accepted flags
  const questionList = acceptedFlags
    .map((f, i) => `${i + 1}. **${f.field_name}**: ${f.suggested_question}`)
    .join('\n')
  const coveringMessage = `We have a few follow-up questions to help us complete your feasibility report for <strong>${project.title}</strong>. Your answers will allow us to provide more accurate projections.<br/><br/>Specifically, we need clarification on:<br/><br/>${questionList.replace(/\n/g, '<br/>')}`

  // Create a follow-up submission
  const serviceClient = await createServiceClient()
  const { data: submission, error } = await serviceClient
    .from('questionnaire_submissions')
    .insert({
      project_id: projectId,
      template_id: null,
      client_email: project.client_email,
      round: nextRound,
    })
    .select()
    .single()

  if (error || !submission)
    return NextResponse.json({ error: 'Failed to create follow-up submission' }, { status: 500 })

  // Send email
  await sendClarificationRequest({
    clientEmail: project.client_email,
    clientName: project.client_name,
    consultantName: profile?.full_name || user.email || 'Your Consultant',
    projectTitle: project.title,
    token: submission.token,
    coveringMessage,
  })

  // Update project status
  await supabase.from('projects')
    .update({ status: 'clarification_sent' })
    .eq('id', projectId)

  return NextResponse.json({ success: true, round: nextRound })
}
