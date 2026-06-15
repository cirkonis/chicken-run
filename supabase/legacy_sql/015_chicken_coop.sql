-- ============================================================
-- Chicken Run - Chicken Coop Selection
--
-- Chickens must pick a bar ("their coop") before seeing
-- their page. The choice is permanent and secret until
-- the hunt ends.
-- ============================================================

ALTER TABLE public.hunt_teams
  ADD COLUMN selected_bar_id uuid REFERENCES public.hunt_bars(id);
