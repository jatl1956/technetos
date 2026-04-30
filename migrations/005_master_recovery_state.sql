-- Migration 005 — Fase E: master refresh recovery state
--
-- Adds the minimum room state needed to rehydrate the master after a
-- browser refresh / accidental tab close. The master persists this state
-- every 5 ticks (~3 seconds) during an active simulation.
--
-- Recovery strategy:
--   - data_mode='historical' + scenario_index + last_tick_index =>
--     deterministic resume (HistoricalData fast-forwards to the same candle)
--   - data_mode='gbm' + last_close => resume continues from last_close as
--     the new initial price (GBM ticks are random; bit-perfect replay
--     would require persisting every candle, which is overkill).
--
-- last_tick_at lets the lobby decide whether a stalled session is
-- actually resumable or has been abandoned for too long.

ALTER TABLE rooms ADD COLUMN IF NOT EXISTS last_tick_index integer NOT NULL DEFAULT 0;
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS last_close numeric;
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS data_mode text NOT NULL DEFAULT 'historical';
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS scenario_index integer;
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS last_tick_at timestamptz;

-- Helpful index for getResumableRoom() lookups: master_id + status + last_tick_at
CREATE INDEX IF NOT EXISTS rooms_master_status_idx
  ON rooms (master_id, status)
  WHERE status IN ('active', 'paused');

-- Optional CHECK to document valid data_mode values; commented out so it
-- doesn't fail if the project has stricter rules already.
-- ALTER TABLE rooms ADD CONSTRAINT rooms_data_mode_chk
--   CHECK (data_mode IN ('historical', 'gbm'));
