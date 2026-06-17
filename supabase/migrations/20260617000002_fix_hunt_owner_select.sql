-- ============================================================================
-- Fix: hunt creation broke after 20260617000001 (a co-managers regression)
--
-- Symptom: creating a hunt fails with
--   "new row violates row-level security policy for table \"hunts\"".
--
-- Cause: the baseline policy "Creators can manage own hunts" was
--   FOR ALL USING (auth.uid() = creator_id)
-- whose USING also covered SELECT, checking the row's creator_id COLUMN
-- directly. 20260617000001 split that into separate INSERT/UPDATE/DELETE
-- policies and left SELECT to "Participants can view joined hunts"
-- (USING is_hunt_participant(id)).
--
-- is_hunt_participant() is STABLE + SECURITY DEFINER and RE-QUERIES the hunts
-- table. During `INSERT ... RETURNING` (our create-hunt endpoint does
-- `.insert(...).select()`) the just-inserted row isn't in that function's
-- snapshot yet, so it returns false and Postgres blocks the RETURNING as an RLS
-- violation. The old FOR ALL policy never hit this because it read the new
-- row's column directly instead of re-querying.
--
-- Fix: restore a direct-column SELECT policy for the owner. It's correct in its
-- own right (an owner can always see their own hunts) and makes INSERT ...
-- RETURNING work again. Co-managers still view via is_hunt_participant (those
-- rows already exist, so the re-query sees them).
-- ============================================================================
drop policy if exists "Owner can view own hunts" on public.hunts;
create policy "Owner can view own hunts"
  on public.hunts for select using (auth.uid() = creator_id);
