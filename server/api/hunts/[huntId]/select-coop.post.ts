import { defineEventHandler, getRouterParam, readBody, createError } from "h3";
import { getAdminClient, getUserClient } from "../../../utils/supabase";

// POST /api/hunts/:huntId/select-coop
// Body: { teamId, barId }
// Chicken team permanently selects their coop bar.
export default defineEventHandler(async (event) => {
  const userId = event.context.userId!;
  const huntId = getRouterParam(event, "huntId");
  const supabase = getUserClient(event);
  const admin = getAdminClient();

  if (!huntId) {
    throw createError({ statusCode: 400, statusMessage: "Missing huntId" });
  }

  const body = await readBody<{ teamId: string; barId: string }>(event);

  if (!body?.teamId || !body?.barId) {
    throw createError({ statusCode: 400, statusMessage: "teamId and barId are required" });
  }

  // Verify the team is a chicken team in this hunt and hasn't picked yet
  const { data: team, error: teamError } = await supabase
    .from("hunt_teams")
    .select("id, hunt_id, is_chicken, selected_bar_id")
    .eq("id", body.teamId)
    .eq("hunt_id", huntId)
    .single();

  if (teamError || !team) {
    throw createError({ statusCode: 404, statusMessage: "Team not found" });
  }

  if (!team.is_chicken) {
    throw createError({ statusCode: 403, statusMessage: "Only chicken teams can select a coop" });
  }

  if (team.selected_bar_id) {
    throw createError({ statusCode: 409, statusMessage: "Coop has already been selected" });
  }

  // Verify the bar belongs to this hunt
  const { data: bar, error: barError } = await supabase
    .from("hunt_bars")
    .select("id")
    .eq("id", body.barId)
    .eq("hunt_id", huntId)
    .single();

  if (barError || !bar) {
    throw createError({ statusCode: 404, statusMessage: "Bar not found in this hunt" });
  }

  // Set the coop (permanent — only works when selected_bar_id IS NULL)
  const { error: updateError } = await admin
    .from("hunt_teams")
    .update({ selected_bar_id: body.barId })
    .eq("id", body.teamId)
    .is("selected_bar_id", null);

  if (updateError) {
    throw createError({ statusCode: 500, statusMessage: "Failed to save coop selection" });
  }

  return { success: true, barId: body.barId };
});
