import { createClient, getUser } from "@/lib/supabase/server";
import { TopBar } from "@/components/layout/Sidebar";
import { NewProjectButton } from "./NewProjectButton";
import { ProjectCard } from "@/components/project/ProjectCard";
import type { Project } from "@/types";

export default async function DashboardPage() {
  const [
    {
      data: { user },
    },
    supabase,
  ] = await Promise.all([getUser(), createClient()]);

  const [profileRes, projectsRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name, company_name")
      .eq("id", user!.id)
      .single(),
    supabase
      .from("projects")
      .select("*")
      .eq("consultant_id", user!.id)
      .order("updated_at", { ascending: false })
      .limit(30),
  ]);

  const profile = profileRes.data;
  const projects = (projectsRes.data ?? []) as Project[];

  const firstName = profile?.full_name?.split(" ")[0] ?? "there";
  const active = projects.filter((p) => p.status !== "completed");
  const completed = projects.filter((p) => p.status === "completed");
  const needsAction = projects.filter((p) =>
    ["questionnaire_submitted", "clarification_sent"].includes(p.status),
  );

  return (
    <div className="flex flex-col h-full">
      <TopBar title={`Good morning, ${firstName}`}>
        <NewProjectButton />
      </TopBar>

      <div className="flex-1 overflow-y-auto">
        <div className="px-6 py-6 max-w-6xl mx-auto space-y-8">
          {/* KPI strip — 3 numbers, no cards */}
          <div className="flex items-center gap-8 py-2">
            <KpiNumber label="Active projects" value={active.length} />
            <div className="h-8 w-px bg-border" />
            <KpiNumber
              label="Need attention"
              value={needsAction.length}
              accent={needsAction.length > 0}
            />
            <div className="h-8 w-px bg-border" />
            <KpiNumber label="Completed" value={completed.length} />
            <div className="h-8 w-px bg-border" />
            <KpiNumber label="Total" value={projects.length} />
          </div>

          {/* Needs attention */}
          {needsAction.length > 0 && (
            <section>
              <SectionHeading>Needs attention</SectionHeading>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {needsAction.map((p) => (
                  <ProjectCard key={p.id} project={p} />
                ))}
              </div>
            </section>
          )}

          {/* Active projects */}
          <section>
            <SectionHeading>
              Active
              <span className="ml-1.5 text-muted-foreground font-normal">
                ({active.length})
              </span>
            </SectionHeading>

            {active.length === 0 ? (
              <EmptyProjects />
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {active.map((p) => (
                  <ProjectCard key={p.id} project={p} />
                ))}
              </div>
            )}
          </section>

          {/* Completed — collapsed by default if many */}
          {completed.length > 0 && (
            <section>
              <SectionHeading>
                Completed
                <span className="ml-1.5 text-muted-foreground font-normal">
                  ({completed.length})
                </span>
              </SectionHeading>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {completed.slice(0, 4).map((p) => (
                  <ProjectCard key={p.id} project={p} />
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

function KpiNumber({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: boolean;
}) {
  return (
    <div>
      <p
        className={`text-2xl font-semibold tabular-nums leading-none ${
          accent && value > 0 ? "text-amber-600" : "text-foreground"
        }`}
      >
        {value}
      </p>
      <p className="text-[11px] text-muted-foreground mt-1">{label}</p>
    </div>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
      {children}
    </h2>
  );
}

function EmptyProjects() {
  return (
    <div className="rounded-xl border border-dashed border-border bg-muted/20 px-8 py-12 text-center">
      <p className="text-sm font-medium text-foreground">No active projects</p>
      <p className="text-xs text-muted-foreground mt-1">
        Create your first project to get started.
      </p>
    </div>
  );
}
