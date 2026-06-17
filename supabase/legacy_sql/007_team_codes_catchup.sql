-- ============================================================
-- Catch-up script for 007_team_codes.sql
-- Run this if the full migration failed because join_code
-- column already existed. Safe to re-run (idempotent).
-- ============================================================


-- ════════════════════════════════════════════════════════════
-- 1. Ensure join_code column is fully set up
-- ════════════════════════════════════════════════════════════

-- Backfill any NULL join_codes
update public.hunt_teams
set join_code = public.generate_hunt_code()
where join_code is null;

-- Make NOT NULL (safe to re-run)
alter table public.hunt_teams
  alter column join_code set not null;

-- Index (IF NOT EXISTS)
create index if not exists idx_hunt_teams_join_code on public.hunt_teams(join_code);


-- ════════════════════════════════════════════════════════════
-- 2. Make email nullable on hunt_team_members
-- ════════════════════════════════════════════════════════════

-- Drop old unique constraint (safe if already dropped)
alter table public.hunt_team_members
  drop constraint if exists hunt_team_members_team_id_email_key;

-- Make email nullable
alter table public.hunt_team_members
  alter column email drop not null;

-- Add (team_id, name) unique — skip if already exists
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'hunt_team_members_team_id_name_key'
  ) then
    alter table public.hunt_team_members
      add constraint hunt_team_members_team_id_name_key unique (team_id, name);
  end if;
end $$;


-- ════════════════════════════════════════════════════════════
-- 3. Guest lookup by team code + name
-- ════════════════════════════════════════════════════════════

create or replace function public.find_guest_by_team_code(
  p_team_code text,
  p_member_name text
)
returns uuid
language sql
security definer
set search_path = ''
as $$
  select id from auth.users
  where raw_user_meta_data->>'is_guest' = 'true'
    and upper(raw_user_meta_data->>'team_code') = upper(p_team_code)
    and lower(raw_user_meta_data->>'member_name') = lower(p_member_name)
  limit 1;
$$;


-- ════════════════════════════════════════════════════════════
-- 4. Validate team code (home page pick-your-name)
-- ════════════════════════════════════════════════════════════

create or replace function public.validate_team_code(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_team record;
  v_hunt record;
  v_members jsonb;
begin
  -- Check hunt_teams.join_code
  select ht.id, ht.name, ht.hunt_id
  into v_team
  from public.hunt_teams ht
  where ht.join_code = upper(p_code);

  if v_team is not null then
    -- Get hunt name
    select h.name into v_hunt
    from public.hunts h
    where h.id = v_team.hunt_id and h.status = 'active';

    if v_hunt is null then
      return jsonb_build_object('error', 'Hunt is not active');
    end if;

    -- Get team members with joined status
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'name', htm.name,
        'joined', exists (
          select 1 from public.hunt_participants hp
          where hp.team_id = v_team.id
            and hp.user_id in (
              select au.id from auth.users au
              where au.raw_user_meta_data->>'is_guest' = 'true'
                and lower(au.raw_user_meta_data->>'member_name') = lower(htm.name)
                and upper(au.raw_user_meta_data->>'team_code') = upper(p_code)
            )
        )
      ) order by htm.created_at
    ), '[]'::jsonb)
    into v_members
    from public.hunt_team_members htm
    where htm.team_id = v_team.id;

    return jsonb_build_object(
      'type', 'team',
      'huntName', v_hunt.name,
      'teamName', v_team.name,
      'teamId', v_team.id,
      'members', v_members
    );
  end if;

  -- Check hunts.chicken_code
  select h.id, h.name
  into v_hunt
  from public.hunts h
  where h.chicken_code = upper(p_code) and h.status = 'active';

  if v_hunt is not null then
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'name', hc.name,
        'joined', exists (
          select 1 from public.hunt_participants hp
          where hp.hunt_id = v_hunt.id
            and hp.role = 'chicken'
            and hp.user_id in (
              select au.id from auth.users au
              where au.raw_user_meta_data->>'is_guest' = 'true'
                and lower(au.raw_user_meta_data->>'member_name') = lower(hc.name)
            )
        )
      ) order by hc.created_at
    ), '[]'::jsonb)
    into v_members
    from public.hunt_chickens hc
    where hc.hunt_id = v_hunt.id;

    return jsonb_build_object(
      'type', 'chicken',
      'huntName', v_hunt.name,
      'members', v_members
    );
  end if;

  return jsonb_build_object('error', 'Invalid hunt code');
end;
$$;


-- ════════════════════════════════════════════════════════════
-- 5. Updated join_hunt_by_code()
-- ════════════════════════════════════════════════════════════

-- Must drop first because the old version has p_email, and
-- Postgres won't let you rename parameters via CREATE OR REPLACE
drop function if exists public.join_hunt_by_code(text, uuid, text);

create or replace function public.join_hunt_by_code(
  p_code text,
  p_user_id uuid,
  p_member_name text default null
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
  -- 1. Check team join codes first
  select ht.hunt_id, h.name, ht.id, ht.name
  into v_hunt_id, v_hunt_name, v_team_id, v_team_name
  from public.hunt_teams ht
  join public.hunts h on h.id = ht.hunt_id
  where ht.join_code = upper(p_code)
    and h.status = 'active';

  if v_hunt_id is not null then
    v_role := 'hunter';

    insert into public.hunt_participants (hunt_id, user_id, role, team_id)
    values (v_hunt_id, p_user_id, v_role, v_team_id)
    on conflict (hunt_id, user_id) do update
      set team_id = coalesce(excluded.team_id, public.hunt_participants.team_id);

    return jsonb_build_object(
      'hunt_id', v_hunt_id,
      'hunt_name', v_hunt_name,
      'role', v_role::text,
      'team_id', v_team_id,
      'team_name', v_team_name
    );
  end if;

  -- 2. Fall back to hunt-level hunter_code
  select id, name into v_hunt_id, v_hunt_name
  from public.hunts
  where hunter_code = upper(p_code) and status = 'active';

  if v_hunt_id is not null then
    v_role := 'hunter';

    if p_member_name is not null and p_member_name <> '' then
      select ht.id, ht.name into v_team_id, v_team_name
      from public.hunt_team_members htm
      join public.hunt_teams ht on ht.id = htm.team_id
      where ht.hunt_id = v_hunt_id
        and lower(htm.name) = lower(p_member_name)
      limit 1;
    end if;

    insert into public.hunt_participants (hunt_id, user_id, role, team_id)
    values (v_hunt_id, p_user_id, v_role, v_team_id)
    on conflict (hunt_id, user_id) do update
      set team_id = coalesce(excluded.team_id, public.hunt_participants.team_id);

    return jsonb_build_object(
      'hunt_id', v_hunt_id,
      'hunt_name', v_hunt_name,
      'role', v_role::text,
      'team_id', v_team_id,
      'team_name', v_team_name
    );
  end if;

  -- 3. Fall back to hunt-level chicken_code
  select id, name into v_hunt_id, v_hunt_name
  from public.hunts
  where chicken_code = upper(p_code) and status = 'active';

  if v_hunt_id is not null then
    v_role := 'chicken';

    insert into public.hunt_participants (hunt_id, user_id, role, team_id)
    values (v_hunt_id, p_user_id, v_role, null)
    on conflict (hunt_id, user_id) do update
      set role = excluded.role;

    return jsonb_build_object(
      'hunt_id', v_hunt_id,
      'hunt_name', v_hunt_name,
      'role', v_role::text,
      'team_id', null,
      'team_name', null
    );
  end if;

  return jsonb_build_object('error', 'Invalid or expired hunt code');
end;
$$;


-- ════════════════════════════════════════════════════════════
-- 6. Reload PostgREST schema cache
-- ════════════════════════════════════════════════════════════
notify pgrst, 'reload schema';
