-- ============================================================
-- Chicken Run - Allow codes to work for completed hunts
--
-- Players should be able to use hunt codes to view results
-- after a hunt is completed. Only deleted hunts should
-- invalidate codes.
-- ============================================================


-- ════════════════════════════════════════════════════════════
-- 1. UPDATE validate_team_code()
--    Allow completed hunts (not just active)
-- ════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.validate_team_code(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_team record;
  v_hunt record;
  v_members jsonb;
  v_type text;
BEGIN
  -- Check hunt_teams.join_code
  SELECT ht.id, ht.name, ht.hunt_id, ht.is_chicken
  INTO v_team
  FROM public.hunt_teams ht
  WHERE ht.join_code = upper(p_code);

  IF v_team IS NOT NULL THEN
    -- Get hunt name (allow active and completed)
    SELECT h.name INTO v_hunt
    FROM public.hunts h
    WHERE h.id = v_team.hunt_id AND h.status IN ('preparing', 'active', 'completed');

    IF v_hunt IS NULL THEN
      RETURN jsonb_build_object('error', 'Hunt is not active');
    END IF;

    -- Determine type based on is_chicken flag
    v_type := CASE WHEN v_team.is_chicken THEN 'chicken' ELSE 'team' END;

    -- Get team members with joined status
    SELECT coalesce(jsonb_agg(
      jsonb_build_object(
        'name', htm.name,
        'joined', exists (
          SELECT 1 FROM public.hunt_participants hp
          WHERE hp.team_id = v_team.id
            AND hp.user_id IN (
              SELECT au.id FROM auth.users au
              WHERE au.raw_user_meta_data->>'is_guest' = 'true'
                AND lower(au.raw_user_meta_data->>'member_name') = lower(htm.name)
                AND upper(au.raw_user_meta_data->>'team_code') = upper(p_code)
            )
        )
      ) ORDER BY htm.created_at
    ), '[]'::jsonb)
    INTO v_members
    FROM public.hunt_team_members htm
    WHERE htm.team_id = v_team.id;

    RETURN jsonb_build_object(
      'type', v_type,
      'huntName', v_hunt.name,
      'teamName', v_team.name,
      'teamId', v_team.id,
      'members', v_members
    );
  END IF;

  -- Fallback: Check hunts.chicken_code (backward compat for old hunts)
  SELECT h.id, h.name
  INTO v_hunt
  FROM public.hunts h
  WHERE h.chicken_code = upper(p_code) AND h.status IN ('preparing', 'active', 'completed');

  IF v_hunt IS NOT NULL THEN
    SELECT coalesce(jsonb_agg(
      jsonb_build_object(
        'name', hc.name,
        'joined', exists (
          SELECT 1 FROM public.hunt_participants hp
          WHERE hp.hunt_id = v_hunt.id
            AND hp.role = 'chicken'
            AND hp.user_id IN (
              SELECT au.id FROM auth.users au
              WHERE au.raw_user_meta_data->>'is_guest' = 'true'
                AND lower(au.raw_user_meta_data->>'member_name') = lower(hc.name)
            )
        )
      ) ORDER BY hc.created_at
    ), '[]'::jsonb)
    INTO v_members
    FROM public.hunt_chickens hc
    WHERE hc.hunt_id = v_hunt.id;

    RETURN jsonb_build_object(
      'type', 'chicken',
      'huntName', v_hunt.name,
      'members', v_members
    );
  END IF;

  RETURN jsonb_build_object('error', 'Invalid hunt code');
END;
$$;


-- ════════════════════════════════════════════════════════════
-- 2. UPDATE join_hunt_by_code()
--    Allow joining completed hunts (for viewing results)
-- ════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.join_hunt_by_code(
  p_code text,
  p_user_id uuid,
  p_member_name text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_hunt_id uuid;
  v_hunt_name text;
  v_role public.participant_role;
  v_team_id uuid;
  v_team_name text;
  v_is_chicken boolean;
BEGIN
  -- 1. Check team join codes first (resolves hunt + team in one step)
  SELECT ht.hunt_id, h.name, ht.id, ht.name, ht.is_chicken
  INTO v_hunt_id, v_hunt_name, v_team_id, v_team_name, v_is_chicken
  FROM public.hunt_teams ht
  JOIN public.hunts h ON h.id = ht.hunt_id
  WHERE ht.join_code = upper(p_code)
    AND h.status IN ('preparing', 'active', 'completed');

  IF v_hunt_id IS NOT NULL THEN
    -- Set role based on is_chicken flag
    v_role := CASE WHEN v_is_chicken THEN 'chicken' ELSE 'hunter' END;

    -- Upsert participant
    INSERT INTO public.hunt_participants (hunt_id, user_id, role, team_id)
    VALUES (v_hunt_id, p_user_id, v_role, v_team_id)
    ON CONFLICT (hunt_id, user_id) DO UPDATE
      SET role = excluded.role,
          team_id = coalesce(excluded.team_id, public.hunt_participants.team_id);

    RETURN jsonb_build_object(
      'hunt_id', v_hunt_id,
      'hunt_name', v_hunt_name,
      'role', v_role::text,
      'team_id', v_team_id,
      'team_name', v_team_name
    );
  END IF;

  -- 2. Fall back to hunt-level hunter_code
  SELECT id, name INTO v_hunt_id, v_hunt_name
  FROM public.hunts
  WHERE hunter_code = upper(p_code) AND status IN ('preparing', 'active', 'completed');

  IF v_hunt_id IS NOT NULL THEN
    v_role := 'hunter';

    -- Try to match by member name to find team
    IF p_member_name IS NOT NULL AND p_member_name <> '' THEN
      SELECT ht.id, ht.name INTO v_team_id, v_team_name
      FROM public.hunt_team_members htm
      JOIN public.hunt_teams ht ON ht.id = htm.team_id
      WHERE ht.hunt_id = v_hunt_id
        AND lower(htm.name) = lower(p_member_name)
      LIMIT 1;
    END IF;

    INSERT INTO public.hunt_participants (hunt_id, user_id, role, team_id)
    VALUES (v_hunt_id, p_user_id, v_role, v_team_id)
    ON CONFLICT (hunt_id, user_id) DO UPDATE
      SET team_id = coalesce(excluded.team_id, public.hunt_participants.team_id);

    RETURN jsonb_build_object(
      'hunt_id', v_hunt_id,
      'hunt_name', v_hunt_name,
      'role', v_role::text,
      'team_id', v_team_id,
      'team_name', v_team_name
    );
  END IF;

  -- 3. Fall back to hunt-level chicken_code (backward compat)
  SELECT id, name INTO v_hunt_id, v_hunt_name
  FROM public.hunts
  WHERE chicken_code = upper(p_code) AND status IN ('preparing', 'active', 'completed');

  IF v_hunt_id IS NOT NULL THEN
    v_role := 'chicken';

    INSERT INTO public.hunt_participants (hunt_id, user_id, role, team_id)
    VALUES (v_hunt_id, p_user_id, v_role, NULL)
    ON CONFLICT (hunt_id, user_id) DO UPDATE
      SET role = excluded.role;

    RETURN jsonb_build_object(
      'hunt_id', v_hunt_id,
      'hunt_name', v_hunt_name,
      'role', v_role::text,
      'team_id', NULL,
      'team_name', NULL
    );
  END IF;

  RETURN jsonb_build_object('error', 'Invalid or expired hunt code');
END;
$$;
