-- ============================================================================
-- Chicken Run — BASELINE SCHEMA
--
-- This single file is the consolidated, cleaned-up equivalent of the original
-- hand-run migrations 001–016 (plus the duplicate 005/007 files and the
-- "catchup" scripts). It represents the EXACT state the production database is
-- already in.
--
-- Why this exists:
--   Going forward we use the Supabase CLI with versioned migrations. This
--   baseline is migration #1. Every future change is a NEW timestamped file in
--   this folder — never edit this one. The old loose .sql files have been moved
--   to supabase/legacy_sql/ for historical reference only; the CLI ignores them.
--
-- How it's organised (order matters to avoid dependency errors):
--   1. Extensions
--   2. Helper functions used by table defaults
--   3. Tables (parents before children)
--   4. Indexes
--   5. Row Level Security (RLS): enable, then policies
--   6. Triggers
--   7. Server-side RPC functions (called with the service-role key)
--   8. Realtime publication
--
-- Mental model of the game (so the tables make sense):
--   • A HUNT is one game. Its CREATOR (a real account) manages it.
--   • Players join with codes as GUEST accounts — no signup wall.
--   • TEAMS are groups of hunters. A team flagged is_chicken = true IS the prey
--     ("the chickens"); chickens are just a special team type.
--   • BARS are pulled from Google Places into hunt_bars.
--   • CHECK-INS, ARRIVALS, HINTS, EXPENSES are the "canon" events that make up
--     the in-app feed.
-- ============================================================================


-- ════════════════════════════════════════════════════════════════════════════
-- 1. EXTENSIONS
-- ════════════════════════════════════════════════════════════════════════════

-- pgcrypto: gen_random_uuid() for primary keys.
create extension if not exists "pgcrypto";

-- moddatetime: a trigger helper that auto-stamps updated_at columns.
create extension if not exists "moddatetime" schema extensions;

-- pg_graphql: Supabase's built-in GraphQL API. It auto-generates a GraphQL
-- schema from the tables below and enforces the same RLS policies. This is the
-- backend half of our new GraphQL/Apollo foundation. Supabase enables this by
-- default on hosted projects; we declare it explicitly so local == prod.
create extension if not exists pg_graphql;


-- ════════════════════════════════════════════════════════════════════════════
-- 2. HELPER FUNCTIONS (must exist before the tables that use them in defaults)
-- ════════════════════════════════════════════════════════════════════════════

-- Generate a random 6-char uppercase join code.
-- Alphabet excludes I/O/0/1 so codes are unambiguous when read aloud at a bar.
create or replace function public.generate_hunt_code()
returns text
language plpgsql
as $$
declare
  chars  text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result text := '';
  i int;
begin
  for i in 1..6 loop
    result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  end loop;
  return result;
end;
$$;


-- ════════════════════════════════════════════════════════════════════════════
-- 3. TABLES
-- ════════════════════════════════════════════════════════════════════════════

-- ── profiles ────────────────────────────────────────────────────────────────
-- One row per auth user (real OR guest). Auto-created by a trigger on signup
-- (see handle_new_user below). Holds the display name shown in the feed.
create table public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  avatar_url   text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ── participant_role enum ───────────────────────────────────────────────────
-- 'creator' is legacy (creators are no longer stored as participants — see the
-- is_hunt_participant() function), but the value is kept for backward compat.
create type public.participant_role as enum ('creator', 'hunter', 'chicken');

-- ── hunts ───────────────────────────────────────────────────────────────────
-- One game. center_lat/lng + radius_meters define the play area used for the
-- Google Places bar search.
--
-- Columns that accreted over the project's life (noting their origin migration
-- so the history is legible):
--   status / started_at  — hunt lifecycle: preparing → active → completed (013)
--   budget               — chickens' spend cap, in whole currency units (008)
--   storage_used_bytes   — running total of uploaded image bytes, for the
--                          per-hunt 50MB quota (010)
--   completed_at         — when it finished; drives the 90-day auto-cleanup (016)
create table public.hunts (
  id                 uuid primary key default gen_random_uuid(),
  creator_id         uuid not null references public.profiles(id) on delete cascade,
  name               text not null default 'Unnamed Hunt',
  hunter_code        text not null unique default public.generate_hunt_code(),
  chicken_code       text not null unique default public.generate_hunt_code(),
  center_lat         double precision not null,
  center_lng         double precision not null,
  radius_meters      int  not null default 1500,
  status             text not null default 'preparing'
                       check (status in ('preparing', 'active', 'completed')),
  started_at         timestamptz default null,
  budget             integer default null,
  storage_used_bytes bigint not null default 0,
  completed_at       timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- ── hunt_bars ───────────────────────────────────────────────────────────────
-- Bars discovered via Google Places for a hunt. place_id is Google's stable ID;
-- (hunt_id, place_id) is unique so re-searching upserts instead of duplicating.
--
-- check_status is a SINGLE per-bar flag: 'unchecked' | 'checked' | 'not_checking'.
-- NOTE (overhaul target): this single flag currently doubles as "has anyone been
-- here?" AND gates the check-in UI, which blocks a 2nd team from checking in or
-- battling. A later migration will decouple these.
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
  check_status    text not null default 'unchecked'
                    check (check_status in ('unchecked', 'checked', 'not_checking')),
  checked_by      uuid references public.profiles(id),
  checked_at      timestamptz,
  created_at      timestamptz not null default now(),
  unique(hunt_id, place_id)
);

-- ── hunt_teams ──────────────────────────────────────────────────────────────
-- A team within a hunt. Hunters join a team via its join_code.
--   renamed         — players may rename their team once; this tracks that (003)
--   join_code       — per-team 6-char code players enter to join (007)
--   is_chicken      — if true, THIS team is the prey ("the chickens") (009)
--   selected_bar_id — the chicken team's chosen hiding bar ("their coop") (015)
create table public.hunt_teams (
  id              uuid primary key default gen_random_uuid(),
  hunt_id         uuid not null references public.hunts(id) on delete cascade,
  name            text not null,
  renamed         boolean not null default false,
  display_order   int not null default 0,
  join_code       text not null unique default public.generate_hunt_code(),
  is_chicken      boolean not null default false,
  selected_bar_id uuid references public.hunt_bars(id),
  created_at      timestamptz not null default now()
);

-- ── hunt_participants ───────────────────────────────────────────────────────
-- Links an auth user to a hunt with a role, and (for hunters) to their team.
-- Creators are intentionally NOT stored here (see is_hunt_participant). (001/003)
create table public.hunt_participants (
  id        uuid primary key default gen_random_uuid(),
  hunt_id   uuid not null references public.hunts(id) on delete cascade,
  user_id   uuid not null references public.profiles(id) on delete cascade,
  role      public.participant_role not null default 'hunter',
  team_id   uuid references public.hunt_teams(id) on delete set null,
  joined_at timestamptz not null default now(),
  unique(hunt_id, user_id)
);

-- ── hunt_team_members ───────────────────────────────────────────────────────
-- Roster the host pre-registers for a team (the names players pick from when
-- joining). email is nullable since we switched to code+name joining (007);
-- uniqueness is now on (team_id, name).
create table public.hunt_team_members (
  id         uuid primary key default gen_random_uuid(),
  team_id    uuid not null references public.hunt_teams(id) on delete cascade,
  name       text not null,
  email      text,
  created_at timestamptz not null default now(),
  unique(team_id, name)
);

-- ── hunt_chickens ───────────────────────────────────────────────────────────
-- LEGACY: chickens used to be standalone (pre-registered prey players). They are
-- now modeled as a hunt_teams row with is_chicken = true. This table is kept so
-- old hunts created before that change still resolve. New code should not write
-- to it. (004)
create table public.hunt_chickens (
  id         uuid primary key default gen_random_uuid(),
  hunt_id    uuid not null references public.hunts(id) on delete cascade,
  name       text not null,
  email      text not null,
  created_at timestamptz not null default now(),
  unique(hunt_id, email)
);

-- ── hints ───────────────────────────────────────────────────────────────────
-- Clues the chickens post for hunters. image_path points at a file in the
-- private 'hunt-media' storage bucket (010).
create table public.hints (
  id         uuid primary key default gen_random_uuid(),
  hunt_id    uuid not null references public.hunts(id) on delete cascade,
  author_id  uuid not null references public.profiles(id) on delete cascade,
  text       text not null,
  image_path text default null,
  created_at timestamptz not null default now()
);

-- ── hunt_expenses ───────────────────────────────────────────────────────────
-- Individual spend entries by chickens, tracked against the hunt budget (008).
create table public.hunt_expenses (
  id         uuid primary key default gen_random_uuid(),
  hunt_id    uuid not null references public.hunts(id) on delete cascade,
  amount     integer not null,
  note       text default '',
  created_by uuid not null references auth.users(id),
  created_at timestamptz default now()
);

-- ── hunt_arrivals ───────────────────────────────────────────────────────────
-- Records which teams reached the chickens, in order (the "win" event). One row
-- per (hunt, team). image_path + note added in 010.
create table public.hunt_arrivals (
  id         uuid primary key default gen_random_uuid(),
  hunt_id    uuid not null references public.hunts(id) on delete cascade,
  team_id    uuid not null references public.hunt_teams(id) on delete cascade,
  arrived_at timestamptz default now(),
  image_path text default null,
  note       text not null default '',
  unique(hunt_id, team_id)
);

-- ── hunt_check_ins ──────────────────────────────────────────────────────────
-- A team's visit to a bar, with a photo + optional note. This is the heart of
-- the feed. (011)
--   team_id      — the team that checked in (null if a team-less user)
--   with_team_id — ONE other team they ran into here, i.e. a "battle" (012)
--   image_path   — file in the private 'hunt-media' bucket
--
-- NOTE (overhaul target): with_team_id being a single FK means a battle can only
-- involve two teams. A later migration will move battle participants to a
-- many-to-many join table so 3+ teams can meet at one bar.
create table public.hunt_check_ins (
  id           uuid primary key default gen_random_uuid(),
  hunt_id      uuid not null references public.hunts(id) on delete cascade,
  bar_id       uuid not null references public.hunt_bars(id) on delete cascade,
  team_id      uuid references public.hunt_teams(id) on delete set null,
  with_team_id uuid references public.hunt_teams(id) on delete set null,
  user_id      uuid not null references public.profiles(id),
  note         text not null default '',
  image_path   text default null,
  created_at   timestamptz not null default now()
);


-- ════════════════════════════════════════════════════════════════════════════
-- 4. INDEXES
-- ════════════════════════════════════════════════════════════════════════════
create index idx_hunts_hunter_code        on public.hunts(hunter_code);
create index idx_hunts_chicken_code       on public.hunts(chicken_code);
create index idx_hunts_creator            on public.hunts(creator_id);

create index idx_hunt_participants_hunt   on public.hunt_participants(hunt_id);
create index idx_hunt_participants_user   on public.hunt_participants(user_id);
create index idx_hunt_participants_team   on public.hunt_participants(team_id);

create index idx_hunt_bars_hunt           on public.hunt_bars(hunt_id);
create index idx_hunt_bars_status         on public.hunt_bars(hunt_id, check_status);

create index idx_hunt_teams_hunt          on public.hunt_teams(hunt_id);
create index idx_hunt_teams_join_code     on public.hunt_teams(join_code);

create index idx_hunt_team_members_team   on public.hunt_team_members(team_id);
create index idx_hunt_team_members_email  on public.hunt_team_members(email);

create index idx_hunt_chickens_hunt       on public.hunt_chickens(hunt_id);
create index idx_hunt_chickens_email      on public.hunt_chickens(email);

create index idx_hints_hunt               on public.hints(hunt_id);
create index idx_hunt_expenses_hunt_id    on public.hunt_expenses(hunt_id);
create index idx_hunt_arrivals_hunt_id    on public.hunt_arrivals(hunt_id);
create index idx_check_ins_hunt           on public.hunt_check_ins(hunt_id);
create index idx_check_ins_bar            on public.hunt_check_ins(bar_id);


-- ════════════════════════════════════════════════════════════════════════════
-- 5. ROW LEVEL SECURITY
--
-- RLS = per-row access rules enforced by Postgres itself. Every table is locked
-- down, then policies grant specific access. auth.uid() is the calling user's id
-- (null for anonymous requests — which is why an expired guest token causes
-- "permission denied" failures; that session longevity issue is a known bug).
-- ════════════════════════════════════════════════════════════════════════════

-- Membership helper used by most policies. SECURITY DEFINER so it can read
-- hunt_participants without recursively triggering RLS (the original recursion
-- bug fixed in 002). Returns true for participants OR the hunt's creator, so
-- creators get full access without a participant row (006).
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

alter table public.profiles          enable row level security;
alter table public.hunts             enable row level security;
alter table public.hunt_bars         enable row level security;
alter table public.hunt_teams        enable row level security;
alter table public.hunt_participants enable row level security;
alter table public.hunt_team_members enable row level security;
alter table public.hunt_chickens     enable row level security;
alter table public.hints             enable row level security;
alter table public.hunt_expenses     enable row level security;
alter table public.hunt_arrivals     enable row level security;
alter table public.hunt_check_ins    enable row level security;

-- ── profiles ──────────────────────────────────────────────────────────────
create policy "Profiles are viewable by everyone"
  on public.profiles for select using (true);
create policy "Users can update own profile"
  on public.profiles for update using (auth.uid() = id);
create policy "Users can insert own profile"
  on public.profiles for insert with check (auth.uid() = id);

-- ── hunts ─────────────────────────────────────────────────────────────────
create policy "Creators can manage own hunts"
  on public.hunts for all using (auth.uid() = creator_id);
create policy "Participants can view joined hunts"
  on public.hunts for select using (public.is_hunt_participant(id));

-- ── hunt_bars ─────────────────────────────────────────────────────────────
create policy "Participants can view hunt bars"
  on public.hunt_bars for select using (public.is_hunt_participant(hunt_id));
create policy "Participants can add bars"
  on public.hunt_bars for insert with check (public.is_hunt_participant(hunt_id));
create policy "Participants can update bar status"
  on public.hunt_bars for update using (public.is_hunt_participant(hunt_id));
create policy "Creators can delete hunt bars"
  on public.hunt_bars for delete using (
    exists (select 1 from public.hunts h where h.id = hunt_id and h.creator_id = auth.uid())
  );

-- ── hunt_teams ────────────────────────────────────────────────────────────
create policy "Participants can view hunt teams"
  on public.hunt_teams for select using (public.is_hunt_participant(hunt_id));
create policy "Creators can insert hunt teams"
  on public.hunt_teams for insert with check (
    exists (select 1 from public.hunts h where h.id = hunt_id and h.creator_id = auth.uid())
  );
-- Creator can always update; a team member may rename their team but only once.
create policy "Teams can be updated"
  on public.hunt_teams for update using (
    exists (select 1 from public.hunts h where h.id = hunt_id and h.creator_id = auth.uid())
    or (
      not renamed
      and exists (
        select 1 from public.hunt_participants hp
        where hp.team_id = id and hp.user_id = auth.uid()
      )
    )
  );
create policy "Creators can delete hunt teams"
  on public.hunt_teams for delete using (
    exists (select 1 from public.hunts h where h.id = hunt_id and h.creator_id = auth.uid())
  );

-- ── hunt_participants ─────────────────────────────────────────────────────
create policy "Participants can view hunt members"
  on public.hunt_participants for select using (public.is_hunt_participant(hunt_id));
create policy "Users can join hunts"
  on public.hunt_participants for insert with check (auth.uid() = user_id);
create policy "Creators can manage participants"
  on public.hunt_participants for delete using (
    exists (select 1 from public.hunts h where h.id = hunt_id and h.creator_id = auth.uid())
  );

-- ── hunt_team_members ─────────────────────────────────────────────────────
create policy "Participants can view team members"
  on public.hunt_team_members for select using (
    exists (
      select 1 from public.hunt_teams ht
      where ht.id = team_id and public.is_hunt_participant(ht.hunt_id)
    )
  );
create policy "Creators can insert team members"
  on public.hunt_team_members for insert with check (
    exists (
      select 1 from public.hunt_teams ht
      join public.hunts h on h.id = ht.hunt_id
      where ht.id = team_id and h.creator_id = auth.uid()
    )
  );
create policy "Creators can update team members"
  on public.hunt_team_members for update using (
    exists (
      select 1 from public.hunt_teams ht
      join public.hunts h on h.id = ht.hunt_id
      where ht.id = team_id and h.creator_id = auth.uid()
    )
  );
create policy "Creators can delete team members"
  on public.hunt_team_members for delete using (
    exists (
      select 1 from public.hunt_teams ht
      join public.hunts h on h.id = ht.hunt_id
      where ht.id = team_id and h.creator_id = auth.uid()
    )
  );

-- ── hunt_chickens (legacy) ────────────────────────────────────────────────
create policy "Participants can view hunt chickens"
  on public.hunt_chickens for select using (public.is_hunt_participant(hunt_id));
create policy "Creators can insert hunt chickens"
  on public.hunt_chickens for insert with check (
    exists (select 1 from public.hunts h where h.id = hunt_id and h.creator_id = auth.uid())
  );
create policy "Creators can update hunt chickens"
  on public.hunt_chickens for update using (
    exists (select 1 from public.hunts h where h.id = hunt_id and h.creator_id = auth.uid())
  );
create policy "Creators can delete hunt chickens"
  on public.hunt_chickens for delete using (
    exists (select 1 from public.hunts h where h.id = hunt_id and h.creator_id = auth.uid())
  );

-- ── hints ─────────────────────────────────────────────────────────────────
create policy "Participants can view hunt hints"
  on public.hints for select using (public.is_hunt_participant(hunt_id));
create policy "Participants can add hints"
  on public.hints for insert with check (public.is_hunt_participant(hunt_id));
create policy "Creators can delete hints"
  on public.hints for delete using (
    exists (select 1 from public.hunts h where h.id = hunt_id and h.creator_id = auth.uid())
  );

-- ── hunt_expenses ─────────────────────────────────────────────────────────
create policy "Hunt participants can read expenses"
  on public.hunt_expenses for select using (
    public.is_hunt_participant(hunt_id)
  );
create policy "Chickens and creator can add expenses"
  on public.hunt_expenses for insert with check (
    exists (
      select 1 from public.hunt_participants hp
      where hp.hunt_id = hunt_expenses.hunt_id and hp.user_id = auth.uid() and hp.role = 'chicken'
    )
    or exists (select 1 from public.hunts h where h.id = hunt_expenses.hunt_id and h.creator_id = auth.uid())
  );
create policy "Expense author or creator can delete"
  on public.hunt_expenses for delete using (
    created_by = auth.uid()
    or exists (select 1 from public.hunts h where h.id = hunt_expenses.hunt_id and h.creator_id = auth.uid())
  );

-- ── hunt_arrivals ─────────────────────────────────────────────────────────
create policy "Hunt participants can read arrivals"
  on public.hunt_arrivals for select using (
    public.is_hunt_participant(hunt_id)
  );
create policy "Chickens and creator can add arrivals"
  on public.hunt_arrivals for insert with check (
    exists (
      select 1 from public.hunt_participants hp
      where hp.hunt_id = hunt_arrivals.hunt_id and hp.user_id = auth.uid() and hp.role = 'chicken'
    )
    or exists (select 1 from public.hunts h where h.id = hunt_arrivals.hunt_id and h.creator_id = auth.uid())
  );
create policy "Chickens and creator can delete arrivals"
  on public.hunt_arrivals for delete using (
    exists (
      select 1 from public.hunt_participants hp
      where hp.hunt_id = hunt_arrivals.hunt_id and hp.user_id = auth.uid() and hp.role = 'chicken'
    )
    or exists (select 1 from public.hunts h where h.id = hunt_arrivals.hunt_id and h.creator_id = auth.uid())
  );

-- ── hunt_check_ins ────────────────────────────────────────────────────────
create policy "check_ins_select" on public.hunt_check_ins
  for select using (public.is_hunt_participant(hunt_id));
create policy "check_ins_insert" on public.hunt_check_ins
  for insert with check (public.is_hunt_participant(hunt_id));
create policy "check_ins_delete" on public.hunt_check_ins
  for delete using (
    exists (select 1 from public.hunts where hunts.id = hunt_check_ins.hunt_id and hunts.creator_id = auth.uid())
  );


-- ════════════════════════════════════════════════════════════════════════════
-- 6. TRIGGERS
-- ════════════════════════════════════════════════════════════════════════════

-- Keep updated_at fresh automatically.
create trigger profiles_updated_at
  before update on public.profiles
  for each row execute procedure extensions.moddatetime(updated_at);
create trigger hunts_updated_at
  before update on public.hunts
  for each row execute procedure extensions.moddatetime(updated_at);

-- Auto-create a profile row whenever an auth user is created (real or guest).
-- Pulls a display name from metadata, full_name, or the email local-part.
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


-- ════════════════════════════════════════════════════════════════════════════
-- 7. SERVER-SIDE RPC FUNCTIONS
--
-- Called from Nitro endpoints with the service-role key. SECURITY DEFINER lets
-- them bypass RLS for the join flow (a user has no hunt access until they join).
-- ════════════════════════════════════════════════════════════════════════════

-- Find an existing guest auth user by their real email (so a returning player
-- reuses one guest account instead of creating a new one each time). (005)
create or replace function public.find_guest_by_real_email(p_email text)
returns uuid
language sql
security definer set search_path = ''
as $$
  select id
  from auth.users
  where raw_user_meta_data->>'is_guest' = 'true'
    and lower(raw_user_meta_data->>'real_email') = lower(p_email)
  limit 1;
$$;

-- Find an existing guest auth user by team_code + member name. (007)
create or replace function public.find_guest_by_team_code(
  p_team_code text,
  p_member_name text
)
returns uuid
language sql
security definer set search_path = ''
as $$
  select id from auth.users
  where raw_user_meta_data->>'is_guest' = 'true'
    and upper(raw_user_meta_data->>'team_code') = upper(p_team_code)
    and lower(raw_user_meta_data->>'member_name') = lower(p_member_name)
  limit 1;
$$;

-- Validate a code typed on the home page and return who/what it belongs to,
-- plus the roster with each member's joined status (for the "pick your name"
-- screen). Works for team codes (hunter or chicken teams) and the legacy
-- hunt-level chicken_code. Allows preparing/active/completed hunts. (014)
create or replace function public.validate_team_code(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_team    record;
  v_hunt    record;
  v_members jsonb;
  v_type    text;
begin
  -- Team join code?
  select ht.id, ht.name, ht.hunt_id, ht.is_chicken
  into v_team
  from public.hunt_teams ht
  where ht.join_code = upper(p_code);

  if v_team is not null then
    select h.name into v_hunt
    from public.hunts h
    where h.id = v_team.hunt_id and h.status in ('preparing', 'active', 'completed');

    if v_hunt is null then
      return jsonb_build_object('error', 'Hunt is not active');
    end if;

    v_type := case when v_team.is_chicken then 'chicken' else 'team' end;

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
      'type', v_type,
      'huntName', v_hunt.name,
      'teamName', v_team.name,
      'teamId', v_team.id,
      'members', v_members
    );
  end if;

  -- Legacy hunt-level chicken_code fallback.
  select h.id, h.name
  into v_hunt
  from public.hunts h
  where h.chicken_code = upper(p_code) and h.status in ('preparing', 'active', 'completed');

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

-- Join a hunt by code. Resolves, in order: team join_code → hunt-level
-- hunter_code → legacy chicken_code. Upserts the participant row (idempotent),
-- assigning team + role. is_chicken teams join as role 'chicken'. (014)
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
  v_hunt_id    uuid;
  v_hunt_name  text;
  v_role       public.participant_role;
  v_team_id    uuid;
  v_team_name  text;
  v_is_chicken boolean;
begin
  -- 1. Team join code (resolves hunt + team in one step).
  select ht.hunt_id, h.name, ht.id, ht.name, ht.is_chicken
  into v_hunt_id, v_hunt_name, v_team_id, v_team_name, v_is_chicken
  from public.hunt_teams ht
  join public.hunts h on h.id = ht.hunt_id
  where ht.join_code = upper(p_code)
    and h.status in ('preparing', 'active', 'completed');

  if v_hunt_id is not null then
    v_role := case when v_is_chicken then 'chicken' else 'hunter' end;

    insert into public.hunt_participants (hunt_id, user_id, role, team_id)
    values (v_hunt_id, p_user_id, v_role, v_team_id)
    on conflict (hunt_id, user_id) do update
      set role = excluded.role,
          team_id = coalesce(excluded.team_id, public.hunt_participants.team_id);

    return jsonb_build_object(
      'hunt_id', v_hunt_id, 'hunt_name', v_hunt_name,
      'role', v_role::text, 'team_id', v_team_id, 'team_name', v_team_name
    );
  end if;

  -- 2. Hunt-level hunter_code (optionally match a team by member name).
  select id, name into v_hunt_id, v_hunt_name
  from public.hunts
  where hunter_code = upper(p_code) and status in ('preparing', 'active', 'completed');

  if v_hunt_id is not null then
    v_role := 'hunter';

    if p_member_name is not null and p_member_name <> '' then
      select ht.id, ht.name into v_team_id, v_team_name
      from public.hunt_team_members htm
      join public.hunt_teams ht on ht.id = htm.team_id
      where ht.hunt_id = v_hunt_id and lower(htm.name) = lower(p_member_name)
      limit 1;
    end if;

    insert into public.hunt_participants (hunt_id, user_id, role, team_id)
    values (v_hunt_id, p_user_id, v_role, v_team_id)
    on conflict (hunt_id, user_id) do update
      set team_id = coalesce(excluded.team_id, public.hunt_participants.team_id);

    return jsonb_build_object(
      'hunt_id', v_hunt_id, 'hunt_name', v_hunt_name,
      'role', v_role::text, 'team_id', v_team_id, 'team_name', v_team_name
    );
  end if;

  -- 3. Legacy hunt-level chicken_code.
  select id, name into v_hunt_id, v_hunt_name
  from public.hunts
  where chicken_code = upper(p_code) and status in ('preparing', 'active', 'completed');

  if v_hunt_id is not null then
    v_role := 'chicken';

    insert into public.hunt_participants (hunt_id, user_id, role, team_id)
    values (v_hunt_id, p_user_id, v_role, null)
    on conflict (hunt_id, user_id) do update set role = excluded.role;

    return jsonb_build_object(
      'hunt_id', v_hunt_id, 'hunt_name', v_hunt_name,
      'role', v_role::text, 'team_id', null, 'team_name', null
    );
  end if;

  return jsonb_build_object('error', 'Invalid or expired hunt code');
end;
$$;


-- ════════════════════════════════════════════════════════════════════════════
-- 8. REALTIME
--
-- Tables added to this publication broadcast row changes over websockets.
-- NOTE (overhaul target): hunt_check_ins and hunt_arrivals are deliberately NOT
-- here yet — which is a big reason the feed only updates on reload. A later
-- migration will add them so the feed goes live.
-- ════════════════════════════════════════════════════════════════════════════
alter publication supabase_realtime add table public.hunt_bars;
alter publication supabase_realtime add table public.hints;
alter publication supabase_realtime add table public.hunt_participants;
