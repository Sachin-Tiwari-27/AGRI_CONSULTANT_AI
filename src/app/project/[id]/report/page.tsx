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

  // Fetch report and associated project data
  const { data: report } = await supabase
    .from('reports')
    .select('*')
    .eq('project_id', id)
    .single()

  // Ensure report exists and is published
  if (!report || report.status !== 'published') {
    notFound()
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <PublicReportView report={report as unknown as Report} />
    </div>
  )
}
