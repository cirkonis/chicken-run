import { defineEventHandler, getRouterParam, createError } from "h3";
import { getUserClient } from "../../utils/supabase";

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

  // Fetch bars, hints, participants, teams, chickens, expenses, arrivals in parallel
  const [barsResult, hintsResult, participantsResult, teamsResult, chickensResult, expensesResult, arrivalsResult] = await Promise.all([
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
  ]);

  return {
    hunt: mapHunt(hunt),
    bars: (barsResult.data || []).map(mapBar),
    hints: (hintsResult.data || []).map(mapHint),
    participants: (participantsResult.data || []).map(mapParticipant),
    teams: (teamsResult.data || []).map(mapTeam),
    chickens: (chickensResult.data || []).map(mapChicken),
    expenses: (expensesResult.data || []).map(mapExpense),
    arrivals: (arrivalsResult.data || []).map(mapArrival),
  };
});
