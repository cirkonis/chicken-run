-- ============================================================================
-- Co-managers (issue #4)
--
-- Goal: let a hunt's creator share management with another SIGNED-UP account.
-- Until now "who can manage a hunt" was hard-coded everywhere as
-- `creator_id = auth.uid()`. This migration introduces a small join table
-- (hunt_managers) and a helper function (is_hunt_manager) and swaps the
-- creator-only RLS policies over to it.
--
-- Permission model (decided with the owner): "content parity, owner keeps
-- ownership". A co-manager can manage everything INSIDE a hunt (bars, teams,
-- members, chickens, hints, expenses, arrivals, check-ins, status, details).
-- Only the original creator may DELETE the whole hunt or change the co-manager
-- list — those stay creator-only (see the hunts delete policy + the managers
-- endpoints, which are guarded in application code).
--
-- This file only ADDS objects and REPLACES policies/functions by name; it never
-- edits the baseline. The dropped policy names match the baseline exactly, so
-- `db push` applies cleanly on prod too.
-- ============================================================================


-- ════════════════════════════════════════════════════════════════════════════
-- 1. hunt_managers table
-- ════════════════════════════════════════════════════════════════════════════
-- One row per (hunt, co-manager). The creator is NOT stored here — they're
-- always a manager implicitly (see is_hunt_manager). added_by records who
-- granted access (always the creator for now).
create table if not exists public.hunt_managers (
  id         uuid primary key default gen_random_uuid(),
  hunt_id    uuid not null references public.hunts(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  added_by   uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (hunt_id, user_id)
);

create index if not exists idx_hunt_managers_hunt on public.hunt_managers(hunt_id);
create index if not exists idx_hunt_managers_user on public.hunt_managers(user_id);

-- Data API grants (mirrors 20260615000002). RLS still restricts which rows each
-- role can touch; these just allow the table to be addressed at all.
grant all on public.hunt_managers to anon, authenticated, service_role;

alter table public.hunt_managers enable row level security;


-- ════════════════════════════════════════════════════════════════════════════
-- 2. Helper functions
-- ════════════════════════════════════════════════════════════════════════════

-- is_hunt_manager(): the new load-bearing check. True if the caller is the
-- hunt's creator OR has been added as a co-manager. SECURITY DEFINER + empty
-- search_path so it can read these tables without tripping RLS recursion (same
-- pattern as is_hunt_participant).
create or replace function public.is_hunt_manager(p_hunt_id uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.hunts
    where id = p_hunt_id and creator_id = auth.uid()
  )
  or exists (
    select 1 from public.hunt_managers
    where hunt_id = p_hunt_id and user_id = auth.uid()
  );
$$;

-- Extend is_hunt_participant() so co-managers can VIEW everything participants
-- can (the "Participants can view ..." SELECT policies call this). Identical to
-- the baseline definition plus a third branch for hunt_managers.
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
  )
  or exists (
    select 1 from public.hunt_managers
    where hunt_id = p_hunt_id and user_id = auth.uid()
  );
$$;

-- Resolve an email to a real (non-guest) account, so a creator can add a
-- co-manager by email. Returns the profile id + display name, or no rows.
-- SECURITY DEFINER so it can read auth.users; locked to the server's
-- service_role (below) to avoid letting clients enumerate which emails exist.
create or replace function public.find_account_by_email(p_email text)
returns table (id uuid, display_name text)
language sql
security definer
stable
set search_path = ''
as $$
  select p.id, p.display_name
  from auth.users u
  join public.profiles p on p.id = u.id
  where lower(u.email) = lower(trim(p_email))
    and coalesce(u.raw_user_meta_data ->> 'is_guest', 'false') <> 'true'
  limit 1;
$$;

revoke all on function public.find_account_by_email(text) from public, anon, authenticated;
grant execute on function public.find_account_by_email(text) to service_role;


-- ════════════════════════════════════════════════════════════════════════════
-- 3. RLS policies on hunt_managers
-- ════════════════════════════════════════════════════════════════════════════
-- Managers (incl. the creator) may read the list. Only the creator may add or
-- remove rows. Server endpoints use the service-role client (which bypasses
-- RLS) and re-check creator-ownership in code; these policies harden any
-- direct Data API / GraphQL access.
drop policy if exists "Managers can view manager list" on public.hunt_managers;
create policy "Managers can view manager list"
  on public.hunt_managers for select using (public.is_hunt_manager(hunt_id));

drop policy if exists "Owner can add managers" on public.hunt_managers;
create policy "Owner can add managers"
  on public.hunt_managers for insert with check (
    exists (select 1 from public.hunts h where h.id = hunt_id and h.creator_id = auth.uid())
  );

drop policy if exists "Owner can remove managers" on public.hunt_managers;
create policy "Owner can remove managers"
  on public.hunt_managers for delete using (
    exists (select 1 from public.hunts h where h.id = hunt_id and h.creator_id = auth.uid())
  );


-- ════════════════════════════════════════════════════════════════════════════
-- 4. Swap creator-only policies → is_hunt_manager()
--
-- Each block drops the baseline policy (by its exact name) and recreates it
-- with the manager check. Logic is otherwise copied verbatim from the baseline.
-- ════════════════════════════════════════════════════════════════════════════

-- ── hunts ───────────────────────────────────────────────────────────────────
-- The baseline had one "for all" policy. We split it: managers can UPDATE;
-- only the owner may INSERT (you create your own) or DELETE (don't let a
-- co-host nuke the hunt). SELECT is covered by "Participants can view joined
-- hunts" (is_hunt_participant now includes managers).
drop policy if exists "Creators can manage own hunts" on public.hunts;

drop policy if exists "Owner can insert hunts" on public.hunts;
create policy "Owner can insert hunts"
  on public.hunts for insert with check (auth.uid() = creator_id);

drop policy if exists "Managers can update hunts" on public.hunts;
create policy "Managers can update hunts"
  on public.hunts for update
  using (public.is_hunt_manager(id))
  with check (public.is_hunt_manager(id));

drop policy if exists "Owner can delete hunts" on public.hunts;
create policy "Owner can delete hunts"
  on public.hunts for delete using (auth.uid() = creator_id);

-- ── hunt_bars ───────────────────────────────────────────────────────────────
drop policy if exists "Creators can delete hunt bars" on public.hunt_bars;
create policy "Managers can delete hunt bars"
  on public.hunt_bars for delete using (public.is_hunt_manager(hunt_id));

-- ── hunt_teams ──────────────────────────────────────────────────────────────
drop policy if exists "Creators can insert hunt teams" on public.hunt_teams;
create policy "Managers can insert hunt teams"
  on public.hunt_teams for insert with check (public.is_hunt_manager(hunt_id));

-- Manager can always update; a team member may still rename their team once.
drop policy if exists "Teams can be updated" on public.hunt_teams;
create policy "Teams can be updated"
  on public.hunt_teams for update using (
    public.is_hunt_manager(hunt_id)
    or (
      not renamed
      and exists (
        select 1 from public.hunt_participants hp
        where hp.team_id = id and hp.user_id = auth.uid()
      )
    )
  );

drop policy if exists "Creators can delete hunt teams" on public.hunt_teams;
create policy "Managers can delete hunt teams"
  on public.hunt_teams for delete using (public.is_hunt_manager(hunt_id));

-- ── hunt_participants ───────────────────────────────────────────────────────
drop policy if exists "Creators can manage participants" on public.hunt_participants;
create policy "Managers can manage participants"
  on public.hunt_participants for delete using (public.is_hunt_manager(hunt_id));

-- ── hunt_team_members ───────────────────────────────────────────────────────
drop policy if exists "Creators can insert team members" on public.hunt_team_members;
create policy "Managers can insert team members"
  on public.hunt_team_members for insert with check (
    exists (
      select 1 from public.hunt_teams ht
      where ht.id = team_id and public.is_hunt_manager(ht.hunt_id)
    )
  );

drop policy if exists "Creators can update team members" on public.hunt_team_members;
create policy "Managers can update team members"
  on public.hunt_team_members for update using (
    exists (
      select 1 from public.hunt_teams ht
      where ht.id = team_id and public.is_hunt_manager(ht.hunt_id)
    )
  );

drop policy if exists "Creators can delete team members" on public.hunt_team_members;
create policy "Managers can delete team members"
  on public.hunt_team_members for delete using (
    exists (
      select 1 from public.hunt_teams ht
      where ht.id = team_id and public.is_hunt_manager(ht.hunt_id)
    )
  );

-- ── hunt_chickens (legacy) ──────────────────────────────────────────────────
drop policy if exists "Creators can insert hunt chickens" on public.hunt_chickens;
create policy "Managers can insert hunt chickens"
  on public.hunt_chickens for insert with check (public.is_hunt_manager(hunt_id));

drop policy if exists "Creators can update hunt chickens" on public.hunt_chickens;
create policy "Managers can update hunt chickens"
  on public.hunt_chickens for update using (public.is_hunt_manager(hunt_id));

drop policy if exists "Creators can delete hunt chickens" on public.hunt_chickens;
create policy "Managers can delete hunt chickens"
  on public.hunt_chickens for delete using (public.is_hunt_manager(hunt_id));

-- ── hints ───────────────────────────────────────────────────────────────────
drop policy if exists "Creators can delete hints" on public.hints;
create policy "Managers can delete hints"
  on public.hints for delete using (public.is_hunt_manager(hunt_id));

-- ── hunt_expenses ───────────────────────────────────────────────────────────
drop policy if exists "Chickens and creator can add expenses" on public.hunt_expenses;
create policy "Chickens and managers can add expenses"
  on public.hunt_expenses for insert with check (
    exists (
      select 1 from public.hunt_participants hp
      where hp.hunt_id = hunt_expenses.hunt_id and hp.user_id = auth.uid() and hp.role = 'chicken'
    )
    or public.is_hunt_manager(hunt_expenses.hunt_id)
  );

drop policy if exists "Expense author or creator can delete" on public.hunt_expenses;
create policy "Expense author or manager can delete"
  on public.hunt_expenses for delete using (
    created_by = auth.uid()
    or public.is_hunt_manager(hunt_expenses.hunt_id)
  );

-- ── hunt_arrivals ───────────────────────────────────────────────────────────
drop policy if exists "Chickens and creator can add arrivals" on public.hunt_arrivals;
create policy "Chickens and managers can add arrivals"
  on public.hunt_arrivals for insert with check (
    exists (
      select 1 from public.hunt_participants hp
      where hp.hunt_id = hunt_arrivals.hunt_id and hp.user_id = auth.uid() and hp.role = 'chicken'
    )
    or public.is_hunt_manager(hunt_arrivals.hunt_id)
  );

drop policy if exists "Chickens and creator can delete arrivals" on public.hunt_arrivals;
create policy "Chickens and managers can delete arrivals"
  on public.hunt_arrivals for delete using (
    exists (
      select 1 from public.hunt_participants hp
      where hp.hunt_id = hunt_arrivals.hunt_id and hp.user_id = auth.uid() and hp.role = 'chicken'
    )
    or public.is_hunt_manager(hunt_arrivals.hunt_id)
  );

-- ── hunt_check_ins ──────────────────────────────────────────────────────────
drop policy if exists "check_ins_delete" on public.hunt_check_ins;
create policy "check_ins_delete" on public.hunt_check_ins
  for delete using (public.is_hunt_manager(hunt_id));
