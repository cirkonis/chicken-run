-- ============================================================
-- Fix: RLS infinite recursion on hunt_participants
--
-- Problem: hunt_participants SELECT policy queries hunt_participants
--          to check membership → infinite recursion.
--
-- Solution: Security-definer function that bypasses RLS to check
--           membership, used by all policies that need "is this
--           user a participant in this hunt?"
-- ============================================================

-- 1. Create the helper function (bypasses RLS)
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
  );
$$;

-- 2. Drop all the broken policies
drop policy if exists "Participants can view joined hunts" on public.hunts;
drop policy if exists "Participants can view hunt members" on public.hunt_participants;
drop policy if exists "Participants can view hunt bars" on public.hunt_bars;
drop policy if exists "Participants can add bars" on public.hunt_bars;
drop policy if exists "Participants can update bar status" on public.hunt_bars;
drop policy if exists "Participants can view hunt hints" on public.hints;
drop policy if exists "Participants can add hints" on public.hints;

-- 3. Recreate them using the safe helper function

-- Hunts: participants can view hunts they've joined
create policy "Participants can view joined hunts"
  on public.hunts for select using (
    public.is_hunt_participant(id)
  );

-- Hunt Participants: you can see members of hunts you're in
create policy "Participants can view hunt members"
  on public.hunt_participants for select using (
    public.is_hunt_participant(hunt_id)
  );

-- Hunt Bars: participants can view, add, and update bars
create policy "Participants can view hunt bars"
  on public.hunt_bars for select using (
    public.is_hunt_participant(hunt_id)
  );

create policy "Participants can add bars"
  on public.hunt_bars for insert with check (
    public.is_hunt_participant(hunt_id)
  );

create policy "Participants can update bar status"
  on public.hunt_bars for update using (
    public.is_hunt_participant(hunt_id)
  );

-- Hints: participants can view and add hints
create policy "Participants can view hunt hints"
  on public.hints for select using (
    public.is_hunt_participant(hunt_id)
  );

create policy "Participants can add hints"
  on public.hints for insert with check (
    public.is_hunt_participant(hunt_id)
  );
