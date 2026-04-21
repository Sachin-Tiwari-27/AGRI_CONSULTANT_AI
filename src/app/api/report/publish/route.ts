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

  // 1. Fetch project and consultant details
  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('*, profiles!projects_consultant_id_fkey(full_name)')
    .eq('id', projectId)
    .single()

  if (projectError || !project || project.consultant_id !== user.id) {
    return NextResponse.json({ error: 'Project not found or access denied' }, { status: 404 })
  }

  // 2. Update statuses
  const { error: reportUpdateError } = await supabase
    .from('reports')
    .update({ status: 'published' })
    .eq('project_id', projectId)

  if (reportUpdateError) {
    return NextResponse.json({ error: 'Failed to update report status' }, { status: 500 })
  }

  await supabase
    .from('projects')
    .update({ status: 'report_published' })
    .eq('id', projectId)

  // 3. Send email to client
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
  } catch (emailError) {
    console.error('[Publish] Failed to send report ready email:', emailError)
    // We don't fail the whole request because the DB status is already updated
    return NextResponse.json({ 
      success: true, 
      warning: 'Report published but email failed to send. Check Resend logs.' 
    })
  }

  return NextResponse.json({ success: true })
}
