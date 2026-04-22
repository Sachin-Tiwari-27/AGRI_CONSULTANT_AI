import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { sendReportReady } from '@/lib/email.service'
import { generateReportPdfBuffer } from '@/lib/report-pdf'
import type { Report } from '@/types'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const serviceSupabase = await createServiceClient()
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

  const { data: reportData } = await supabase
    .from('reports')
    .select('*')
    .eq('project_id', projectId)
    .single()

  if (!reportData) {
    return NextResponse.json({ error: 'Report not found' }, { status: 404 })
  }

  // 2. Generate and upload PDF snapshot
  const pdfBuffer = await generateReportPdfBuffer(reportData as Report, project.title)
  const pdfPath = `${projectId}/${Date.now()}-report.pdf`

  const { error: pdfUploadError } = await serviceSupabase.storage
    .from('reports')
    .upload(pdfPath, pdfBuffer, { contentType: 'application/pdf', upsert: true })

  if (pdfUploadError) {
    return NextResponse.json({ error: 'Failed to upload PDF', details: pdfUploadError.message }, { status: 500 })
  }

  // 3. Update statuses
  const { error: reportUpdateError } = await supabase
    .from('reports')
    .update({ status: 'published', pdf_url: pdfPath })
    .eq('project_id', projectId)

  if (reportUpdateError) {
    return NextResponse.json({ error: 'Failed to update report status' }, { status: 500 })
  }

  await supabase
    .from('projects')
    .update({ status: 'report_published' })
    .eq('id', projectId)

  // 4. Send email to client
  try {
    const consultantProfile = project.profiles as { full_name?: string } | null
    const consultantName = consultantProfile?.full_name || 'Your Consultant'
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
