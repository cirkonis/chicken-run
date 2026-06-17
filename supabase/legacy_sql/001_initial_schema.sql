-- ============================================================
-- Chicken Run - Full Supabase Schema
-- Run this in your Supabase SQL Editor (supabase dashboard)
--
-- Structure: 1) Extensions  2) ALL tables  3) ALL RLS policies
--            4) Triggers    5) Functions
-- (avoids circular-dependency errors between tables & policies)
-- ============================================================


-- ════════════════════════════════════════════════════════════
-- 1. EXTENSIONS
-- ════════════════════════════════════════════════════════════
create extension if not exists "pgcrypto";
create extension if not exists "moddatetime" schema extensions;


-- ════════════════════════════════════════════════════════════
-- 2. HELPER FUNCTIONS (needed by table defaults)
-- ════════════════════════════════════════════════════════════

-- Generate a random 6-char uppercase alphanumeric code
-- (no I/O/0/1 to avoid confusion)
create or replace function public.generate_hunt_code()
returns text
language plpgsql
as $$
declare
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result text := '';
  i int;
begin
  for i in 1..6 loop
    result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  end loop;
  return result;
end;
$$;


-- ════════════════════════════════════════════════════════════
-- 3. ALL TABLES (no RLS policies yet)
-- ════════════════════════════════════════════════════════════

-- ── Profiles ────────────────────────────────────────────────
create table public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  avatar_url   text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ── Participant role enum ───────────────────────────────────
create type public.participant_role as enum ('creator', 'hunter', 'chicken');

-- ── Hunts ───────────────────────────────────────────────────
create table public.hunts (
  id            uuid primary key default gen_random_uuid(),
  creator_id    uuid not null references public.profiles(id) on delete cascade,
  name          text not null default 'Unnamed Hunt',
  hunter_code   text not null unique default public.generate_hunt_code(),
  chicken_code  text not null unique default public.generate_hunt_code(),
  center_lat    double precision not null,
  center_lng    double precision not null,
  radius_meters int not null default 1500,
  status        text not null default 'active' check (status in ('active', 'completed', 'archived')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ── Hunt Participants ───────────────────────────────────────
create table public.hunt_participants (
  id        uuid primary key default gen_random_uuid(),
  hunt_id   uuid not null references public.hunts(id) on delete cascade,
  user_id   uuid not null references public.profiles(id) on delete cascade,
  role      public.participant_role not null default 'hunter',
  joined_at timestamptz not null default now(),
  unique(hunt_id, user_id)
);

-- ── Hunt Bars ───────────────────────────────────────────────
create table public.hunt_bars (
  id              uuid primary key default gen_random_uuid(),
  hunt_id         uuid not null references public.hunts(id) on delete cascade,
  place_id        text not null,
  name            text not null,
  address         text not null default '',
  lat             double precision not null,
  lng             double precision not null,
  rating          double precision,
  ratings_total   int,
  price_level     int,
  business_status text,
  maps_url        text not null default '',
  category        text not null default 'bar',
  check_status    text not null default 'unchecked' check (check_status in ('unchecked', 'checked', 'not_checking')),
  checked_by      uuid references public.profiles(id),
  checked_at      timestamptz,
  created_at      timestamptz not null default now(),
  unique(hunt_id, place_id)
);

-- ── Hints ───────────────────────────────────────────────────
create table public.hints (
  id         uuid primary key default gen_random_uuid(),
  hunt_id    uuid not null references public.hunts(id) on delete cascade,
  author_id  uuid not null references public.profiles(id) on delete cascade,
  text       text not null,
  created_at timestamptz not null default now()
);


-- ════════════════════════════════════════════════════════════
-- 4. INDEXES
-- ════════════════════════════════════════════════════════════
create index idx_hunts_hunter_code on public.hunts(hunter_code);
create index idx_hunts_chicken_code on public.hunts(chicken_code);
create index idx_hunts_creator on public.hunts(creator_id);
create index idx_hunt_participants_hunt on public.hunt_participants(hunt_id);
create index idx_hunt_participants_user on public.hunt_participants(user_id);
create index idx_hunt_bars_hunt on public.hunt_bars(hunt_id);
create index idx_hunt_bars_status on public.hunt_bars(hunt_id, check_status);
create index idx_hints_hunt on public.hints(hunt_id);


-- ════════════════════════════════════════════════════════════
-- 5. ENABLE RLS (no policies yet — just turning it on)
-- ════════════════════════════════════════════════════════════
alter table public.profiles enable row level security;
alter table public.hunts enable row level security;
alter table public.hunt_participants enable row level security;
alter table public.hunt_bars enable row level security;
alter table public.hints enable row level security;


-- ════════════════════════════════════════════════════════════
-- 6. ALL RLS POLICIES
--    (safe now because every table exists)
-- ════════════════════════════════════════════════════════════

-- ── Profiles policies ───────────────────────────────────────
create policy "Profiles are viewable by everyone"
  on public.profiles for select using (true);

create policy "Users can update own profile"
  on public.profiles for update using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.profiles for insert with check (auth.uid() = id);

-- ── Hunts policies ──────────────────────────────────────────
create policy "Creators can manage own hunts"
  on public.hunts for all using (auth.uid() = creator_id);

create policy "Participants can view joined hunts"
  on public.hunts for select using (
    exists (
      select 1 from public.hunt_participants hp
      where hp.hunt_id = id and hp.user_id = auth.uid()
    )
  );

-- ── Hunt Participants policies ──────────────────────────────
create policy "Participants can view hunt members"
  on public.hunt_participants for select using (
    exists (
      select 1 from public.hunt_participants hp2
      where hp2.hunt_id = hunt_id and hp2.user_id = auth.uid()
    )
  );

create policy "Users can join hunts"
  on public.hunt_participants for insert with check (auth.uid() = user_id);

create policy "Creators can manage participants"
  on public.hunt_participants for delete using (
    exists (
      select 1 from public.hunts h
      where h.id = hunt_id and h.creator_id = auth.uid()
    )
  );

-- ── Hunt Bars policies ──────────────────────────────────────
create policy "Participants can view hunt bars"
  on public.hunt_bars for select using (
    exists (
      select 1 from public.hunt_participants hp
      where hp.hunt_id = hunt_id and hp.user_id = auth.uid()
    )
  );

create policy "Participants can add bars"
  on public.hunt_bars for insert with check (
    exists (
      select 1 from public.hunt_participants hp
      where hp.hunt_id = hunt_id and hp.user_id = auth.uid()
    )
  );

create policy "Participants can update bar status"
  on public.hunt_bars for update using (
    exists (
      select 1 from public.hunt_participants hp
      where hp.hunt_id = hunt_id and hp.user_id = auth.uid()
    )
  );

create policy "Creators can delete hunt bars"
  on public.hunt_bars for delete using (
    exists (
      select 1 from public.hunts h
      where h.id = hunt_id and h.creator_id = auth.uid()
    )
  );

-- ── Hints policies ──────────────────────────────────────────
create policy "Participants can view hunt hints"
  on public.hints for select using (
    exists (
      select 1 from public.hunt_participants hp
      where hp.hunt_id = hunt_id and hp.user_id = auth.uid()
    )
  );

create policy "Participants can add hints"
  on public.hints for insert with check (
    exists (
      select 1 from public.hunt_participants hp
      where hp.hunt_id = hunt_id and hp.user_id = auth.uid()
    )
  );

create policy "Creators can delete hints"
  on public.hints for delete using (
    exists (
      select 1 from public.hunts h
      where h.id = hunt_id and h.creator_id = auth.uid()
    )
  );


-- ════════════════════════════════════════════════════════════
-- 7. TRIGGERS
-- ════════════════════════════════════════════════════════════

-- Auto-update updated_at on profiles
create trigger profiles_updated_at
  before update on public.profiles
  for each row execute procedure extensions.moddatetime(updated_at);

-- Auto-update updated_at on hunts
create trigger hunts_updated_at
  before update on public.hunts
  for each row execute procedure extensions.moddatetime(updated_at);

-- Auto-create profile on auth signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'display_name',
      new.raw_user_meta_data ->> 'full_name',
      split_part(new.email, '@', 1)
    ),
    coalesce(new.raw_user_meta_data ->> 'avatar_url', null)
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- ════════════════════════════════════════════════════════════
-- 8. SERVER-SIDE FUNCTIONS
-- ════════════════════════════════════════════════════════════

-- Join a hunt by code (called server-side with service_role key)
-- Security definer: bypasses RLS because the user doesn't have
-- access to the hunt yet when they're joining.
create or replace function public.join_hunt_by_code(
  p_code text,
  p_user_id uuid
)
returns jsonb
language plpgsql
security definer set search_path = ''
as $$
declare
  v_hunt_id uuid;
  v_hunt_name text;
  v_role public.participant_role;
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

  -- Upsert participant (idempotent join)
  insert into public.hunt_participants (hunt_id, user_id, role)
  values (v_hunt_id, p_user_id, v_role)
  on conflict (hunt_id, user_id) do nothing;

  return jsonb_build_object(
    'hunt_id', v_hunt_id,
    'hunt_name', v_hunt_name,
    'role', v_role::text
  );
end;
$$;


-- ════════════════════════════════════════════════════════════
-- 9. REALTIME
-- ════════════════════════════════════════════════════════════
alter publication supabase_realtime add table public.hunt_bars;
alter publication supabase_realtime add table public.hints;
alter publication supabase_realtime add table public.hunt_participants;
