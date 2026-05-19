-- Migration: Add market_research and climate_data columns to projects
-- These columns cache AI-fetched market and climate data so it doesn't need
-- to be re-fetched on every page load.

alter table public.projects
  add column if not exists market_research text,
  add column if not exists climate_data    text;
