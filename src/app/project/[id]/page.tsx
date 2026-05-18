import { notFound, redirect } from "next/navigation";
import { createClient, getUser } from "@/lib/supabase/server";
import { Sidebar, TopBar } from "@/components/layout/Sidebar";
import { StatusBadge } from "@/components/ui/status";
import { ProjectWorkspace } from "./ProjectWorkspace";
import type { Project, Report, AIFlag } from "@/types";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [
    {
      data: { user },
    },
    supabase,
  ] = await Promise.all([getUser(), createClient()]);
  if (!user) redirect("/login");

  const { data: project } = await supabase
    .from("projects")
    .select(
      `
      *,
      questionnaire_submissions(id, round, submitted_at, created_at, token, answers),
      ai_flags(*),
      reports(*)
    `,
    )
    .eq("id", id)
    .eq("consultant_id", user.id)
    .single();

  if (!project) notFound();

  const report = Array.isArray(project.reports)
    ? project.reports[0]
    : project.reports;

  return (
    <div className="flex h-screen overflow-hidden bg-surface">
      <Sidebar />
      <main className="flex-1 overflow-y-auto min-w-0 flex flex-col">
        <TopBar
          title={project.title}
          breadcrumb={
            <span>
              <a
                href="/dashboard/projects"
                className="hover:text-foreground transition-colors"
              >
                Projects
              </a>
              {" / "}
              <span className="text-foreground/60 truncate">
                {project.title}
              </span>
            </span>
          }
        >
          <StatusBadge status={project.status} />
        </TopBar>

        <ProjectWorkspace
          project={
            project as unknown as Project & {
              questionnaire_submissions: Array<{
                id: string;
                round: number;
                submitted_at: string | null;
                token: string;
                answers: Record<string, unknown>;
              }>;
              ai_flags: AIFlag[];
            }
          }
          report={report as Report | null}
          userId={user.id}
        />
      </main>
    </div>
  );
}
