-- Migration 003: Make room status start as 'waiting' until master clicks START
-- Previously the DB default may have been 'active', which caused students who
-- joined before START to enter the simulation screen prematurely.
--
-- The application code (room-manager.js > createRoom) now sets status='waiting'
-- explicitly on insert. This migration aligns the column default for safety.

ALTER TABLE rooms ALTER COLUMN status SET DEFAULT 'waiting';

-- Optional: document the valid values via a CHECK constraint
-- Run only if you don't already have one.
-- ALTER TABLE rooms ADD CONSTRAINT rooms_status_chk
--   CHECK (status IN ('waiting', 'active', 'paused', 'completed', 'deleted'));
