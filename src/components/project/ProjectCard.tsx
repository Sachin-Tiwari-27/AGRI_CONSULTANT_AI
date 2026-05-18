import Link from "next/link";
import { StatusBadge } from "@/components/ui/status";
import { formatDate } from "@/lib/utils";
import { MapPin, Calendar, Wheat, ArrowRight } from "lucide-react";
import type { Project } from "@/types";

export function ProjectCard({ project }: { project: Project }) {
  const crops = project.crop_types ?? [];

  return (
    <Link href={`/project/${project.id}`} className="block group">
      <div className="rounded-xl border border-border bg-card hover:border-brand-300 hover:shadow-sm transition-all duration-150 p-5">
        {/* Top row: title + badge */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground group-hover:text-brand-800 transition-colors truncate leading-snug">
              {project.title}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5 truncate">
              {project.client_name}
            </p>
          </div>
          <StatusBadge status={project.status} />
        </div>

        {/* Meta row */}
        <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
          {project.region && (
            <span className="flex items-center gap-1 truncate max-w-[140px]">
              <MapPin className="size-3 flex-shrink-0" />
              <span className="truncate">
                {project.region}
                {project.country ? `, ${project.country}` : ""}
              </span>
            </span>
          )}
          {crops.length > 0 && (
            <span className="flex items-center gap-1 truncate max-w-[160px]">
              <Wheat className="size-3 flex-shrink-0" />
              <span className="truncate">
                {crops.slice(0, 2).join(", ")}
                {crops.length > 2 && ` +${crops.length - 2}`}
              </span>
            </span>
          )}
          <span className="flex items-center gap-1 flex-shrink-0 ml-auto">
            <Calendar className="size-3" />
            {formatDate(project.created_at)}
          </span>
        </div>

        {/* Hover CTA */}
        <div className="mt-3 flex items-center justify-end text-[11px] text-brand-700 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
          Open project
          <ArrowRight className="size-3 ml-1" />
        </div>
      </div>
    </Link>
  );
}
