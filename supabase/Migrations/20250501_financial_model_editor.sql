-- ─────────────────────────────────────────────────────────────
-- Migration: financial model editor support
-- Run in Supabase SQL editor AFTER 20250430_project_events.sql
-- ─────────────────────────────────────────────────────────────

-- 1. Store consultant-edited financial model on the project itself
--    so it persists independently of the report draft cycle.
alter table projects
  add column if not exists financial_model_override jsonb,
  add column if not exists financial_model_notes    text;

-- 2. Index for fast lookup
create index if not exists projects_fm_override_idx
  on projects using gin(financial_model_override)
  where financial_model_override is not null;

-- 3. project_events entry for financial model edits
--    (no schema change needed — uses existing project_events table
--     with event_type = 'financial_model_edited')
--    Just documenting the new event_type value here for reference.

-- 4. Ensure RLS on projects still allows consultant to update these columns
--    (projects table should already have a policy for consultant_id = auth.uid())
--    Nothing extra needed if your existing UPDATE policy covers all columns.
