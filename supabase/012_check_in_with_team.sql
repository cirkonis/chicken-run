-- 012: Add with_team_id to hunt_check_ins
-- Allows recording "we ran into another team at this bar" (battle mechanic).

ALTER TABLE public.hunt_check_ins
  ADD COLUMN IF NOT EXISTS with_team_id uuid REFERENCES public.hunt_teams(id) ON DELETE SET NULL;
