-- ─────────────────────────────────────────────────────────────
-- Migration: settings overhaul — extended profile fields
-- Run AFTER pkg1–pkg4 migrations
-- ─────────────────────────────────────────────────────────────

-- 1. Extended profile fields
alter table profiles
  add column if not exists bio                  text,
  add column if not exists website              text,
  add column if not exists linkedin_url         text,
  add column if not exists avatar_url           text,
  add column if not exists logo_url             text,
  -- Branding defaults (used in report generation)
  add column if not exists brand_primary_color  text default '#1A5C38',
  add column if not exists brand_secondary_color text default '#2E7D52',
  add column if not exists brand_footer_text    text,
  -- Payment extended
  add column if not exists stripe_connected     boolean not null default false,
  add column if not exists stripe_account_id    text;

-- 2. Allow consultants to update their own profile (RLS)
--    Most Supabase setups have this, but ensure UPDATE is allowed:
do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'profiles'
      and policyname = 'Users can update own profile'
  ) then
    execute $policy$
      create policy "Users can update own profile"
        on profiles for update
        using (auth.uid() = id)
        with check (auth.uid() = id)
    $policy$;
  end if;
end;
$$;

-- 3. Storage bucket for avatars and logos (run separately in Supabase dashboard
--    or via CLI if bucket doesn't exist):
--
--    insert into storage.buckets (id, name, public)
--    values ('avatars', 'avatars', true)
--    on conflict do nothing;
--
--    create policy "Anyone can view avatars"
--      on storage.objects for select using (bucket_id = 'avatars');
--
--    create policy "Auth users can upload own avatar"
--      on storage.objects for insert
--      with check (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);