import { defineEventHandler, getRouterParam, createError } from "h3";
import { getUserClient } from "../../utils/supabase";
import { getSignedImageUrls } from "../../utils/storage";

// GET /api/hunts/:huntId — get a single hunt with bars, hints, participants, teams
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

  // Fetch bars, hints, participants, teams, chickens, expenses, arrivals, check-ins in parallel
  const [barsResult, hintsResult, participantsResult, teamsResult, chickensResult, expensesResult, arrivalsResult, checkInsResult] = await Promise.all([
    supabase
      .from("hunt_bars")
      .select("*")
      .eq("hunt_id", huntId)
      .order("name"),
    supabase
      .from("hints")
      .select("id, text, author_id, created_at, image_path")
      .eq("hunt_id", huntId)
      .order("created_at", { ascending: false }),
    supabase
      .from("hunt_participants")
      .select("user_id, role, joined_at, team_id, profiles(display_name, avatar_url), hunt_teams(name)")
      .eq("hunt_id", huntId),
    supabase
      .from("hunt_teams")
      .select("*, hunt_team_members(*)")
      .eq("hunt_id", huntId)
      .order("display_order"),
    supabase
      .from("hunt_chickens")
      .select("*")
      .eq("hunt_id", huntId)
      .order("created_at"),
    supabase
      .from("hunt_expenses")
      .select("*")
      .eq("hunt_id", huntId)
      .order("created_at", { ascending: false }),
    supabase
      .from("hunt_arrivals")
      .select("*, hunt_teams(name)")
      .eq("hunt_id", huntId)
      .order("arrived_at"),
    supabase
      .from("hunt_check_ins")
      .select("*, with_team:hunt_teams!hunt_check_ins_with_team_id_fkey(name)")
      .eq("hunt_id", huntId)
      .order("created_at"),
  ]);

  // Map hints, arrivals, check-ins; collect all image paths for batch signed URL generation
  const mappedHints = (hintsResult.data || []).map(mapHint);
  const mappedArrivals = (arrivalsResult.data || []).map(mapArrival);
  const mappedCheckIns = (checkInsResult.data || []).map(mapCheckIn);

  const allImagePaths = [
    ...mappedHints.map((h) => h.imagePath),
    ...mappedArrivals.map((a) => a.imagePath),
    ...mappedCheckIns.map((c) => c.imagePath),
  ].filter((p): p is string => !!p);

  const signedUrls = await getSignedImageUrls(allImagePaths);

  const hints = mappedHints.map(({ imagePath, ...hint }) => ({
    ...hint,
    imageUrl: imagePath ? signedUrls.get(imagePath) || null : null,
  }));

  const arrivals = mappedArrivals.map(({ imagePath, ...arrival }) => ({
    ...arrival,
    imageUrl: imagePath ? signedUrls.get(imagePath) || null : null,
  }));

  const checkIns = mappedCheckIns.map(({ imagePath, ...checkIn }) => ({
    ...checkIn,
    imageUrl: imagePath ? signedUrls.get(imagePath) || null : null,
  }));

  return {
    hunt: mapHunt(hunt),
    bars: (barsResult.data || []).map(mapBar),
    hints,
    participants: (participantsResult.data || []).map(mapParticipant),
    teams: (teamsResult.data || []).map(mapTeam),
    chickens: (chickensResult.data || []).map(mapChicken),
    expenses: (expensesResult.data || []).map(mapExpense),
    arrivals,
    checkIns,
  };
});
