-- ============================================================
-- Chicken Run - Chickens Pre-registration
--
-- Adds chicken pre-registration to hunts:
--   1) hunt_chickens table (pre-registered chicken players)
--   2) RLS policies for the new table
--
-- Chickens are individual prey players (not part of teams).
-- Hosts pre-register them with name + email, same pattern as
-- hunt_team_members but directly under hunts.
-- ============================================================


-- ════════════════════════════════════════════════════════════
-- 1. NEW TABLE
-- ════════════════════════════════════════════════════════════

create table public.hunt_chickens (
  id         uuid primary key default gen_random_uuid(),
  hunt_id    uuid not null references public.hunts(id) on delete cascade,
  name       text not null,
  email      text not null,
  created_at timestamptz not null default now(),
  unique(hunt_id, email)
);

create index idx_hunt_chickens_hunt on public.hunt_chickens(hunt_id);
create index idx_hunt_chickens_email on public.hunt_chickens(email);


-- ════════════════════════════════════════════════════════════
-- 2. ENABLE RLS
-- ════════════════════════════════════════════════════════════

alter table public.hunt_chickens enable row level security;


-- ════════════════════════════════════════════════════════════
-- 3. RLS POLICIES
-- ════════════════════════════════════════════════════════════

-- Participants can view chickens in their hunt
create policy "Participants can view hunt chickens"
  on public.hunt_chickens for select using (
    public.is_hunt_participant(hunt_id)
  );

-- Creators can insert chickens
create policy "Creators can insert hunt chickens"
  on public.hunt_chickens for insert with check (
    exists (
      select 1 from public.hunts h
      where h.id = hunt_id and h.creator_id = auth.uid()
    )
  );

-- Creators can update chickens
create policy "Creators can update hunt chickens"
  on public.hunt_chickens for update using (
    exists (
      select 1 from public.hunts h
      where h.id = hunt_id and h.creator_id = auth.uid()
    )
  );

-- Creators can delete chickens
create policy "Creators can delete hunt chickens"
  on public.hunt_chickens for delete using (
    exists (
      select 1 from public.hunts h
      where h.id = hunt_id and h.creator_id = auth.uid()
    )
  );
