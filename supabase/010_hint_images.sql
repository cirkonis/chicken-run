-- Migration 010: Add image support to hints + per-hunt storage tracking
-- ═══════════════════════════════════════════════════════════════════

-- 1. Nullable image_path on hints (storage path like hints/{huntId}/{hintId}.jpg)
ALTER TABLE public.hints
  ADD COLUMN IF NOT EXISTS image_path text DEFAULT NULL;

-- 2. Per-hunt storage counter for quota enforcement (50MB default limit)
ALTER TABLE public.hunts
  ADD COLUMN IF NOT EXISTS storage_used_bytes bigint NOT NULL DEFAULT 0;

-- 3. Nullable image_path on hunt_arrivals (storage path like arrivals/{huntId}/{arrivalId}.jpg)
ALTER TABLE public.hunt_arrivals
  ADD COLUMN IF NOT EXISTS image_path text DEFAULT NULL;

-- 4. Optional note on hunt_arrivals (short message from the chickens)
ALTER TABLE public.hunt_arrivals
  ADD COLUMN IF NOT EXISTS note text NOT NULL DEFAULT '';
