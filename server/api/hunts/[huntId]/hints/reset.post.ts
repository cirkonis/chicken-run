import { defineEventHandler, getRouterParam, createError } from "h3";
import { getUserClient, requireUser } from "../../../../utils/supabase";

// POST /api/hunts/:huntId/hints/reset — delete all hints for a hunt (creator only)
export default defineEventHandler(async (event) => {
  const userId = await requireUser(event);
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
      statusMessage: "Only the hunt creator can reset hints",
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
