-- Migration 011: Bar check-in records (photo + note per visit)
-- Each check-in captures a team's visit to a bar with optional photo evidence.

CREATE TABLE IF NOT EXISTS public.hunt_check_ins (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hunt_id     uuid NOT NULL REFERENCES public.hunts(id) ON DELETE CASCADE,
  bar_id      uuid NOT NULL REFERENCES public.hunt_bars(id) ON DELETE CASCADE,
  team_id     uuid REFERENCES public.hunt_teams(id) ON DELETE SET NULL,
  user_id     uuid NOT NULL REFERENCES public.profiles(id),
  note        text NOT NULL DEFAULT '',
  image_path  text DEFAULT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_check_ins_hunt ON public.hunt_check_ins(hunt_id);
CREATE INDEX IF NOT EXISTS idx_check_ins_bar  ON public.hunt_check_ins(bar_id);

-- RLS
ALTER TABLE public.hunt_check_ins ENABLE ROW LEVEL SECURITY;

-- Participants can view check-ins
CREATE POLICY "check_ins_select" ON public.hunt_check_ins
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.hunt_participants
      WHERE hunt_participants.hunt_id = hunt_check_ins.hunt_id
        AND hunt_participants.user_id = auth.uid()
    )
  );

-- Participants can insert check-ins
CREATE POLICY "check_ins_insert" ON public.hunt_check_ins
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.hunt_participants
      WHERE hunt_participants.hunt_id = hunt_check_ins.hunt_id
        AND hunt_participants.user_id = auth.uid()
    )
  );

-- Hunt creator can delete check-ins
CREATE POLICY "check_ins_delete" ON public.hunt_check_ins
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.hunts
      WHERE hunts.id = hunt_check_ins.hunt_id
        AND hunts.creator_id = auth.uid()
    )
  );
