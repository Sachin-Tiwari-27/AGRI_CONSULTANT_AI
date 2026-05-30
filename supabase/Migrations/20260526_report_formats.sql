-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: Custom Report Formats
-- Run AFTER all existing migrations.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. report_formats table ──────────────────────────────────────────────────
-- Stores named report format templates owned by a consultant.
-- The default 17-section format is seeded automatically via a trigger.

CREATE TABLE IF NOT EXISTS public.report_formats (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  consultant_id   uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name            text NOT NULL,
  description     text,
  is_default      boolean NOT NULL DEFAULT false,
  -- sections: ordered array of section config objects (see type definition)
  -- Each element: { key, title, description, section_type, word_count_target,
  --   has_placeholders, generation_phase, max_tokens, prompt_hint,
  --   ai_generated_prompt, prompt_confirmed, is_financial, is_excerpt_default }
  sections        jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- excerpt config: which section keys appear in the teaser report
  excerpt_section_keys  text[] DEFAULT ARRAY[]::text[],
  excerpt_word_limit    integer DEFAULT 300,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS report_formats_consultant_idx
  ON public.report_formats(consultant_id);

CREATE TRIGGER report_formats_updated_at
  BEFORE UPDATE ON public.report_formats
  FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at();

ALTER TABLE public.report_formats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Consultants manage own report formats"
  ON public.report_formats FOR ALL
  USING (consultant_id = auth.uid())
  WITH CHECK (consultant_id = auth.uid());

-- ── 2. Link projects to a report format ─────────────────────────────────────
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS report_format_id uuid REFERENCES public.report_formats(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS projects_report_format_idx
  ON public.projects(report_format_id)
  WHERE report_format_id IS NOT NULL;

-- ── 3. Track which format was used for a specific report generation ──────────
ALTER TABLE public.reports
  ADD COLUMN IF NOT EXISTS report_format_id uuid REFERENCES public.report_formats(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS format_snapshot  jsonb; -- sections array snapshotted at generation time

-- ── 4. Word document import tracking ────────────────────────────────────────
ALTER TABLE public.reports
  ADD COLUMN IF NOT EXISTS docx_import_pending_sections jsonb DEFAULT '[]'::jsonb;
-- Stores: [{ key, title, content, is_new_section }]
-- new sections the user hasn't mapped to an existing key yet

-- ── 5. Excerpt published flag ────────────────────────────────────────────────
ALTER TABLE public.reports
  ADD COLUMN IF NOT EXISTS excerpt_status text DEFAULT 'none'
    CHECK (excerpt_status IN ('none', 'published')),
  ADD COLUMN IF NOT EXISTS excerpt_published_at timestamptz;

-- ── 6. Fix ai_usage_log INSERT permissions ───────────────────────────────────
-- The gateway's SupabaseLoggerPlugin uses createServiceClient which bypasses
-- RLS. But if the service role key isn't set (dev), insert fails silently.
-- Adding an explicit service role INSERT policy as belt-and-suspenders.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'ai_usage_log'
      AND policyname = 'Service role can insert usage logs'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "Service role can insert usage logs"
        ON public.ai_usage_log FOR INSERT
        WITH CHECK (true)
    $policy$;
  END IF;
END;
$$;

-- Also ensure authenticated consultants can INSERT (the gateway runs server-side
-- as the authenticated user in API routes that don't use the service client).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'ai_usage_log'
      AND policyname = 'Authenticated users can insert usage logs'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "Authenticated users can insert usage logs"
        ON public.ai_usage_log FOR INSERT
        WITH CHECK (auth.uid() IS NOT NULL)
    $policy$;
  END IF;
END;
$$;

-- ── 7. Seed default format function ─────────────────────────────────────────
-- Called once per consultant to create their "Default (17-section)" format.
-- The app layer calls this on first login / settings page load.

CREATE OR REPLACE FUNCTION public.seed_default_report_format(p_consultant_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_existing_id uuid;
  v_new_id      uuid;
BEGIN
  -- Idempotent: do nothing if default already exists
  SELECT id INTO v_existing_id
  FROM public.report_formats
  WHERE consultant_id = p_consultant_id AND is_default = true
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    RETURN v_existing_id;
  END IF;

  INSERT INTO public.report_formats (
    consultant_id, name, description, is_default, sections,
    excerpt_section_keys, excerpt_word_limit
  ) VALUES (
    p_consultant_id,
    'Standard Agricultural Feasibility (17 sections)',
    'The default AgriAI report format covering all standard feasibility sections.',
    true,
    -- sections array populated by the app layer on first call
    '[]'::jsonb,
    ARRAY['executive_summary'],
    300
  )
  RETURNING id INTO v_new_id;

  RETURN v_new_id;
END;
$$;