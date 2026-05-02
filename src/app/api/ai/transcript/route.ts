import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { callAIJSON } from '@/lib/ai/ai.service'
import { logProjectEvent } from '@/lib/events'
import type { CallBrief } from '@/types'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const contentType = req.headers.get('content-type') || ''

  let projectId: string
  let rawText: string

  // Accept either JSON { projectId, text } or multipart form with a file
  if (contentType.includes('application/json')) {
    const body = await req.json()
    projectId = body.projectId
    rawText = body.text || ''
  } else {
    // multipart: consultant uploads a .txt / .vtt file
    const form = await req.formData()
    projectId = String(form.get('projectId') || '')
    const file = form.get('file')
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Missing file' }, { status: 400 })
    }
    rawText = await file.text()
  }

  if (!projectId || !rawText.trim()) {
    return NextResponse.json({ error: 'projectId and transcript text are required' }, { status: 400 })
  }

  // Verify ownership
  const { data: project } = await supabase
    .from('projects')
    .select('id, consultant_id, region, country, crop_types, project_type, budget_range, currency')
    .eq('id', projectId)
    .eq('consultant_id', user.id)
    .single()

  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Trim transcript to fit context — 6000 chars is plenty for call notes
  const trimmed = rawText.slice(0, 6000)

  const brief = await callAIJSON<CallBrief>({
    task: 'call_brief_summary',
    variables: { raw_notes: trimmed },
    maxTokens: 800,
  })

  brief.extracted_at = new Date().toISOString()

  // Persist brief on project
  await supabase
    .from('projects')
    .update({ call_brief: brief })
    .eq('id', projectId)

  // Log event
  await logProjectEvent(supabase, {
    projectId,
    eventType: 'transcript_uploaded',
    actor: 'consultant',
    title: 'Call transcript uploaded and summarised',
    detail: `AI extracted ${brief.key_concerns?.length ?? 0} key concerns from transcript`,
    metadata: {
      chars: rawText.length,
      crops_extracted: brief.crop_types ?? [],
      budget_extracted: brief.budget_range ?? null,
    },
  })

  return NextResponse.json({ brief })
}
