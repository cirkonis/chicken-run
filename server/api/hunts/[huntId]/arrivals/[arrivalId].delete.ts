import { defineEventHandler, getRouterParam, createError } from "h3";
import { getUserClient } from "../../../../utils/supabase";

// DELETE /api/hunts/:huntId/arrivals/:arrivalId — remove an arrival
export default defineEventHandler(async (event) => {
  const huntId = getRouterParam(event, "huntId");
  const arrivalId = getRouterParam(event, "arrivalId");
  const supabase = getUserClient(event);

  if (!huntId || !arrivalId) {
    throw createError({ statusCode: 400, statusMessage: "Missing huntId or arrivalId" });
  }

  // RLS handles authorization (only chickens or hunt creator can delete)
  const { error } = await supabase
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
