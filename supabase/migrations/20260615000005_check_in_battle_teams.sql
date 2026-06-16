-- Migration: multi-team battles.
--
-- A check-in could only record running into ONE other team (the single
-- hunt_check_ins.with_team_id FK). Replace it with a join table so a check-in
-- can record any number of teams met at a bar.

create table public.hunt_check_in_teams (
  check_in_id uuid not null references public.hunt_check_ins(id) on delete cascade,
  team_id     uuid not null references public.hunt_teams(id) on delete cascade,
  primary key (check_in_id, team_id)
);
create index idx_check_in_teams_check_in on public.hunt_check_in_teams(check_in_id);

alter table public.hunt_check_in_teams enable row level security;

-- Readable by anyone who can see the parent check-in's hunt. Writes go through
-- the admin client in the endpoints (which enforce author/creator), so the Data
-- API roles need no insert/update/delete policy here.
create policy "check_in_teams_select" on public.hunt_check_in_teams
  for select using (
    exists (
      select 1 from public.hunt_check_ins ci
      where ci.id = check_in_id and public.is_hunt_participant(ci.hunt_id)
    )
  );

-- Backfill the existing single-team battles into the join table.
insert into public.hunt_check_in_teams (check_in_id, team_id)
select id, with_team_id from public.hunt_check_ins where with_team_id is not null
on conflict do nothing;

-- The single FK is now superseded by the join table.
-- (Edits touch the check_in row's note too, so the existing hunt_check_ins
--  realtime entry still fires the feed refresh — no separate realtime needed.)
alter table public.hunt_check_ins drop column with_team_id;
