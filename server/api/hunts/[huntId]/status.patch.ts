import { defineEventHandler, getRouterParam, readBody, createError } from "h3";
import { getUserClient } from "../../../utils/supabase";

// PATCH /api/hunts/:huntId/status
// Body: { status: "preparing" | "active" | "completed" }
// Creator only — changes the hunt status.
export default defineEventHandler(async (event) => {
  const userId = event.context.userId!;
  const huntId = getRouterParam(event, "huntId");
  const supabase = getUserClient(event);

  if (!huntId) {
    throw createError({ statusCode: 400, statusMessage: "Missing huntId" });
  }

  const body = await readBody<{ status: string }>(event);
  const validStatuses = ["preparing", "active", "completed"];

  if (!body?.status || !validStatuses.includes(body.status)) {
    throw createError({
      statusCode: 400,
      statusMessage: `Invalid status. Must be one of: ${validStatuses.join(", ")}`,
    });
  }

  // Verify hunt exists and user is the creator
  const { data: hunt, error: huntError } = await supabase
    .from("hunts")
    .select("id, creator_id, status")
    .eq("id", huntId)
    .single();

  if (huntError || !hunt) {
    throw createError({ statusCode: 404, statusMessage: "Hunt not found" });
  }

  // Creators AND co-managers may start/end the hunt (issue #4).
  if (!(await isHuntManager(huntId, userId))) {
    throw createError({ statusCode: 403, statusMessage: "Only a hunt manager can change status" });
  }

  // Build update payload
  const updatePayload: Record<string, any> = { status: body.status };

  // Set started_at when transitioning to active
  if (body.status === "active" && hunt.status !== "active") {
    updatePayload.started_at = new Date().toISOString();
  }

  // Set completed_at when transitioning to completed
  if (body.status === "completed" && hunt.status !== "completed") {
    updatePayload.completed_at = new Date().toISOString();
  }

  // Clear started_at when going back to preparing
  if (body.status === "preparing") {
    updatePayload.started_at = null;
    updatePayload.completed_at = null;
  }

  // Update status
  const { data: updated, error: updateError } = await supabase
    .from("hunts")
    .update(updatePayload)
    .eq("id", huntId)
    .select()
    .single();

  if (updateError || !updated) {
    throw createError({
      statusCode: 500,
      statusMessage: `Failed to update status: ${updateError?.message}`,
    });
  }

  return { hunt: mapHunt(updated) };
});
