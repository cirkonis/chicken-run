-- Migration 013: Hunt lifecycle (preparing -> active -> completed)
--
-- Adds proper hunt status lifecycle:
--   'preparing' = host is setting up (default for new hunts)
--   'active'    = hunt is running, config locked
--   'completed' = hunt is over
--
-- Also adds started_at timestamp to track when the hunt was started.

-- 1. Drop old check constraint, add new one with 'preparing'
ALTER TABLE public.hunts DROP CONSTRAINT IF EXISTS hunts_status_check;
ALTER TABLE public.hunts
  ADD CONSTRAINT hunts_status_check CHECK (status IN ('preparing', 'active', 'completed'));

-- 2. Change default from 'active' to 'preparing'
ALTER TABLE public.hunts ALTER COLUMN status SET DEFAULT 'preparing';

-- 3. Add started_at timestamp (null until hunt is started)
ALTER TABLE public.hunts
  ADD COLUMN IF NOT EXISTS started_at timestamptz DEFAULT NULL;

-- 4. Backfill: any existing 'active' hunts get started_at = created_at
UPDATE public.hunts SET started_at = created_at WHERE status = 'active' AND started_at IS NULL;
