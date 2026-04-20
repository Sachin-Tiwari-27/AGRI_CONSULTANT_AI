import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { callAIJSON, logAIUsage } from '@/lib/ai/ai.service'
import type { AIFlag } from '@/types'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { projectId, submissionId } = await req.json()

  // Fetch project + submission
  const { data: project } = await supabase.from('projects').select('*').eq('id', projectId).single()
  const { data: submission } = await supabase.from('questionnaire_submissions').select('*').eq('id', submissionId).single()

  if (!project || !submission) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (project.consultant_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const request = {
    task: 'clarification_check' as const,
    variables: {
      project_type: project.project_type || 'greenhouse',
      region: project.region || 'Unknown',
      country: project.country || 'Unknown',
      crop_types: (project.crop_types || []).join(', '),
      questionnaire_answers: JSON.stringify(submission.answers, null, 2),
    },
    maxTokens: 1500,
  }

  const aiResponse = await callAIJSON<AIFlag[]>(request)
  await logAIUsage(
    { content: '', tokensUsed: 0, model: '', provider: 'openrouter', durationMs: 0 },
    'clarification_check', projectId, user.id
  )

  // Store flags
  if (aiResponse.length > 0) {
    const flags = aiResponse.map(f => ({
      project_id: projectId,
      submission_id: submissionId,
      field_name: f.field_name,
      reason: f.reason,
      suggested_question: f.suggested_question,
      severity: f.severity,
      status: 'pending',
    }))
    await supabase.from('ai_flags').insert(flags)
  }

  return NextResponse.json({ flags: aiResponse })
}
