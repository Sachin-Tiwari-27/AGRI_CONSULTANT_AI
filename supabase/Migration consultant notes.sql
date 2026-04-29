-- Migration: Create consultant_notes table
-- Run in Supabase SQL editor or via supabase db push

create table if not exists public.consultant_notes (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects(id) on delete cascade,
  consultant_id uuid not null references public.profiles(id) on delete cascade,
  category    text not null default 'general'
              check (category in ('market', 'climate', 'technical', 'financial', 'general')),
  title       text not null,
  content     text not null,
  is_pinned   boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- RLS
alter table public.consultant_notes enable row level security;

create policy "Consultants can manage their own notes"
  on public.consultant_notes
  for all
  using (consultant_id = auth.uid())
  with check (consultant_id = auth.uid());

-- Index for fast lookup by project
create index if not exists consultant_notes_project_id_idx
  on public.consultant_notes(project_id);

create index if not exists consultant_notes_consultant_id_idx
  on public.consultant_notes(consultant_id);

-- Auto-update updated_at
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger consultant_notes_updated_at
  before update on public.consultant_notes
  for each row execute procedure public.handle_updated_at();

-- Also update the report/generate route to use consultant notes
-- The notes are pulled via the /api/analysis/chat and /api/report/generate routes
-- In report/generate, add this to fetch notes and inject into sectionVars:
--
-- const { data: consultantNotes } = await supabase
--   .from('consultant_notes')
--   .select('category, title, content')
--   .eq('project_id', projectId)
--   .order('is_pinned', { ascending: false })
--   .limit(15);
--
-- const notesForReport = consultantNotes?.length
--   ? consultantNotes.map(n => `[${n.category.toUpperCase()}] ${n.title}: ${n.content}`).join('\n')
--   : 'No additional consultant notes.';
--
-- Then add to sectionVars: consultant_notes: notesForReport
-- And reference {{consultant_notes}} in relevant prompts.