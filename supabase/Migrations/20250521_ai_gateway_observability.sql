-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: AI gateway observability columns
-- Run AFTER all previous migrations.
--
-- Adds columns to ai_usage_log that the new gateway populates:
--   request_id        — UUID per gateway call, links log rows to traces
--   model_intended    — the primary model that was planned for this task
--   model (existing)  — now renamed semantically to model_used in the app layer
--   degraded          — true when a fallback model was used
--   fallback_chain    — ordered list of models that were attempted
--   estimated_cost_usd — computed from token counts × model pricing table
--   cache_hit         — true for data cache hits (climate / market)
--   error_type        — error class name when all models were exhausted
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.ai_usage_log
  ADD COLUMN IF NOT EXISTS request_id          text,
  ADD COLUMN IF NOT EXISTS model_intended      text,
  ADD COLUMN IF NOT EXISTS degraded            boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS fallback_chain      text[],
  ADD COLUMN IF NOT EXISTS estimated_cost_usd  numeric(10, 6),
  ADD COLUMN IF NOT EXISTS cache_hit           boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS error_type          text;

-- Index for cost reporting by project
CREATE INDEX IF NOT EXISTS ai_usage_log_project_cost_idx
  ON public.ai_usage_log (project_id, estimated_cost_usd)
  WHERE project_id IS NOT NULL;

-- Index for degradation monitoring
CREATE INDEX IF NOT EXISTS ai_usage_log_degraded_idx
  ON public.ai_usage_log (degraded, created_at DESC)
  WHERE degraded = true;

-- Index for request tracing
CREATE INDEX IF NOT EXISTS ai_usage_log_request_id_idx
  ON public.ai_usage_log (request_id)
  WHERE request_id IS NOT NULL;

-- ── Convenience view: cost summary per project ────────────────────────────────
-- Useful for billing dashboards and per-project AI spend reports.

CREATE OR REPLACE VIEW public.ai_cost_by_project AS
SELECT
  project_id,
  COUNT(*)                                    AS total_requests,
  SUM(tokens_used)                            AS total_tokens,
  ROUND(SUM(estimated_cost_usd)::numeric, 4)  AS total_cost_usd,
  SUM(CASE WHEN degraded    THEN 1 ELSE 0 END) AS degraded_requests,
  SUM(CASE WHEN cache_hit   THEN 1 ELSE 0 END) AS cache_hits,
  SUM(CASE WHEN error_type IS NOT NULL THEN 1 ELSE 0 END) AS failed_requests,
  MAX(created_at)                             AS last_request_at
FROM public.ai_usage_log
WHERE project_id IS NOT NULL
GROUP BY project_id;

-- ── Convenience view: model health monitor ────────────────────────────────────
-- Shows failure and degradation rates per model over the last 24 hours.
-- Useful for identifying models that are consistently causing fallbacks.

CREATE OR REPLACE VIEW public.ai_model_health AS
SELECT
  model                                                         AS model_used,
  COUNT(*)                                                      AS total_requests,
  SUM(CASE WHEN degraded         THEN 1 ELSE 0 END)             AS times_used_as_fallback,
  SUM(CASE WHEN error_type IS NOT NULL THEN 1 ELSE 0 END)       AS failures,
  ROUND(
    100.0 * SUM(CASE WHEN error_type IS NOT NULL THEN 1 ELSE 0 END)
    / NULLIF(COUNT(*), 0), 2
  )                                                             AS failure_rate_pct,
  ROUND(AVG(duration_ms))                                       AS avg_duration_ms,
  ROUND(AVG(tokens_used))                                       AS avg_tokens
FROM public.ai_usage_log
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY model
ORDER BY failure_rate_pct DESC NULLS LAST;
