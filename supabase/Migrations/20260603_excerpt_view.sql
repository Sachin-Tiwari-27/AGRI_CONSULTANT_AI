-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: 20260603_excerpt_view
-- Fixes P1: Public RLS policy exposes full report rows.
--
-- The previous policy "Public can read published excerpts" (added in
-- 20260527_phase_b.sql) granted SELECT on the entire reports row
-- (including sections, financial_model, pdf_url) to unauthenticated users.
--
-- This migration:
--   1. Drops that broad policy.
--   2. Creates a view (public_report_excerpts) that exposes ONLY the safe
--      columns needed by the public excerpt page, with section content
--      pre-truncated to each section's word_limit.
--   3. Grants SELECT on the view to the anon and authenticated roles.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Step 1: Drop the overly-broad RLS policy ────────────────────────────────
DROP POLICY IF EXISTS "Public can read published excerpts" ON public.reports;

-- ── Step 2: Helper — truncate a text value to N words ───────────────────────
CREATE OR REPLACE FUNCTION public.truncate_to_words(content text, word_limit int)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT CASE
    WHEN word_limit IS NULL OR word_limit <= 0 THEN content
    ELSE (
      SELECT string_agg(word, ' ')
      FROM (
        SELECT word, ROW_NUMBER() OVER () AS rn
        FROM regexp_split_to_table(content, '\s+') AS word
      ) sub
      WHERE rn <= word_limit
    )
  END;
$$;

-- ── Step 3: Create the safe public view ─────────────────────────────────────
-- Exposes only: project_id, excerpt_status, excerpt_sections, branding,
-- and excerpt_content (a jsonb object with only the excerpt keys, content
-- truncated to each section's word_limit).
--
-- The full "sections" and "financial_model" columns are never exposed.
-- financial_model summary values (capex_total, total_annual_revenue,
-- payback_years) are exposed as separate scalar columns so the UI can still
-- show the financial highlight cards without exposing the raw model.

CREATE OR REPLACE VIEW public.public_report_excerpts AS
SELECT
  r.project_id,
  r.excerpt_status,
  r.excerpt_sections,
  r.branding,
  r.status                                          AS report_status,

  -- Financial highlight summary (safe subset only — no line-item detail)
  (r.financial_model->>'capex_total')::numeric      AS fm_capex_total,
  (r.financial_model->>'total_annual_revenue')::numeric AS fm_annual_revenue,
  (r.financial_model->>'payback_years')::numeric    AS fm_payback_years,

  -- Pre-truncated excerpt content: { section_key: truncated_text, … }
  -- Built by iterating excerpt_sections and slicing each section's content.
  (
    SELECT jsonb_object_agg(
      es.key,
      public.truncate_to_words(
        r.sections -> es.key ->> 'content',
        (es.word_limit)::int
      )
    )
    FROM jsonb_to_recordset(r.excerpt_sections)
      AS es(key text, title text, word_limit int)
    WHERE r.sections ? es.key
      AND r.sections -> es.key ->> 'content' IS NOT NULL
  )                                                 AS excerpt_content

FROM public.reports r
WHERE r.excerpt_status = 'published';

-- ── Step 4: Grant read access to anon and authenticated roles ────────────────
-- RLS does NOT apply to views owned by the postgres role, but we grant
-- SELECT explicitly to make the intent clear and survive role resets.
GRANT SELECT ON public.public_report_excerpts TO anon, authenticated;

-- ── Notes ────────────────────────────────────────────────────────────────────
-- • The view itself is the security boundary — it can only be queried and
--   returns rows only when excerpt_status = 'published' (WHERE clause).
-- • The full reports table retains its existing RLS policies:
--     "Consultants manage own reports"  — for all authenticated consultant ops
--     "Clients read published reports"  — for authenticated clients
--   Public (unauthenticated) access now ONLY goes through this view.
-- • excerpt/page.tsx is updated to query public_report_excerpts instead of
--   reports, and ExcerptReportView receives excerpt_content (pre-truncated)
--   rather than the raw sections map.
