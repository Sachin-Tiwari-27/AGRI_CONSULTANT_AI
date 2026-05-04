import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logProjectEvent } from '@/lib/events'

/**
 * PATCH /api/projects/[id]/mark-paid
 *
 * Marks a project as manually paid (cash, bank transfer, etc).
 * Sets status to 'completed' so the client can access the full report.
 *
 * Body: { note?: string }
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { note } = await req.json().catch(() => ({ note: '' }))

  const { data: project } = await supabase
    .from('projects')
    .select('id, consultant_id, title, report_price, currency')
    .eq('id', id)
    .eq('consultant_id', user.id)
    .single()

  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { error } = await supabase
    .from('projects')
    .update({
      status: 'completed',
      payment_collected: true,
      payment_collected_at: new Date().toISOString(),
      payment_collected_note: note || null,
    })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logProjectEvent(supabase, {
    projectId: id,
    eventType: 'payment_received',
    actor: 'consultant',
    title: 'Payment manually marked as collected',
    detail: note || `${project.currency ?? 'USD'} ${project.report_price?.toLocaleString() ?? '—'} collected offline`,
    metadata: {
      amount: project.report_price,
      currency: project.currency,
      method: 'manual',
      note: note || null,
    },
  })

  return NextResponse.json({ success: true })
}
