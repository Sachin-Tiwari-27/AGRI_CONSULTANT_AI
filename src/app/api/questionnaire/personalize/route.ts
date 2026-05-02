import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { callAIJSON } from '@/lib/ai/ai.service'
import { logProjectEvent } from '@/lib/events'
import type { PersonalisationDiff, QuestionnaireTemplate } from '@/types'

// Build a compact summary of the template for the AI prompt
function buildTemplateSummary(template: QuestionnaireTemplate): string {
  const lines: string[] = []
  for (const section of template.sections.sort((a, b) => a.order - b.order)) {
    lines.push(`Section ${section.id} "${section.title}":`)
    const qs = template.questions
      .filter(q => q.section_id === section.id)
      .sort((a, b) => a.order - b.order)
    for (const q of qs) {
      lines.push(`  ${q.id}: ${q.label} [${q.type}${q.required ? ', required' : ''}]`)
    }
  }
  return lines.join('\n')
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { projectId, template } = await req.json() as {
    projectId: string
    template: QuestionnaireTemplate
  }

  if (!projectId || !template) {
    return NextResponse.json({ error: 'projectId and template are required' }, { status: 400 })
  }

  // Verify ownership and load call_brief
  const { data: project } = await supabase
    .from('projects')
    .select('id, consultant_id, region, country, crop_types, project_type, budget_range, currency, call_brief')
    .eq('id', projectId)
    .eq('consultant_id', user.id)
    .single()

  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const callBrief = project.call_brief
    ? JSON.stringify(project.call_brief, null, 2)
    : 'No call brief available — use default template.'

  const diff = await callAIJSON<PersonalisationDiff>({
    task: 'personalize_questionnaire',
    variables: {
      call_brief: callBrief,
      region: project.region || 'Unknown',
      country: project.country || 'Unknown',
      crop_types: (project.crop_types || []).join(', '),
      project_type: project.project_type || 'greenhouse',
      budget_range: project.budget_range || 'Not specified',
      currency: project.currency || 'USD',
      template_summary: buildTemplateSummary(template),
    },
    maxTokens: 800,
  })

  // Log event
  await logProjectEvent(supabase, {
    projectId,
    eventType: 'questionnaire_personalised',
    actor: 'ai',
    title: 'Questionnaire personalised by AI',
    detail: `${diff.add?.length ?? 0} questions added · ${Object.keys(diff.annotate ?? {}).length} annotated`,
    metadata: {
      added_count: diff.add?.length ?? 0,
      annotated_count: Object.keys(diff.annotate ?? {}).length,
      covering_note: diff.covering_note,
    },
  })

  return NextResponse.json({ diff })
}
