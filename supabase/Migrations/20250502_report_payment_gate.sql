-- ─────────────────────────────────────────────────────────────
-- Migration: report payment gate
-- Run AFTER pkg1, pkg2, pkg3 migrations
-- ─────────────────────────────────────────────────────────────

-- 1. Ensure report_price exists on projects (may already be there)
alter table projects
  add column if not exists report_price       numeric(12,2),
  add column if not exists report_price_set_at timestamptz;

-- 2. Track whether payment was manually collected offline
--    (for consultants who don't use Stripe but still want to mark as paid)
alter table projects
  add column if not exists payment_collected        boolean not null default false,
  add column if not exists payment_collected_at     timestamptz,
  add column if not exists payment_collected_note   text;

-- 3. Index for payment queries
create index if not exists projects_payment_idx
  on projects(status)
  where report_price is not null;

-- No RLS changes needed — projects table policies already cover these columns.
