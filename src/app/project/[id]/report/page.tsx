import { notFound } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/server'
import { PublicReportView } from '@/components/report/PublicReportView'
import type { Report } from '@/types'

export default async function ClientReportPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createServiceClient()

  // Fetch report and project status together
  const [{ data: report }, { data: project }] = await Promise.all([
    supabase.from('reports').select('*').eq('project_id', id).single(),
    supabase.from('projects').select('status').eq('id', id).single(),
  ])

  // Ensure report exists and is published
  if (!report || report.status !== 'published') {
    notFound()
  }

  const paid = project?.status === 'completed'

  return (
    <div className="min-h-screen bg-slate-50">
      <PublicReportView
        report={report as unknown as Report}
        paid={paid}
        projectId={id}
      />
    </div>
  )
}
