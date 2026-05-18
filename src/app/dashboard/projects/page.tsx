import { createClient, getUser } from "@/lib/supabase/server";
import { TopBar } from "@/components/layout/Sidebar";
import { ProjectCard } from "@/components/project/ProjectCard";
import { NewProjectButton } from "../NewProjectButton";
import type { Project } from "@/types";

export default async function ProjectsPage() {
  const [
    {
      data: { user },
    },
    supabase,
  ] = await Promise.all([getUser(), createClient()]);

  const { data: projects } = await supabase
    .from("projects")
    .select("*")
    .eq("consultant_id", user!.id)
    .order("updated_at", { ascending: false });

  const all = (projects ?? []) as Project[];

  return (
    <div className="flex flex-col h-full">
      <TopBar title="Projects">
        <NewProjectButton />
      </TopBar>

      <div className="flex-1 overflow-y-auto px-6 py-6 max-w-6xl mx-auto w-full">
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs text-muted-foreground">
            {all.length} project{all.length !== 1 ? "s" : ""}
          </p>
        </div>

        {all.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-muted/20 px-8 py-14 text-center">
            <p className="text-sm font-medium text-foreground">
              No projects yet
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Create your first project to get started.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {all.map((p) => (
              <ProjectCard key={p.id} project={p} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
