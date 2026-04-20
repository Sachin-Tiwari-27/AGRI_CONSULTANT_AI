import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/layout/Sidebar'
import { TopBar } from '@/components/layout/Sidebar'
import { StatusBadge } from '@/components/ui/Card'
import { ProjectWorkspace } from './ProjectWorkspace'
import type { Project, Report, AIFlag } from '@/types'

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: project } = await supabase
    .from('projects')
    .select(`
      *,
      questionnaire_submissions(id, round, submitted_at, created_at, token, answers),
      ai_flags(*),
      reports(*)
    `)
    .eq('id', id)
    .eq('consultant_id', user.id)
    .single()

  if (!project) notFound()

  const report = Array.isArray(project.reports) ? project.reports[0] : project.reports

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <TopBar title={project.title}>
          <StatusBadge status={project.status} />
        </TopBar>
        <ProjectWorkspace
          project={project as unknown as Project & {
            questionnaire_submissions: Array<{ id: string; round: number; submitted_at: string | null; token: string; answers: Record<string, unknown> }>
            ai_flags: AIFlag[]
          }}
          report={report as Report | null}
          userId={user.id}
        />
      </main>
    </div>
  )
}
