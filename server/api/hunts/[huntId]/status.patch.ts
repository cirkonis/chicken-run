import { defineEventHandler, getRouterParam, readBody, createError } from "h3";
import { getUserClient } from "../../../utils/supabase";

// PATCH /api/hunts/:huntId/status
// Body: { status: "active" | "completed" | "archived" }
// Creator only — changes the hunt status.
export default defineEventHandler(async (event) => {
  const userId = event.context.userId!;
  const huntId = getRouterParam(event, "huntId");
  const supabase = getUserClient(event);

  if (!huntId) {
    throw createError({ statusCode: 400, statusMessage: "Missing huntId" });
  }

  const body = await readBody<{ status: string }>(event);
  const validStatuses = ["active", "completed", "archived"];

  if (!body?.status || !validStatuses.includes(body.status)) {
    throw createError({
      statusCode: 400,
      statusMessage: `Invalid status. Must be one of: ${validStatuses.join(", ")}`,
    });
  }

  // Verify hunt exists and user is the creator
  const { data: hunt, error: huntError } = await supabase
    .from("hunts")
    .select("id, creator_id")
    .eq("id", huntId)
    .single();

  if (huntError || !hunt) {
    throw createError({ statusCode: 404, statusMessage: "Hunt not found" });
  }

  if (hunt.creator_id !== userId) {
    throw createError({ statusCode: 403, statusMessage: "Only the hunt creator can change status" });
  }

  // Update status
  const { data: updated, error: updateError } = await supabase
    .from("hunts")
    .update({ status: body.status })
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
