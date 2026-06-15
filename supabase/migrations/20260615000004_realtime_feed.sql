-- Migration: make the feed live.
--
-- Add check-ins and arrivals to the Supabase Realtime publication so players see
-- them the instant they happen, instead of waiting up to 10s for the next poll.
-- (hunt_bars, hints, and hunt_participants are already in the publication from
-- the baseline.) Client-side polling stays in place as a safety net, so a
-- dropped websocket just means the feed updates a little slower — never not.
alter publication supabase_realtime add table public.hunt_check_ins;
alter publication supabase_realtime add table public.hunt_arrivals;
