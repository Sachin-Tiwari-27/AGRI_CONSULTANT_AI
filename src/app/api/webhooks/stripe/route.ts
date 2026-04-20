import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import Stripe from 'stripe'
import { sendReportReady } from '@/lib/email.service'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig = req.headers.get('stripe-signature')!

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch (err) {
    console.error('[Webhook] Stripe signature verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const supabase = await createServiceClient()

  if (event.type === 'payment_intent.succeeded') {
    const intent = event.data.object as Stripe.PaymentIntent
    const projectId = intent.metadata.project_id

    // Update payment record
    await supabase.from('payments').update({
      status: 'succeeded',
      paid_at: new Date().toISOString(),
    }).eq('stripe_payment_intent', intent.id)

    // Update project status
    await supabase.from('projects')
      .update({ status: 'completed' })
      .eq('id', projectId)

    // Fetch project for notification
    const { data: project } = await supabase
      .from('projects')
      .select('*, profiles!projects_consultant_id_fkey(full_name)')
      .eq('id', projectId)
      .single()

    if (project) {
      // Notify consultant
      await supabase.from('notifications').insert({
        user_id: project.consultant_id,
        type: 'payment_received',
        message: `Payment received for "${project.title}" — ${intent.metadata.project_title}`,
        project_id: projectId,
      })

      // Send report download email to client
      const consultantName = (project.profiles as any)?.full_name || 'Your Consultant'
      await sendReportReady({
        clientEmail: project.client_email,
        clientName: project.client_name,
        consultantName,
        projectTitle: project.title,
        projectId,
        previewUrl: `${process.env.NEXT_PUBLIC_APP_URL}/project/${projectId}/report`,
      })
    }
  }

  return NextResponse.json({ received: true })
}
