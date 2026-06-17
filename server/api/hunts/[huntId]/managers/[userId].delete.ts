import { defineEventHandler, getRouterParam, createError } from "h3";
import { getAdminClient } from "../../../../utils/supabase";

// DELETE /api/hunts/:huntId/managers/:userId — remove a co-manager (issue #4).
// OWNER ONLY: only the hunt's creator may change the co-manager list.
export default defineEventHandler(async (event) => {
  const callerId = event.context.userId!;
  const huntId = getRouterParam(event, "huntId");
  const targetUserId = getRouterParam(event, "userId");
  if (!huntId || !targetUserId) {
    throw createError({ statusCode: 400, statusMessage: "Missing huntId or userId" });
  }

  const admin = getAdminClient();
  const { data: hunt } = await admin.from("hunts").select("creator_id").eq("id", huntId).maybeSingle();
  if (!hunt) throw createError({ statusCode: 404, statusMessage: "Hunt not found" });
  if (hunt.creator_id !== callerId) {
    throw createError({ statusCode: 403, statusMessage: "Only the hunt owner can remove co-managers" });
  }

  const { error } = await admin
    .from("hunt_managers")
    .delete()
    .eq("hunt_id", huntId)
    .eq("user_id", targetUserId);
  if (error) {
    throw createError({ statusCode: 500, statusMessage: `Failed to remove co-manager: ${error.message}` });
  }

  return { success: true };
});
