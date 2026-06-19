-- ============================================================================
-- Allow Geoapify-sourced bars
--
-- We've replaced the Google Places bar search with Geoapify (OpenStreetMap data
-- via a clean REST API). New bar rows are tagged source='geoapify'. The
-- editable-bars migration constrained hunt_bars.source to ('google','manual');
-- widen it. 'google' stays valid for rows already saved that way on prod.
-- ============================================================================
alter table public.hunt_bars drop constraint if exists hunt_bars_source_check;
alter table public.hunt_bars
  add constraint hunt_bars_source_check check (source in ('google', 'manual', 'geoapify'));
