-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: Phase B — Word Export/Import + Excerpt Report
-- Run AFTER 20260526_report_formats.sql
-- ═══════════════════════════════════════════════════════════════════════════

-- The excerpt columns were already added in the Phase A migration:
--   reports.excerpt_status   text  DEFAULT 'none'
--   reports.excerpt_published_at  timestamptz
--   reports.docx_import_pending_sections  jsonb
--
-- This migration adds the missing excerpt_sections snapshot on reports so
-- the public excerpt page knows exactly which sections + word limits to show
-- without re-reading the format at render time.

ALTER TABLE public.reports
  ADD COLUMN IF NOT EXISTS excerpt_sections jsonb DEFAULT '[]'::jsonb;
-- Each element: { key, title, word_limit }
-- Populated when consultant publishes the excerpt.

-- Track docx export attempts for debugging
ALTER TABLE public.reports
  ADD COLUMN IF NOT EXISTS last_docx_exported_at timestamptz;

-- Index for excerpt status queries (client portal needs this)
CREATE INDEX IF NOT EXISTS reports_excerpt_status_idx
  ON public.reports(project_id, excerpt_status)
  WHERE excerpt_status = 'published';

-- Public read policy for excerpt — mirrors the existing "published" policy
-- but checks excerpt_status instead of status.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'reports'
      AND policyname = 'Public can read published excerpts'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "Public can read published excerpts"
        ON public.reports FOR SELECT
        USING (excerpt_status = 'published')
    $policy$;
  END IF;
END;
$$;