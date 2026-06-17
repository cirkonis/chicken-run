import { defineEventHandler, getRouterParam, createError } from "h3";
import { getAdminClient } from "../../../../utils/supabase";
import { deleteMediaFile } from "../../../../utils/storage";

// DELETE /api/hunts/:huntId/hints/:hintId — delete a single hint
// Uses admin client to bypass RLS; auth validated by middleware.
export default defineEventHandler(async (event) => {
  const userId = event.context.userId!;
  const huntId = getRouterParam(event, "huntId");
  const hintId = getRouterParam(event, "hintId");

  if (!huntId || !hintId) {
    throw createError({ statusCode: 400, statusMessage: "Missing huntId or hintId" });
  }

  const admin = getAdminClient();

  // ── Verify user is a chicken participant or a hunt manager (issue #4) ─
  const { data: participant } = await admin
    .from("hunt_participants")
    .select("role")
    .eq("hunt_id", huntId)
    .eq("user_id", userId)
    .maybeSingle();

  const isChicken = participant?.role === "chicken";

  if (!isChicken && !(await isHuntManager(huntId, userId))) {
    throw createError({
      statusCode: 403,
      statusMessage: "Only chickens or a hunt manager can delete hints",
    });
  }

  // ── Fetch hint to get image_path before deleting ────────
  const { data: hint } = await admin
    .from("hints")
    .select("id, image_path")
    .eq("id", hintId)
    .eq("hunt_id", huntId)
    .single();

  if (!hint) {
    throw createError({ statusCode: 404, statusMessage: "Hint not found" });
  }

  // ── Delete the hint row ─────────────────────────────────
  const { error } = await admin
    .from("hints")
    .delete()
    .eq("id", hintId)
    .eq("hunt_id", huntId);

  if (error) {
    throw createError({
      statusCode: 500,
      statusMessage: `Failed to delete hint: ${error.message}`,
    });
  }

  // ── Clean up storage if the hint had an image ───────────
  if (hint.image_path) {
    try {
      await deleteMediaFile(hint.image_path);
    } catch (cleanupErr: any) {
      // Non-fatal — hint is already deleted
      console.error("Hint image cleanup failed:", cleanupErr.message);
    }
  }

  return { success: true };
});
