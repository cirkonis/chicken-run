-- Migration: editable + manually-added bars.
--
-- Bars used to come only from Google Places. Now a chicken can fix a wrong
-- address on their coop, and a host can add a bar by hand. So:
--   1. place_id becomes nullable — manual bars have no Google id. (The
--      unique(hunt_id, place_id) constraint still allows many NULLs, since NULLs
--      are distinct in a unique index.)
--   2. `source` distinguishes 'google' vs 'manual'.
--   3. `edited` flags a bar whose details a human corrected.
-- The bar-search endpoint uses these so a re-search never wipes manual bars or
-- clobbers edited ones.
alter table public.hunt_bars alter column place_id drop not null;

alter table public.hunt_bars
  add column source text not null default 'google' check (source in ('google', 'manual'));

alter table public.hunt_bars
  add column edited boolean not null default false;
