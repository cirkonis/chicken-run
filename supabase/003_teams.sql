-- ============================================================
-- Chicken Run - Teams System
--
-- Adds team support to hunts:
--   1) hunt_teams table (teams within a hunt)
--   2) hunt_team_members table (pre-registered members)
--   3) hunt_participants gets team_id FK
--   4) Updated join_hunt_by_code() to match email → team
--   5) RLS policies for new tables
-- ============================================================


-- ════════════════════════════════════════════════════════════
-- 1. NEW TABLES
-- ════════════════════════════════════════════════════════════

-- ── Hunt Teams ────────────────────────────────────────────
create table public.hunt_teams (
  id            uuid primary key default gen_random_uuid(),
  hunt_id       uuid not null references public.hunts(id) on delete cascade,
  name          text not null,
  renamed       boolean not null default false,
  display_order int not null default 0,
  created_at    timestamptz not null default now()
);

create index idx_hunt_teams_hunt on public.hunt_teams(hunt_id);

-- ── Hunt Team Members (pre-registered by host) ───────────
create table public.hunt_team_members (
  id         uuid primary key default gen_random_uuid(),
  team_id    uuid not null references public.hunt_teams(id) on delete cascade,
  name       text not null,
  email      text not null,
  created_at timestamptz not null default now(),
  unique(team_id, email)
);

create index idx_hunt_team_members_team on public.hunt_team_members(team_id);
create index idx_hunt_team_members_email on public.hunt_team_members(email);


-- ════════════════════════════════════════════════════════════
-- 2. ALTER EXISTING TABLES
-- ════════════════════════════════════════════════════════════

-- Add team_id to hunt_participants (nullable — creator has no team)
alter table public.hunt_participants
  add column team_id uuid references public.hunt_teams(id) on delete set null;

create index idx_hunt_participants_team on public.hunt_participants(team_id);


-- ════════════════════════════════════════════════════════════
-- 3. ENABLE RLS
-- ════════════════════════════════════════════════════════════

alter table public.hunt_teams enable row level security;
alter table public.hunt_team_members enable row level security;


-- ════════════════════════════════════════════════════════════
-- 4. RLS POLICIES
-- ════════════════════════════════════════════════════════════

-- ── Hunt Teams policies ──────────────────────────────────

-- Participants can view teams in their hunt
create policy "Participants can view hunt teams"
  on public.hunt_teams for select using (
    public.is_hunt_participant(hunt_id)
  );

-- Creators can insert teams
create policy "Creators can insert hunt teams"
  on public.hunt_teams for insert with check (
    exists (
      select 1 from public.hunts h
      where h.id = hunt_id and h.creator_id = auth.uid()
    )
  );

-- Creators can update teams (for editing hunt)
-- OR any participant on that team can rename (if not yet renamed)
create policy "Teams can be updated"
  on public.hunt_teams for update using (
    -- Creator can always update
    exists (
      select 1 from public.hunts h
      where h.id = hunt_id and h.creator_id = auth.uid()
    )
    or
    -- Team member can rename (only if not yet renamed)
    (
      not renamed
      and exists (
        select 1 from public.hunt_participants hp
        where hp.team_id = id and hp.user_id = auth.uid()
      )
    )
  );

-- Creators can delete teams
create policy "Creators can delete hunt teams"
  on public.hunt_teams for delete using (
    exists (
      select 1 from public.hunts h
      where h.id = hunt_id and h.creator_id = auth.uid()
    )
  );

-- ── Hunt Team Members policies ───────────────────────────

-- Participants can view team members (need to join through hunt_teams)
create policy "Participants can view team members"
  on public.hunt_team_members for select using (
    exists (
      select 1 from public.hunt_teams ht
      where ht.id = team_id
        and public.is_hunt_participant(ht.hunt_id)
    )
  );

-- Creators can insert team members
create policy "Creators can insert team members"
  on public.hunt_team_members for insert with check (
    exists (
      select 1 from public.hunt_teams ht
      join public.hunts h on h.id = ht.hunt_id
      where ht.id = team_id and h.creator_id = auth.uid()
    )
  );

-- Creators can update team members
create policy "Creators can update team members"
  on public.hunt_team_members for update using (
    exists (
      select 1 from public.hunt_teams ht
      join public.hunts h on h.id = ht.hunt_id
      where ht.id = team_id and h.creator_id = auth.uid()
    )
  );

-- Creators can delete team members
create policy "Creators can delete team members"
  on public.hunt_team_members for delete using (
    exists (
      select 1 from public.hunt_teams ht
      join public.hunts h on h.id = ht.hunt_id
      where ht.id = team_id and h.creator_id = auth.uid()
    )
  );


-- ════════════════════════════════════════════════════════════
-- 5. UPDATE join_hunt_by_code() FUNCTION
-- ════════════════════════════════════════════════════════════

-- New signature: adds optional p_email parameter.
-- When p_email is provided, looks up hunt_team_members to find
-- the matching team and sets team_id on the participant row.
create or replace function public.join_hunt_by_code(
  p_code text,
  p_user_id uuid,
  p_email text default null
)
returns jsonb
language plpgsql
security definer set search_path = ''
as $$
declare
  v_hunt_id uuid;
  v_hunt_name text;
  v_role public.participant_role;
  v_team_id uuid;
  v_team_name text;
begin
  -- Check hunter_code first
  select id, name into v_hunt_id, v_hunt_name
  from public.hunts
  where hunter_code = upper(p_code) and status = 'active';

  if v_hunt_id is not null then
    v_role := 'hunter';
  else
    -- Check chicken_code
    select id, name into v_hunt_id, v_hunt_name
    from public.hunts
    where chicken_code = upper(p_code) and status = 'active';

    if v_hunt_id is not null then
      v_role := 'chicken';
    end if;
  end if;

  if v_hunt_id is null then
    return jsonb_build_object('error', 'Invalid or expired hunt code');
  end if;

  -- If email provided, try to match to a team member
  if p_email is not null and p_email <> '' then
    select ht.id, ht.name into v_team_id, v_team_name
    from public.hunt_team_members htm
    join public.hunt_teams ht on ht.id = htm.team_id
    where ht.hunt_id = v_hunt_id
      and lower(htm.email) = lower(p_email)
    limit 1;
  end if;

  -- Upsert participant (idempotent join)
  insert into public.hunt_participants (hunt_id, user_id, role, team_id)
  values (v_hunt_id, p_user_id, v_role, v_team_id)
  on conflict (hunt_id, user_id) do update set team_id = coalesce(excluded.team_id, public.hunt_participants.team_id);

  return jsonb_build_object(
    'hunt_id', v_hunt_id,
    'hunt_name', v_hunt_name,
    'role', v_role::text,
    'team_id', v_team_id,
    'team_name', v_team_name
  );
end;
$$;
