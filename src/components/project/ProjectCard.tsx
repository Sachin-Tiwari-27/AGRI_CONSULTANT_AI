import Link from 'next/link'
import { StatusBadge } from '@/components/ui/Card'
import { formatDate } from '@/lib/utils'
import { MapPin, Calendar, Wheat, ArrowRight } from 'lucide-react'
import type { Project } from '@/types'

export function ProjectCard({ project }: { project: Project }) {
  return (
    <Link href={`/project/${project.id}`} className="block group">
      <div className="bg-white rounded-xl border border-slate-200 hover:border-green-300 hover:shadow-md transition-all p-5">
        <div className="flex items-start justify-between gap-4 mb-3">
          <div>
            <h3 className="font-semibold text-slate-900 group-hover:text-green-800 transition-colors">
              {project.title}
            </h3>
            <p className="text-sm text-slate-500 mt-0.5">{project.client_name}</p>
          </div>
          <StatusBadge status={project.status} />
        </div>

        <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-slate-500">
          {project.region && (
            <span className="flex items-center gap-1">
              <MapPin className="w-3 h-3" />{project.region}, {project.country}
            </span>
          )}
          {project.crop_types?.length ? (
            <span className="flex items-center gap-1">
              <Wheat className="w-3 h-3" />{project.crop_types.join(', ')}
            </span>
          ) : null}
          <span className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />{formatDate(project.created_at)}
          </span>
        </div>

        <div className="mt-3 flex items-center justify-end text-xs text-green-700 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
          Open project <ArrowRight className="w-3 h-3 ml-1" />
        </div>
      </div>
    </Link>
  )
}
