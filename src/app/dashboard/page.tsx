import { createClient } from '@/lib/supabase/server'
import { TopBar } from '@/components/layout/Sidebar'
import { StatCard } from '@/components/ui/Card'
import { ProjectCard } from '@/components/project/ProjectCard'
import { NewProjectButton } from './NewProjectButton'
import type { Project } from '@/types'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles').select('full_name, company_name').eq('id', user!.id).single()

  const { data: projects } = await supabase
    .from('projects')
    .select('*')
    .eq('consultant_id', user!.id)
    .order('updated_at', { ascending: false })
    .limit(20)

  const all = (projects || []) as Project[]
  const active = all.filter(p => !['completed'].includes(p.status))
  const completed = all.filter(p => p.status === 'completed')
  const awaitingReview = all.filter(p =>
    ['questionnaire_submitted', 'clarification_sent'].includes(p.status)
  )

  return (
    <div>
      <TopBar title={`Good morning, ${profile?.full_name?.split(' ')[0] || 'Consultant'}`}>
        <NewProjectButton />
      </TopBar>

      <div className="px-8 py-6 space-y-8">
        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          <StatCard label="Active projects"   value={active.length} />
          <StatCard label="Awaiting response" value={awaitingReview.length} sub="questionnaires pending" />
          <StatCard label="Completed"         value={completed.length} />
          <StatCard label="Total projects"    value={all.length} />
        </div>

        {/* Needs attention */}
        {awaitingReview.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
              Needs attention
            </h2>
            <div className="grid grid-cols-1 gap-3">
              {awaitingReview.map(p => <ProjectCard key={p.id} project={p} />)}
            </div>
          </section>
        )}

        {/* All active */}
        <section>
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
            Active projects
          </h2>
          {active.length === 0 ? (
            <div className="bg-white rounded-xl border border-dashed border-slate-300 p-12 text-center">
              <p className="text-slate-500 text-sm">No active projects yet.</p>
              <p className="text-slate-400 text-xs mt-1">Create your first project to get started.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {active.map(p => <ProjectCard key={p.id} project={p} />)}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
