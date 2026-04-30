-- Migration 004: Complete participant state for refresh recovery (Fase D)
--
-- Adds columns needed to fully reconstruct a student's portfolio after
-- a browser refresh, in addition to the existing cash, shares, avg_cost,
-- short_shares, short_avg_cost, realized_pnl, total_commissions, accrued_interest.

-- accrued_margin_interest: previously tracked only locally; now persisted
-- so refresh does not reset it to 0 mid-session.
ALTER TABLE participants
  ADD COLUMN IF NOT EXISTS accrued_margin_interest numeric NOT NULL DEFAULT 0;

-- last_seen_tick: last simulation tick the student saw before refreshing.
-- Used by student.html to know how far they were when reconnecting.
-- Optional: helpful for showing "Resumed at tick N" UX.
ALTER TABLE participants
  ADD COLUMN IF NOT EXISTS last_seen_tick integer NOT NULL DEFAULT 0;

-- Make is_connected default to true on insert (joinRoom). Already the
-- intent of the code, but the DB default was likely false. This avoids
-- a brief OFFLINE flicker right after joining.
ALTER TABLE participants
  ALTER COLUMN is_connected SET DEFAULT true;
