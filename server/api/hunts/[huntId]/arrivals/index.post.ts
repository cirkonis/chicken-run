import { defineEventHandler, readBody, getRouterParam, createError } from "h3";
import { getUserClient } from "../../../../utils/supabase";

// POST /api/hunts/:huntId/arrivals — record a team arrival
// Body: { teamId: string }
export default defineEventHandler(async (event) => {
  const huntId = getRouterParam(event, "huntId");
  const supabase = getUserClient(event);

  if (!huntId) {
    throw createError({ statusCode: 400, statusMessage: "Missing huntId" });
  }

  const body = await readBody<{ teamId: string }>(event);

  if (!body?.teamId) {
    throw createError({ statusCode: 400, statusMessage: "teamId is required" });
  }

  const { data, error } = await supabase
    .from("hunt_arrivals")
    .insert({
      hunt_id: huntId,
      team_id: body.teamId,
    })
    .select("*, hunt_teams(name)")
    .single();

  if (error) {
    // Unique constraint violation = team already arrived
    if (error.code === "23505") {
      throw createError({
        statusCode: 409,
        statusMessage: "This team has already been recorded as arrived",
      });
    }
    throw createError({
      statusCode: 500,
      statusMessage: `Failed to record arrival: ${error.message}`,
    });
  }

  return { arrival: mapArrival(data) };
});
