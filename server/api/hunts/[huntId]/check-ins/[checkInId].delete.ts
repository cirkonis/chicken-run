import { defineEventHandler, getRouterParam, createError } from "h3";
import { getAdminClient } from "../../../../utils/supabase";
import { deleteMediaFile } from "../../../../utils/storage";

// DELETE /api/hunts/:huntId/check-ins/:checkInId
// The check-in's author OR the hunt creator can delete it. Also removes the
// photo from storage. Uses the admin client (auth verified by middleware).
export default defineEventHandler(async (event) => {
  const userId = event.context.userId!;
  const huntId = getRouterParam(event, "huntId");
  const checkInId = getRouterParam(event, "checkInId");
  if (!huntId || !checkInId) {
    throw createError({ statusCode: 400, statusMessage: "Missing huntId or checkInId" });
  }

  const admin = getAdminClient();

  // Load the check-in to decide who may delete: its author OR a hunt manager.
  const { data: ci } = await admin
    .from("hunt_check_ins")
    .select("user_id, image_path")
    .eq("id", checkInId)
    .eq("hunt_id", huntId)
    .maybeSingle();

  if (!ci) throw createError({ statusCode: 404, statusMessage: "Check-in not found" });

  if (ci.user_id !== userId && !(await isHuntManager(huntId, userId))) {
    throw createError({ statusCode: 403, statusMessage: "You can only delete your own check-ins" });
  }

  const { error } = await admin.from("hunt_check_ins").delete().eq("id", checkInId);
  if (error) {
    throw createError({ statusCode: 500, statusMessage: `Failed to delete check-in: ${error.message}` });
  }

  // Best-effort photo cleanup — the row is already gone.
  if (ci.image_path) {
    try {
      await deleteMediaFile(ci.image_path);
    } catch (e: any) {
      console.error("Check-in image cleanup failed:", e.message);
    }
  }

  return { success: true };
});
