import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { callAIJSON } from '@/lib/ai/ai.service'
import { sendClarificationRequest } from '@/lib/email.service'
import type { AIFlag } from '@/types'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { projectId, acceptedFlags } = await req.json() as {
    projectId: string
    acceptedFlags: AIFlag[]
  }

  if (!acceptedFlags?.length)
    return NextResponse.json({ error: 'No accepted flags provided' }, { status: 400 })

  const { data: project } = await supabase
    .from('projects')
    .select('*')
    .eq('id', projectId)
    .single()

  if (!project || project.consultant_id !== user.id)
    return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, company_name')
    .eq('id', user.id)
    .single()

  // Use AI to draft a covering message and format the follow-up questions
  let followUpData: { covering_message: string; questions: Array<{ id: string; label: string; type: string; required: boolean }> }

  try {
    followUpData = await callAIJSON({
      task: 'followup_questions',
      variables: {
        consultant_name: profile?.full_name || user.email || 'Your Consultant',
        project_type: project.project_type || 'greenhouse',
        region: project.region || 'your location',
        country: project.country || '',
        accepted_flags: acceptedFlags.map(f =>
          `Field: ${f.field_name}\nReason needed: ${f.reason}\nSuggested question: ${f.suggested_question}`
        ).join('\n\n'),
      },
      maxTokens: 1000,
    })
  } catch (err) {
    // Fallback: build a simple follow-up without AI if it fails
    console.error('[Followup] AI draft failed, using fallback:', err)
    followUpData = {
      covering_message: `Thank you for completing the initial questionnaire. We have a few follow-up questions to help us complete your feasibility assessment.`,
      questions: acceptedFlags.map((flag, i) => ({
        id: `fq${i + 1}`,
        label: flag.suggested_question,
        type: 'textarea',
        required: flag.severity === 'required',
      })),
    }
  }

  // Get the latest round number
  const { data: existingSubmissions } = await supabase
    .from('questionnaire_submissions')
    .select('round')
    .eq('project_id', projectId)
    .order('round', { ascending: false })
    .limit(1)

  const nextRound = (existingSubmissions?.[0]?.round || 1) + 1

  // Build a mini template for the follow-up questions
  const followUpTemplate = {
    id: `followup-${projectId}-r${nextRound}`,
    consultant_id: user.id,
    name: `Follow-up Questions (Round ${nextRound})`,
    sections: [
      {
        id: 'fu-s1',
        title: followUpData.covering_message,
        description: '',
        order: 1,
      },
    ],
    questions: followUpData.questions.map((q, i) => ({
      id: q.id || `fq${i + 1}`,
      section_id: 'fu-s1',
      label: q.label,
      type: q.type || 'textarea',
      required: q.required ?? true,
      order: i + 1,
    })),
    created_at: new Date().toISOString(),
  }

  // Save template to DB so the client portal can load it
  const serviceClient = await createServiceClient()
  const { data: savedTemplate } = await serviceClient
    .from('questionnaire_templates')
    .insert({
      consultant_id: user.id,
      name: followUpTemplate.name,
      sections: followUpTemplate.sections,
      questions: followUpTemplate.questions,
    })
    .select()
    .single()

  // Create the follow-up submission record with new token
  const { data: submission } = await serviceClient
    .from('questionnaire_submissions')
    .insert({
      project_id: projectId,
      template_id: savedTemplate?.id || null,
      client_email: project.client_email,
      round: nextRound,
    })
    .select()
    .single()

  if (!submission)
    return NextResponse.json({ error: 'Failed to create follow-up submission' }, { status: 500 })

  // Send email
  await sendClarificationRequest({
    clientEmail: project.client_email,
    clientName: project.client_name,
    consultantName: profile?.full_name || user.email || 'Your Consultant',
    projectTitle: project.title,
    token: submission.token,
    coveringMessage: followUpData.covering_message,
  })

  // Update project status
  await supabase
    .from('projects')
    .update({ status: 'clarification_sent' })
    .eq('id', projectId)

  return NextResponse.json({
    success: true,
    token: submission.token,
    questionsCount: followUpData.questions.length,
  })
}
