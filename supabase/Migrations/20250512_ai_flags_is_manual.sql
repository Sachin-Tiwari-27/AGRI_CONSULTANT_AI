-- ── Migration: add is_manual to ai_flags ─────────────────────────────
-- Distinguishes AI-detected gaps (is_manual = false) from flags added
-- manually by the consultant (is_manual = true).
-- Default false so existing rows (all AI-generated) are correctly labelled.

ALTER TABLE public.ai_flags
  ADD COLUMN IF NOT EXISTS is_manual boolean NOT NULL DEFAULT false;
