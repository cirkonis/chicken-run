-- ============================================================
-- Chicken Run - Creators are NOT auto-added as participants
--
-- Previously, hunt creators were inserted into hunt_participants
-- with role='creator' at creation time. This inflated hunter counts.
--
-- Fix:
--   1) Update is_hunt_participant() to also check hunts.creator_id
--      so creators keep full RLS access without a participant row.
--   2) Remove existing creator participant rows (cleanup).
-- ============================================================

-- 1. Update the RLS helper so creators pass the participant check
--    without needing a row in hunt_participants.
create or replace function public.is_hunt_participant(p_hunt_id uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.hunt_participants
    where hunt_id = p_hunt_id and user_id = auth.uid()
  )
  or exists (
    select 1 from public.hunts
    where id = p_hunt_id and creator_id = auth.uid()
  );
$$;

-- 2. Remove existing creator participant rows.
--    They are no longer needed for RLS access.
delete from public.hunt_participants where role = 'creator';
