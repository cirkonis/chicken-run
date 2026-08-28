-- ============================================================================
-- Keep-alive ping target (free-tier anti-pause)
--
-- WHY THIS EXISTS
-- Supabase pauses free-tier projects after ~7 days with no activity. This app
-- gets used roughly once a fortnight, so left alone the project would keep
-- putting itself to sleep between crawls. The fix is a scheduled external
-- request that touches Postgres every couple of days
-- (.github/workflows/supabase-keepalive.yml).
--
-- NOTE: this must be an *external* request. Anything internal (pg_cron and
-- friends) is not a reliable signal of activity — the ping has to come in
-- through the API, which is what the GitHub Actions workflow does.
--
-- WHAT IT ADDS
--   • public.keepalive — a deliberately boring single-row table holding the
--     timestamp of the last ping, so "is the cron actually running?" is one
--     look in Studio rather than a dig through GitHub Actions history.
--   • public.keepalive() — the RPC the cron calls. It bumps that timestamp and
--     returns it, so every ping is a real read+write against Postgres.
-- ============================================================================

create table if not exists public.keepalive (
  -- The `id = 1` check plus the primary key is the standard singleton-table
  -- trick: the constraint makes a second row impossible, so the function below
  -- never has to wonder which row it is updating.
  id        smallint primary key default 1 check (id = 1),
  last_ping timestamptz not null default now()
);

comment on table public.keepalive is
  'Single-row heartbeat. Written by public.keepalive() from the scheduled GitHub Action that stops the free-tier project auto-pausing.';
comment on column public.keepalive.last_ping is
  'Timestamp of the most recent successful keep-alive ping.';

-- Seed the one row. `on conflict do nothing` keeps the migration re-runnable
-- and safe to apply to a project that already has it.
insert into public.keepalive (id) values (1)
  on conflict (id) do nothing;

-- RLS on, and NO policies: with RLS enabled and no policy, `anon` and
-- `authenticated` can neither read nor write this table directly. The only way
-- in is the SECURITY DEFINER function below — a single, narrow door.
alter table public.keepalive enable row level security;

create or replace function public.keepalive()
returns timestamptz
language sql
-- SECURITY DEFINER: runs as the function's owner (postgres), which bypasses the
-- RLS above. That's what lets an anon-key caller bump the timestamp without us
-- opening the table itself up to writes.
security definer
-- Pin the search_path so a caller can't shadow `public` with their own schema
-- and trick a definer-rights function into touching the wrong table. Standard
-- hardening for any SECURITY DEFINER function.
set search_path = public, pg_temp
as $$
  update public.keepalive
     set last_ping = now()
   where id = 1
  returning last_ping;
$$;

comment on function public.keepalive() is
  'Free-tier keep-alive. Bumps public.keepalive.last_ping and returns it. Called every 2 days by the supabase-keepalive GitHub Action.';

-- Postgres grants EXECUTE on new functions to PUBLIC by default; being explicit
-- documents the intent and survives a project that has revoked that default.
grant execute on function public.keepalive() to anon, authenticated, service_role;
