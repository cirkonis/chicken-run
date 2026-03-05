import { defineEventHandler, getRouterParam, readBody, createError } from "h3";
import { getUserClient } from "../../../../../utils/supabase";

// POST /api/hunts/:huntId/teams/:teamId/rename
// Body: { name: "New Team Name" }
// Any participant on the team can rename it — but only once (renamed flag).
export default defineEventHandler(async (event) => {
  const userId = event.context.userId!;
  const huntId = getRouterParam(event, "huntId");
  const teamId = getRouterParam(event, "teamId");
  const supabase = getUserClient(event);

  if (!huntId || !teamId) {
    throw createError({ statusCode: 400, statusMessage: "Missing huntId or teamId" });
  }

  const body = await readBody<{ name: string }>(event);
  if (!body?.name?.trim()) {
    throw createError({ statusCode: 400, statusMessage: "Team name is required" });
  }

  // Fetch the team
  const { data: team, error: teamError } = await supabase
    .from("hunt_teams")
    .select("id, hunt_id, renamed")
    .eq("id", teamId)
    .eq("hunt_id", huntId)
    .single();

  if (teamError || !team) {
    throw createError({ statusCode: 404, statusMessage: "Team not found" });
  }

  if (team.renamed) {
    throw createError({
      statusCode: 409,
      statusMessage: "This team has already been renamed. Team names can only be changed once.",
    });
  }

  // Verify user is on this team
  const { data: participant } = await supabase
    .from("hunt_participants")
    .select("id")
    .eq("hunt_id", huntId)
    .eq("user_id", userId)
    .eq("team_id", teamId)
    .single();

  if (!participant) {
    throw createError({
      statusCode: 403,
      statusMessage: "You must be on this team to rename it",
    });
  }

  // Rename the team and set renamed = true
  const { data: updated, error: updateError } = await supabase
    .from("hunt_teams")
    .update({ name: body.name.trim(), renamed: true })
    .eq("id", teamId)
    .select()
    .single();

  if (updateError || !updated) {
    throw createError({
      statusCode: 500,
      statusMessage: `Failed to rename team: ${updateError?.message}`,
    });
  }

  return { team: mapTeam(updated) };
});
