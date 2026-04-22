import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { generateReportPdfBuffer } from '@/lib/report-pdf'
import type { Report } from '@/types'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const serviceSupabase = await createServiceClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { projectId } = await req.json()

  const { data: project } = await supabase
    .from('projects')
    .select('id, title, consultant_id')
    .eq('id', projectId)
    .single()

  if (!project || project.consultant_id !== user.id) {
    return NextResponse.json({ error: 'Not found or forbidden' }, { status: 404 })
  }

  const { data: report } = await supabase
    .from('reports')
    .select('*')
    .eq('project_id', projectId)
    .single()

  if (!report) {
    return NextResponse.json({ error: 'Report not found' }, { status: 404 })
  }

  const pdfBuffer = await generateReportPdfBuffer(report as Report, project.title)
  const uploadPath = `${projectId}/${Date.now()}-report.pdf`

  const { error: uploadError } = await serviceSupabase.storage
    .from('reports')
    .upload(uploadPath, pdfBuffer, {
      contentType: 'application/pdf',
      upsert: true,
    })

  if (uploadError) {
    return NextResponse.json({ error: 'Failed to upload PDF', details: uploadError.message }, { status: 500 })
  }

  await supabase
    .from('reports')
    .update({ pdf_url: uploadPath })
    .eq('project_id', projectId)

  return NextResponse.json({ success: true, path: uploadPath })
}
