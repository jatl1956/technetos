-- Migration 006 — Fase E.1: deterministic historical resume
--
-- Codex v10 P1 caught that Fase E only persists scenario_index and
-- last_tick_index. But HistoricalData.prepareSeries() also randomizes:
--   - the source ticker (when scenarioIndex is null)
--   - the start row inside the CSV (Math.random())
--   - whether to mirror the series (30% chance)
--   - the targetPrice the series is scaled to (when not provided)
--
-- After a refresh, resumeSession() with only scenario_index would
-- regenerate a DIFFERENT series and then fast-forward to last_tick_index,
-- so students would see candles that are not the ones they saw before.
--
-- This migration adds the replay identity fields so resume can reconstruct
-- the exact same series bit-for-bit:
--   source_key   — which ticker was actually picked (for random scenarios)
--   start_day    — startDay row inside the raw CSV
--   mirror       — whether the series was mirrored
--   target_price — the price the series was scaled to

ALTER TABLE rooms ADD COLUMN IF NOT EXISTS source_key text;
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS start_day integer;
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS mirror boolean;
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS target_price numeric;
