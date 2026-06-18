-- ============================================================================
-- Hunt scheduling + per-hunt bar filter rules (the "bar rules" feature)
--
-- Two related additions to `hunts`:
--
-- 1. A SCHEDULE — which day + what time the crawl kicks off. We need this to
--    filter bars by their opening hours FOR THAT DAY (e.g. drop a bar that only
--    opens after the game starts). Stored as:
--      • game_day    — 0..6, using Google Places' numbering (0 = Sunday … 6 =
--                      Saturday) so it lines up directly with the opening-hours
--                      data we get back.
--      • start_minute — minutes since LOCAL midnight (0..1439), e.g. 20:00 = 1200.
--                      We deliberately store wall-clock minutes (not a timestamptz)
--                      because Google's opening hours are the venue's local time —
--                      comparing local-to-local needs no timezone math, which is
--                      correct as long as the host thinks in the crawl's local time.
--    Both nullable: a hunt with no schedule set just skips the opening-time filter.
--
-- 2. bar_filters (jsonb) — the host-editable rule set. Shape (all keys optional;
--    code applies defaults so existing hunts behave exactly as before):
--      {
--        "venueTypes": ["bar"],          -- categories that count as a target.
--                                        -- default ["bar"]; may add "cafe",
--                                        -- "restaurant", "hotel", "nightclub".
--        "filterByOpeningTime": true     -- apply the open-at-start-time filter
--                                        -- (only bites once a schedule is set).
--      }
--    NOTE: excluding temporarily/permanently CLOSED venues is ALWAYS on and is
--    NOT a rule here — it's hardcoded in the filter (you never want closed bars).
-- ============================================================================

alter table public.hunts
  add column if not exists game_day smallint
    check (game_day is null or game_day between 0 and 6),
  add column if not exists start_minute integer
    check (start_minute is null or start_minute between 0 and 1439),
  add column if not exists bar_filters jsonb not null default '{}'::jsonb;

comment on column public.hunts.game_day is
  'Crawl day of week, 0=Sunday..6=Saturday (matches Google Places opening-hours day numbering). Null = unscheduled.';
comment on column public.hunts.start_minute is
  'Crawl start time as minutes since local midnight (0..1439). Null = unscheduled.';
comment on column public.hunts.bar_filters is
  'Host-editable bar filter rules: { venueTypes: string[], filterByOpeningTime: bool }. Closed-venue exclusion is always-on and not stored here.';
