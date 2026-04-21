import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendReportReady } from '@/lib/email.service'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const { projectId } = await req.json()

  // Fetch project and consultant details
  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('*, profiles!projects_consultant_id_fkey(full_name)')
    .eq('id', projectId)
    .single()

  if (projectError || !project || project.consultant_id !== user.id) {
    return NextResponse.json({ error: 'Project not found or access denied' }, { status: 404 })
  }

  // Check if report is actually published
  const { data: report } = await supabase
    .from('reports')
    .select('status')
    .eq('project_id', projectId)
    .single()

  if (!report || report.status !== 'published') {
    return NextResponse.json({ error: 'Report must be published before sending notifications' }, { status: 400 })
  }

  // Send email to client
  try {
    const consultantName = (project.profiles as any)?.full_name || 'Your Consultant'
    await sendReportReady({
      clientEmail: project.client_email,
      clientName: project.client_name,
      consultantName,
      projectTitle: project.title,
      projectId,
      previewUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/project/${projectId}/report`,
    })
    return NextResponse.json({ success: true })
  } catch (emailError) {
    console.error('[Notify] Failed to send email:', emailError)
    return NextResponse.json({ error: 'Failed to send email. Check Resend configuration.' }, { status: 500 })
  }
}
