import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get('projectId')
  if (!projectId) return NextResponse.json({ error: 'Missing projectId' }, { status: 400 })

  const supabase = await createClient()
  const serviceSupabase = await createServiceClient()

  const { data: { user } } = await supabase.auth.getUser()

  const { data: report } = await serviceSupabase
    .from('reports')
    .select('pdf_url, status')
    .eq('project_id', projectId)
    .single()

  if (!report?.pdf_url) {
    return NextResponse.json({ error: 'PDF not available' }, { status: 404 })
  }

  const { data: project } = await serviceSupabase
    .from('projects')
    .select('consultant_id, client_id, status')
    .eq('id', projectId)
    .single()

  const isConsultant = !!user && user.id === project?.consultant_id
  const isClient = !!user && user.id === project?.client_id && report.status === 'published' && project.status === 'completed'
  const isPublicPaidAccess = !user && report.status === 'published' && project?.status === 'completed'

  if (!isConsultant && !isClient && !isPublicPaidAccess) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data: signed, error } = await serviceSupabase.storage
    .from('reports')
    .createSignedUrl(report.pdf_url, 60 * 10)

  if (error || !signed?.signedUrl) {
    return NextResponse.json({ error: 'Failed to create signed URL' }, { status: 500 })
  }

  return NextResponse.json({ url: signed.signedUrl })
}
