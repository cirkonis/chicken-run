import { defineEventHandler, getRouterParam, createError } from "h3";
import { getUserClient } from "../../utils/supabase";

// GET /api/hunts/:huntId — get a single hunt with bars, hints, participants
export default defineEventHandler(async (event) => {
  const userId = event.context.userId!;
  const huntId = getRouterParam(event, "huntId");
  const supabase = getUserClient(event);

  if (!huntId) {
    throw createError({ statusCode: 400, statusMessage: "Missing huntId" });
  }

  // Fetch hunt (RLS will enforce participant access)
  const { data: hunt, error: hError } = await supabase
    .from("hunts")
    .select("*")
    .eq("id", huntId)
    .single();

  if (hError || !hunt) {
    throw createError({
      statusCode: 404,
      statusMessage: "Hunt not found or you don't have access",
    });
  }

  // Fetch bars, hints, and participants in parallel
  const [barsResult, hintsResult, participantsResult] = await Promise.all([
    supabase
      .from("hunt_bars")
      .select("*")
      .eq("hunt_id", huntId)
      .order("name"),
    supabase
      .from("hints")
      .select("id, text, author_id, created_at")
      .eq("hunt_id", huntId)
      .order("created_at", { ascending: false }),
    supabase
      .from("hunt_participants")
      .select("user_id, role, joined_at, profiles(display_name, avatar_url)")
      .eq("hunt_id", huntId),
  ]);

  return {
    hunt: mapHunt(hunt),
    bars: (barsResult.data || []).map(mapBar),
    hints: (hintsResult.data || []).map(mapHint),
    participants: (participantsResult.data || []).map(mapParticipant),
  };
});
