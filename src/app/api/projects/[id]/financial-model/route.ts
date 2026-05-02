import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logProjectEvent } from '@/lib/events'
import type { FinancialModel } from '@/types'

/**
 * PATCH /api/projects/[id]/financial-model
 *
 * Persists the consultant-edited financial model override onto the project.
 * Also syncs it into the reports table if a draft report exists, so that
 * the next report regeneration picks up the corrected numbers automatically.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { financialModel, notes } = await req.json() as {
    financialModel: FinancialModel
    notes?: string
  }

  if (!financialModel) {
    return NextResponse.json({ error: 'financialModel is required' }, { status: 400 })
  }

  // Verify ownership
  const { data: project } = await supabase
    .from('projects')
    .select('id, consultant_id, currency')
    .eq('id', id)
    .eq('consultant_id', user.id)
    .single()

  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Recompute derived fields server-side so they are always consistent
  const crops = financialModel.crops ?? []
  const totalRevenue = crops.reduce((sum, c) => sum + (c.annual_revenue ?? 0), 0)
    + (financialModel.agro_tourism_revenue ?? 0)
  const opex = (financialModel.growing_cost_annual ?? 0) + (financialModel.manpower_cost_annual ?? 0)
  const ebitda = totalRevenue - opex
  const ebitdaMargin = totalRevenue > 0 ? Math.round((ebitda / totalRevenue) * 100) : 0
  const totalInvestment = (financialModel.capex_total ?? 0) + (financialModel.pre_startup_cost ?? 0)
  const paybackYears = ebitda > 0
    ? Math.round((totalInvestment / ebitda) * 10) / 10
    : 0

  const sanitised: FinancialModel = {
    ...financialModel,
    crops,
    total_annual_revenue: totalRevenue,
    ebitda,
    ebitda_margin: ebitdaMargin,
    payback_years: paybackYears,
  }

  // 1. Save override on project
  const { error: projectError } = await supabase
    .from('projects')
    .update({
      financial_model_override: sanitised,
      financial_model_notes: notes ?? null,
    })
    .eq('id', id)

  if (projectError) {
    return NextResponse.json({ error: projectError.message }, { status: 500 })
  }

  // 2. Sync into existing report draft if one exists
  const { data: report } = await supabase
    .from('reports')
    .select('id, financial_model')
    .eq('project_id', id)
    .maybeSingle()

  if (report) {
    await supabase
      .from('reports')
      .update({ financial_model: sanitised })
      .eq('project_id', id)
  }

  // 3. Log event
  await logProjectEvent(supabase, {
    projectId: id,
    eventType: 'financial_model_edited' as any,
    actor: 'consultant',
    title: 'Financial model edited by consultant',
    detail: `${crops.length} crop${crops.length !== 1 ? 's' : ''} · CAPEX ${project.currency ?? 'USD'} ${sanitised.capex_total?.toLocaleString()} · Payback ${paybackYears} yrs`,
    metadata: {
      capex_total: sanitised.capex_total,
      total_annual_revenue: totalRevenue,
      ebitda_margin: ebitdaMargin,
      payback_years: paybackYears,
      crop_count: crops.length,
      has_notes: !!(notes?.trim()),
    },
  })

  return NextResponse.json({ financialModel: sanitised })
}

/**
 * GET /api/projects/[id]/financial-model
 *
 * Returns the active financial model for this project.
 * Priority: consultant override > report draft model > null
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { data: project } = await supabase
    .from('projects')
    .select('id, consultant_id, currency, financial_model_override, financial_model_notes')
    .eq('id', id)
    .eq('consultant_id', user.id)
    .single()

  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // If override exists, return it
  if (project.financial_model_override) {
    return NextResponse.json({
      financialModel: project.financial_model_override,
      notes: project.financial_model_notes ?? '',
      source: 'override',
    })
  }

  // Fall back to report draft model
  const { data: report } = await supabase
    .from('reports')
    .select('financial_model')
    .eq('project_id', id)
    .maybeSingle()

  if (report?.financial_model) {
    return NextResponse.json({
      financialModel: report.financial_model,
      notes: '',
      source: 'report_draft',
    })
  }

  return NextResponse.json({ financialModel: null, notes: '', source: 'none' })
}
