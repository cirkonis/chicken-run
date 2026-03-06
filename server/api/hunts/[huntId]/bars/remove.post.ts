import { defineEventHandler, readBody, getRouterParam, createError } from "h3";
import { getUserClient } from "../../../../utils/supabase";

// POST /api/hunts/:huntId/bars/remove — permanently remove bars from the hunt
// Body: { barIds: string[] }
// Creator-only: host curates which bars stay in the game
export default defineEventHandler(async (event) => {
  const userId = event.context.userId!;
  const huntId = getRouterParam(event, "huntId");
  const supabase = getUserClient(event);

  if (!huntId) {
    throw createError({ statusCode: 400, statusMessage: "Missing huntId" });
  }

  const body = await readBody<{ barIds: string[] }>(event);

  if (!body?.barIds?.length) {
    throw createError({ statusCode: 400, statusMessage: "barIds array is required" });
  }

  // Verify the user is the creator
  const { data: hunt } = await supabase
    .from("hunts")
    .select("creator_id")
    .eq("id", huntId)
    .single();

  if (!hunt || hunt.creator_id !== userId) {
    throw createError({
      statusCode: 403,
      statusMessage: "Only the hunt creator can remove bars",
    });
  }

  const { error, count } = await supabase
    .from("hunt_bars")
    .delete()
    .eq("hunt_id", huntId)
    .in("id", body.barIds);

  if (error) {
    throw createError({
      statusCode: 500,
      statusMessage: `Failed to remove bars: ${error.message}`,
    });
  }

  return { ok: true, removedCount: count ?? 0 };
});
