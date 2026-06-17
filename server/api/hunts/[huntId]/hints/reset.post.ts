import { defineEventHandler, getRouterParam, createError } from "h3";
import { getUserClient } from "../../../../utils/supabase";

// POST /api/hunts/:huntId/hints/reset — delete all hints for a hunt (creator only)
export default defineEventHandler(async (event) => {
  const userId = event.context.userId!;
  const huntId = getRouterParam(event, "huntId");
  const supabase = getUserClient(event);

  if (!huntId) {
    throw createError({ statusCode: 400, statusMessage: "Missing huntId" });
  }

  // Verify the user may manage this hunt (creator or co-manager — issue #4)
  if (!(await isHuntManager(huntId, userId))) {
    throw createError({
      statusCode: 403,
      statusMessage: "Only a hunt manager can reset hints",
    });
  }

  const { error } = await supabase
    .from("hints")
    .delete()
    .eq("hunt_id", huntId);

  if (error) {
    throw createError({
      statusCode: 500,
      statusMessage: `Failed to reset hints: ${error.message}`,
    });
  }

  return { ok: true };
});
