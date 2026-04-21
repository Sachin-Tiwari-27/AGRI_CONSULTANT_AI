import { createClient } from '@/lib/supabase/server'
import { TopBar } from '@/components/layout/Sidebar'
import { ProjectCard } from '@/components/project/ProjectCard'
import { NewProjectButton } from '../NewProjectButton'
import type { Project } from '@/types'

export default async function ProjectsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: projects } = await supabase
    .from('projects')
    .select('*')
    .eq('consultant_id', user!.id)
    .order('updated_at', { ascending: false })

  const all = (projects || []) as Project[]

  return (
    <div>
      <TopBar title="Projects">
        <NewProjectButton />
      </TopBar>

      <div className="px-8 py-6 space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">
            All Projects ({all.length})
          </h2>
        </div>

        {all.length === 0 ? (
          <div className="bg-white rounded-xl border border-dashed border-slate-300 p-12 text-center">
            <p className="text-slate-500 text-sm">No projects found.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {all.map(p => <ProjectCard key={p.id} project={p} />)}
          </div>
        )}
      </div>
    </div>
  )
}
