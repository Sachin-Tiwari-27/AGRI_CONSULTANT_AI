-- ─────────────────────────────────────────────────────────────
-- Migration: project_events + questionnaire_send_log
-- Run in Supabase SQL editor or via supabase db push
-- ─────────────────────────────────────────────────────────────

-- 1. project_events — universal activity log per project
create table if not exists project_events (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references projects(id) on delete cascade,
  event_type   text not null,
  -- 'project_created' | 'call_scheduled' | 'call_completed'
  -- | 'transcript_uploaded' | 'questionnaire_sent' | 'questionnaire_resent'
  -- | 'client_submitted' | 'ai_gap_check' | 'flag_actioned'
  -- | 'follow_up_sent' | 'report_generated' | 'report_published'
  -- | 'payment_initiated' | 'payment_received' | 'note_added'
  -- | 'questionnaire_personalised'
  actor        text not null default 'system',
  -- 'consultant' | 'client' | 'system' | 'ai'
  title        text not null,
  detail       text,
  metadata     jsonb default '{}'::jsonb,
  created_at   timestamptz not null default now()
);

create index if not exists project_events_project_id_idx
  on project_events(project_id, created_at desc);

-- 2. questionnaire_send_log — every send/resend with timestamp
create table if not exists questionnaire_send_log (
  id             uuid primary key default gen_random_uuid(),
  project_id     uuid not null references projects(id) on delete cascade,
  submission_id  uuid references questionnaire_submissions(id) on delete set null,
  round          int not null default 1,
  recipient      text not null,
  sent_by        uuid references profiles(id) on delete set null,
  is_resend      boolean not null default false,
  sent_at        timestamptz not null default now()
);

create index if not exists qsl_project_idx
  on questionnaire_send_log(project_id, sent_at desc);

-- 3. Add call_brief and transcript_url columns to projects
alter table projects
  add column if not exists call_brief       jsonb,
  add column if not exists transcript_url   text;

-- 4. RLS policies for project_events
alter table project_events enable row level security;

create policy "Consultants can view their project events"
  on project_events for select
  using (
    exists (
      select 1 from projects p
      where p.id = project_events.project_id
        and p.consultant_id = auth.uid()
    )
  );

create policy "Service role can insert events"
  on project_events for insert
  with check (true);

-- 5. RLS policies for questionnaire_send_log
alter table questionnaire_send_log enable row level security;

create policy "Consultants can view their send log"
  on questionnaire_send_log for select
  using (
    exists (
      select 1 from projects p
      where p.id = questionnaire_send_log.project_id
        and p.consultant_id = auth.uid()
    )
  );

create policy "Service role can insert send log"
  on questionnaire_send_log for insert
  with check (true);
