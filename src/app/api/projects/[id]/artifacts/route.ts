import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/projects/[id]/artifacts
 *
 * Returns everything collected on a project in one shot:
 * - All questionnaire submissions (all rounds, with answers)
 * - Consultant notes
 * - Call brief + raw consultant_notes
 * - Financial model (override > report draft > null)
 * - Report sections context (market research, climate data)
 * - AI chat snapshots saved as notes
 *
 * Used exclusively by ArtifactsTab so it loads with a single fetch.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  // Verify ownership
  const { data: project } = await supabase
    .from('projects')
    .select(`
      id, consultant_id, title, client_name, client_email,
      region, country, gps_coordinates, land_size_sqm,
      crop_types, project_type, budget_range, currency,
      experience_level, target_market, consultant_notes,
      call_brief, financial_model_override, financial_model_notes,
      created_at, updated_at
    `)
    .eq('id', id)
    .eq('consultant_id', user.id)
    .single()

  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // All questionnaire submissions with answers
  const { data: submissions } = await supabase
    .from('questionnaire_submissions')
    .select('id, round, submitted_at, answers, uploaded_files, created_at')
    .eq('project_id', id)
    .not('submitted_at', 'is', null)
    .order('round', { ascending: true })

  // Consultant research notes
  const { data: consultantNotes } = await supabase
    .from('consultant_notes')
    .select('id, category, title, content, is_pinned, created_at')
    .eq('project_id', id)
    .order('is_pinned', { ascending: false })
    .order('created_at', { ascending: false })

  // Report — for financial model fallback and context sections
  const { data: report } = await supabase
    .from('reports')
    .select('financial_model, sections, status, created_at, updated_at')
    .eq('project_id', id)
    .maybeSingle()

  // Resolve financial model: override > report > null
  const financialModel =
    project.financial_model_override ??
    report?.financial_model ??
    null

  const financialModelSource = project.financial_model_override
    ? 'consultant_override'
    : report?.financial_model
    ? 'report_draft'
    : 'none'

  // Extract market research and climate data from report sections
  const marketResearch =
    (report?.sections as any)?.context_market_data?.content ?? null
  const climateData =
    (report?.sections as any)?.context_climate_data?.content ?? null

  // Questionnaire send log for timestamp info
  const { data: sendLog } = await supabase
    .from('questionnaire_send_log')
    .select('round, sent_at, is_resend, recipient')
    .eq('project_id', id)
    .order('sent_at', { ascending: false })

  return NextResponse.json({
    project: {
      id: project.id,
      title: project.title,
      client_name: project.client_name,
      client_email: project.client_email,
      region: project.region,
      country: project.country,
      gps_coordinates: project.gps_coordinates,
      land_size_sqm: project.land_size_sqm,
      crop_types: project.crop_types,
      project_type: project.project_type,
      budget_range: project.budget_range,
      currency: project.currency,
      experience_level: project.experience_level,
      target_market: project.target_market,
      consultant_notes: project.consultant_notes,
      created_at: project.created_at,
    },
    call_brief: project.call_brief ?? null,
    submissions: submissions ?? [],
    send_log: sendLog ?? [],
    consultant_notes: consultantNotes ?? [],
    financial_model: financialModel,
    financial_model_notes: project.financial_model_notes ?? null,
    financial_model_source: financialModelSource,
    market_research: marketResearch,
    climate_data: climateData,
    report_status: report?.status ?? null,
    report_updated_at: report?.updated_at ?? null,
  })
}
