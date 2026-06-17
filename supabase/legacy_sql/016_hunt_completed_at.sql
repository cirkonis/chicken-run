-- Migration 016: Add completed_at timestamp to hunts for 90-day auto-cleanup

ALTER TABLE public.hunts ADD COLUMN completed_at timestamptz;

-- Backfill: existing completed hunts get completed_at = updated_at
UPDATE public.hunts SET completed_at = updated_at WHERE status = 'completed';
