import { defineEventHandler, getRouterParam, createError } from "h3";
import { getAdminClient } from "../../../../utils/supabase";
import { deleteMediaFile } from "../../../../utils/storage";

// DELETE /api/hunts/:huntId/arrivals/:arrivalId — remove an arrival
// Uses admin client to bypass RLS; auth validated by middleware.
export default defineEventHandler(async (event) => {
  const userId = event.context.userId!;
  const huntId = getRouterParam(event, "huntId");
  const arrivalId = getRouterParam(event, "arrivalId");

  if (!huntId || !arrivalId) {
    throw createError({ statusCode: 400, statusMessage: "Missing huntId or arrivalId" });
  }

  const admin = getAdminClient();

  // ── Verify user is a chicken participant or the hunt creator ─
  const [{ data: participant }, { data: huntRow }] = await Promise.all([
    admin
      .from("hunt_participants")
      .select("role")
      .eq("hunt_id", huntId)
      .eq("user_id", userId)
      .single(),
    admin
      .from("hunts")
      .select("creator_id")
      .eq("id", huntId)
      .single(),
  ]);

  const isChicken = participant?.role === "chicken";
  const isCreator = huntRow?.creator_id === userId;

  if (!isChicken && !isCreator) {
    throw createError({
      statusCode: 403,
      statusMessage: "Only chickens or the host can manage arrivals",
    });
  }

  // ── Fetch arrival to get image_path before deleting ─────
  const { data: arrival } = await admin
    .from("hunt_arrivals")
    .select("id, image_path")
    .eq("id", arrivalId)
    .eq("hunt_id", huntId)
    .single();

  if (!arrival) {
    throw createError({ statusCode: 404, statusMessage: "Arrival not found" });
  }

  // ── Delete the arrival row ──────────────────────────────
  const { error } = await admin
    .from("hunt_arrivals")
    .delete()
    .eq("id", arrivalId)
    .eq("hunt_id", huntId);

  if (error) {
    throw createError({
      statusCode: 500,
      statusMessage: `Failed to delete arrival: ${error.message}`,
    });
  }

  // ── Clean up storage if the arrival had an image ────────
  if (arrival.image_path) {
    try {
      await deleteMediaFile(arrival.image_path);
    } catch (cleanupErr: any) {
      // Non-fatal — arrival is already deleted
      console.error("Arrival image cleanup failed:", cleanupErr.message);
    }
  }

  return { success: true };
});
