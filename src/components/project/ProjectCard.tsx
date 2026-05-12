import Link from "next/link";
import { StatusBadge } from "@/components/ui/Card";
import { formatDate } from "@/lib/utils";
import { MapPin, Calendar, Wheat, ArrowRight } from "lucide-react";
import type { Project } from "@/types";

// Shows the first N crops then "+X more" to avoid overflow
function CropPill({ crops }: { crops: string[] }) {
  const MAX_SHOW = 3;
  const shown = crops.slice(0, MAX_SHOW);
  const extra = crops.length - MAX_SHOW;

  return (
    <span className="flex items-center gap-1 min-w-0">
      <Wheat className="w-3 h-3 flex-shrink-0" />
      <span className="truncate">
        {shown.join(", ")}
        {extra > 0 && (
          <span className="text-slate-400 ml-1">+{extra} more</span>
        )}
      </span>
    </span>
  );
}

export function ProjectCard({ project }: { project: Project }) {
  return (
    <Link href={`/project/${project.id}`} className="block group">
      <div className="bg-white rounded-xl border border-slate-200 hover:border-green-300 hover:shadow-md transition-all p-5">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0 flex-1">
            {/* Title truncates — prevents overflow when project names are very long */}
            <h3 className="font-semibold text-slate-900 group-hover:text-green-800 transition-colors truncate">
              {project.title}
            </h3>
            <p className="text-sm text-slate-500 mt-0.5 truncate">
              {project.client_name}
            </p>
          </div>
          {/* Badge is flex-shrink-0 so it never wraps under the title */}
          <div className="flex-shrink-0">
            <StatusBadge status={project.status} />
          </div>
        </div>

        <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-slate-500">
          {project.region && (
            <span className="flex items-center gap-1 min-w-0">
              <MapPin className="w-3 h-3 flex-shrink-0" />
              <span className="truncate max-w-[140px]">
                {project.region}, {project.country}
              </span>
            </span>
          )}
          {project.crop_types?.length ? (
            <span className="min-w-0 max-w-[200px]">
              <CropPill crops={project.crop_types} />
            </span>
          ) : null}
          <span className="flex items-center gap-1 flex-shrink-0">
            <Calendar className="w-3 h-3" />
            {formatDate(project.created_at)}
          </span>
        </div>

        <div className="mt-3 flex items-center justify-end text-xs text-green-700 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
          Open project <ArrowRight className="w-3 h-3 ml-1" />
        </div>
      </div>
    </Link>
  );
}
