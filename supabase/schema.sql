-- ================================================================
-- AgriAI Platform — Supabase Schema
-- Run this entire file in Supabase SQL Editor (Dashboard → SQL)
-- ================================================================

-- Enable required extensions
create extension if not exists "uuid-ossp";
create extension if not exists "vector";         -- for Phase 2 RAG (column added nullable)

-- ── Profiles (extends Supabase auth.users) ──────────────────────────
create table public.profiles (
  id              uuid references auth.users(id) on delete cascade primary key,
  email           text unique not null,
  full_name       text,
  role            text not null default 'client' check (role in ('consultant','client','admin')),
  avatar_url      text,
  company_name    text,
  phone           text,
  created_at      timestamptz default now()
);
alter table public.profiles enable row level security;
create policy "Users can view own profile"   on public.profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);
create policy "Consultants visible to all"   on public.profiles for select using (role = 'consultant');

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'role', 'client')
  );
  return new;
end;
$$;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ── Projects ──────────────────────────────────────────────────────────
create table public.projects (
  id                  uuid default uuid_generate_v4() primary key,
  consultant_id       uuid references public.profiles(id) not null,
  client_id           uuid references public.profiles(id),
  client_email        text not null,
  client_name         text not null,
  title               text not null,
  status              text not null default 'call_scheduled',
  -- call brief fields
  region              text,
  country             text,
  gps_coordinates     text,
  land_size_sqm       numeric,
  crop_types          text[],
  project_type        text,
  climate_zone        text,
  budget_range        text,
  experience_level    text,
  target_market       text[],
  funding_status      text,
  consultant_notes    text,
  -- meeting
  meet_link           text,
  meet_scheduled_at   timestamptz,
  meet_recording_url  text,
  -- report pricing
  report_price        numeric default 0,
  report_published_at timestamptz,
  -- Phase 2 RAG: add embeddings without rewrite
  embedding           vector(1536),
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);
alter table public.projects enable row level security;
create policy "Consultants see own projects" on public.projects for all using (auth.uid() = consultant_id);
create policy "Clients see own projects"     on public.projects for select using (auth.uid() = client_id);

-- auto-update updated_at
create or replace function public.update_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;
create trigger projects_updated_at before update on public.projects
  for each row execute procedure public.update_updated_at();

-- ── Questionnaire Templates ──────────────────────────────────────────
create table public.questionnaire_templates (
  id              uuid default uuid_generate_v4() primary key,
  consultant_id   uuid references public.profiles(id) not null,
  name            text not null,
  description     text,
  sections        jsonb not null default '[]',
  questions       jsonb not null default '[]',
  is_default      boolean default false,
  created_at      timestamptz default now()
);
alter table public.questionnaire_templates enable row level security;
create policy "Consultants manage own templates" on public.questionnaire_templates for all using (auth.uid() = consultant_id);

-- ── Questionnaire Submissions ────────────────────────────────────────
create table public.questionnaire_submissions (
  id              uuid default uuid_generate_v4() primary key,
  project_id      uuid references public.projects(id) on delete cascade not null,
  template_id     uuid references public.questionnaire_templates(id),
  token           text unique not null default encode(gen_random_bytes(32), 'hex'),
  client_email    text not null,
  answers         jsonb not null default '{}',
  uploaded_files  jsonb not null default '[]',
  round           integer not null default 1,   -- 1 = initial, 2 = clarification
  submitted_at    timestamptz,
  created_at      timestamptz default now()
);
alter table public.questionnaire_submissions enable row level security;
create policy "Consultant sees project submissions" on public.questionnaire_submissions
  for select using (
    exists (select 1 from public.projects p where p.id = project_id and p.consultant_id = auth.uid())
  );
-- Public (no login) access by token — used for client questionnaire portal
create policy "Token bearer can read and submit" on public.questionnaire_submissions
  for all using (true) with check (true);   -- token validation done in API route

-- ── AI Flags ─────────────────────────────────────────────────────────
create table public.ai_flags (
  id                  uuid default uuid_generate_v4() primary key,
  project_id          uuid references public.projects(id) on delete cascade not null,
  submission_id       uuid references public.questionnaire_submissions(id),
  field_name          text not null,
  reason              text not null,
  suggested_question  text not null,
  severity            text not null default 'required' check (severity in ('required','recommended')),
  status              text not null default 'pending' check (status in ('pending','accepted','dismissed')),
  created_at          timestamptz default now()
);
alter table public.ai_flags enable row level security;
create policy "Consultants manage flags" on public.ai_flags
  for all using (
    exists (select 1 from public.projects p where p.id = project_id and p.consultant_id = auth.uid())
  );

-- ── Reports ───────────────────────────────────────────────────────────
create table public.reports (
  id                uuid default uuid_generate_v4() primary key,
  project_id        uuid references public.projects(id) on delete cascade unique not null,
  sections          jsonb not null default '{}',
  financial_model   jsonb not null default '{}',
  status            text not null default 'draft' check (status in ('draft','review','published')),
  branding          jsonb not null default '{}',
  pdf_url           text,
  created_at        timestamptz default now(),
  updated_at        timestamptz default now()
);
alter table public.reports enable row level security;
create policy "Consultants manage own reports" on public.reports
  for all using (
    exists (select 1 from public.projects p where p.id = project_id and p.consultant_id = auth.uid())
  );
create policy "Clients read published reports" on public.reports
  for select using (
    status = 'published' and
    exists (select 1 from public.projects p where p.id = project_id and p.client_id = auth.uid())
  );
create trigger reports_updated_at before update on public.reports
  for each row execute procedure public.update_updated_at();

-- ── AI Usage Log ─────────────────────────────────────────────────────
create table public.ai_usage_log (
  id              uuid default uuid_generate_v4() primary key,
  project_id      uuid references public.projects(id),
  consultant_id   uuid references public.profiles(id),
  task            text not null,
  model           text not null,
  provider        text not null,
  tokens_used     integer,
  duration_ms     integer,
  created_at      timestamptz default now()
);
alter table public.ai_usage_log enable row level security;
create policy "Consultants see own usage" on public.ai_usage_log for select using (auth.uid() = consultant_id);

-- ── Notifications ────────────────────────────────────────────────────
create table public.notifications (
  id          uuid default uuid_generate_v4() primary key,
  user_id     uuid references public.profiles(id) not null,
  type        text not null,
  message     text not null,
  project_id  uuid references public.projects(id),
  read        boolean default false,
  created_at  timestamptz default now()
);
alter table public.notifications enable row level security;
create policy "Users see own notifications" on public.notifications for all using (auth.uid() = user_id);

-- ── Payments ─────────────────────────────────────────────────────────
create table public.payments (
  id                    uuid default uuid_generate_v4() primary key,
  project_id            uuid references public.projects(id) not null,
  stripe_payment_intent text unique,
  amount                numeric not null,
  currency              text not null default 'usd',
  status                text not null default 'pending',
  paid_at               timestamptz,
  created_at            timestamptz default now()
);
alter table public.payments enable row level security;
create policy "Consultant sees own payments" on public.payments
  for select using (
    exists (select 1 from public.projects p where p.id = project_id and p.consultant_id = auth.uid())
  );

-- ── Storage Buckets (run separately if needed) ────────────────────────
-- insert into storage.buckets (id, name, public) values ('uploads', 'uploads', false);
-- insert into storage.buckets (id, name, public) values ('reports', 'reports', false);
-- insert into storage.buckets (id, name, public) values ('logos', 'logos', true);

-- Storage policies
-- create policy "Authenticated users can upload" on storage.objects for insert with check (auth.role() = 'authenticated');
-- create policy "Users access own uploads" on storage.objects for select using (auth.uid()::text = (storage.foldername(name))[1]);
