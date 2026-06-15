import { defineEventHandler, getRouterParam, createError } from "h3";
import { getUserClient, getAdminClient } from "../../utils/supabase";

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

  // Use admin client for child-table queries so the hunt creator (who is NOT
  // in hunt_participants) can still read all data.  Access is already verified
  // above via the RLS-scoped hunt fetch.
  const admin = getAdminClient();

  // Fetch bars, hints, participants, teams, chickens, expenses, arrivals, check-ins in parallel
  const [barsResult, hintsResult, participantsResult, teamsResult, chickensResult, expensesResult, arrivalsResult, checkInsResult] = await Promise.all([
    admin
      .from("hunt_bars")
      .select("*")
      .eq("hunt_id", huntId)
      .order("name"),
    admin
      .from("hints")
      .select("id, text, author_id, created_at, image_path")
      .eq("hunt_id", huntId)
      .order("created_at", { ascending: false }),
    admin
      .from("hunt_participants")
      .select("user_id, role, joined_at, team_id, profiles(display_name, avatar_url), hunt_teams(name)")
      .eq("hunt_id", huntId),
    admin
      .from("hunt_teams")
      .select("*, hunt_team_members(*)")
      .eq("hunt_id", huntId)
      .order("display_order"),
    admin
      .from("hunt_chickens")
      .select("*")
      .eq("hunt_id", huntId)
      .order("created_at"),
    admin
      .from("hunt_expenses")
      .select("*")
      .eq("hunt_id", huntId)
      .order("created_at", { ascending: false }),
    admin
      .from("hunt_arrivals")
      .select("*, hunt_teams(name)")
      .eq("hunt_id", huntId)
      .order("arrived_at"),
    admin
      .from("hunt_check_ins")
      .select("*, with_team:hunt_teams!hunt_check_ins_with_team_id_fkey(name)")
      .eq("hunt_id", huntId)
      .order("created_at"),
  ]);

  // All three feed types (hints, arrivals, check-ins) serve their photos through
  // the stable, private /api/media proxy, so we return the raw imagePath and the
  // client builds the URL (see useMedia / MediaImage.vue). No signed URLs here.
  const hints = (hintsResult.data || []).map(mapHint);
  const arrivals = (arrivalsResult.data || []).map(mapArrival);
  const checkIns = (checkInsResult.data || []).map(mapCheckIn);

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
