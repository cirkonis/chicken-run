import { defineEventHandler, getRouterParam, createError } from "h3";
import { getAdminClient } from "../../../../utils/supabase";

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

  // Verify user is a chicken participant or the hunt creator
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

  return { success: true };
});
