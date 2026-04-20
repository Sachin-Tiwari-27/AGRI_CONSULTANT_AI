import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { projectId } = await req.json()

  const { data: project } = await supabase
    .from('projects')
    .select('*, reports(status)')
    .eq('id', projectId)
    .single()

  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  if (!project.report_price || project.report_price <= 0)
    return NextResponse.json({ error: 'Report price not set' }, { status: 400 })

  // Check report is published
  const report = Array.isArray(project.reports) ? project.reports[0] : project.reports
  if (!report || report.status !== 'published')
    return NextResponse.json({ error: 'Report not yet published' }, { status: 400 })

  // Check for existing payment
  const { data: existingPayment } = await supabase
    .from('payments')
    .select('*')
    .eq('project_id', projectId)
    .eq('status', 'succeeded')
    .single()

  if (existingPayment)
    return NextResponse.json({ error: 'Already paid', paid: true }, { status: 400 })

  // Create Stripe payment intent
  const paymentIntent = await stripe.paymentIntents.create({
    amount: Math.round(project.report_price * 100), // convert to cents
    currency: 'usd',
    metadata: {
      project_id: projectId,
      client_email: project.client_email,
      project_title: project.title,
    },
    receipt_email: project.client_email,
  })

  // Record pending payment
  await supabase.from('payments').insert({
    project_id: projectId,
    stripe_payment_intent: paymentIntent.id,
    amount: project.report_price,
    currency: 'usd',
    status: 'pending',
  })

  return NextResponse.json({
    clientSecret: paymentIntent.client_secret,
    amount: project.report_price,
  })
}
