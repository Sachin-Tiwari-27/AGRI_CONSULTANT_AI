import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logProjectEvent } from '@/lib/events'

/**
 * PATCH /api/projects/[id]/report-price
 *
 * Sets the report price on a project. Called from the payment gate
 * modal when the consultant chooses to charge before publishing.
 *
 * Body: { price: number, currency: string, chargeClient: boolean }
 *
 * If chargeClient is false, price is stored as 0 (free unlock).
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { price, currency, chargeClient } = await req.json() as {
    price: number
    currency: string
    chargeClient: boolean
  }

  if (typeof price !== 'number' || price < 0) {
    return NextResponse.json({ error: 'price must be a non-negative number' }, { status: 400 })
  }

  // Verify ownership
  const { data: project } = await supabase
    .from('projects')
    .select('id, consultant_id, title, client_email')
    .eq('id', id)
    .eq('consultant_id', user.id)
    .single()

  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const effectivePrice = chargeClient ? price : 0

  const { error } = await supabase
    .from('projects')
    .update({
      report_price: effectivePrice,
      currency: currency || 'USD',
      report_price_set_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logProjectEvent(supabase, {
    projectId: id,
    eventType: 'report_published' as any,
    actor: 'consultant',
    title: chargeClient
      ? `Report price set: ${currency} ${price.toLocaleString()}`
      : 'Report set to free (no payment required)',
    detail: chargeClient
      ? `Client will be prompted to pay before downloading`
      : 'Client can access report without payment',
    metadata: { price: effectivePrice, currency, charge_client: chargeClient },
  })

  return NextResponse.json({ success: true, price: effectivePrice, currency })
}
