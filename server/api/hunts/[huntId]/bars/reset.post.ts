import { defineEventHandler, getRouterParam, createError } from "h3";
import { getUserClient } from "../../../../utils/supabase";

// POST /api/hunts/:huntId/bars/reset — reset all bar statuses to unchecked
export default defineEventHandler(async (event) => {
  const userId = event.context.userId!;
  const huntId = getRouterParam(event, "huntId");
  const supabase = getUserClient(event);

  if (!huntId) {
    throw createError({ statusCode: 400, statusMessage: "Missing huntId" });
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
      statusMessage: "Only the hunt creator can reset bar statuses",
    });
  }

  const { error, count } = await supabase
    .from("hunt_bars")
    .update({
      check_status: "unchecked",
      checked_by: null,
      checked_at: null,
    })
    .eq("hunt_id", huntId);

  if (error) {
    throw createError({
      statusCode: 500,
      statusMessage: `Reset failed: ${error.message}`,
    });
  }

  return { ok: true, resetCount: count ?? 0 };
});
