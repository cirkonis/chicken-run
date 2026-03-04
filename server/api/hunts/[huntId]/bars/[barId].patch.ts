import { defineEventHandler, readBody, getRouterParam, createError } from "h3";
import { getUserClient } from "../../../../utils/supabase";

// PATCH /api/hunts/:huntId/bars/:barId — update a bar's check status
// Body: { checkStatus: "unchecked" | "checked" | "not_checking" }
export default defineEventHandler(async (event) => {
  const userId = event.context.userId!;
  const huntId = getRouterParam(event, "huntId");
  const barId = getRouterParam(event, "barId");
  const supabase = getUserClient(event);

  if (!huntId || !barId) {
    throw createError({ statusCode: 400, statusMessage: "Missing huntId or barId" });
  }

  const body = await readBody<{ checkStatus: string }>(event);
  const validStatuses = ["unchecked", "checked", "not_checking"];

  if (!body?.checkStatus || !validStatuses.includes(body.checkStatus)) {
    throw createError({
      statusCode: 400,
      statusMessage: `checkStatus must be one of: ${validStatuses.join(", ")}`,
    });
  }

  const updateData: Record<string, unknown> = {
    check_status: body.checkStatus,
  };

  // Track who checked it and when
  if (body.checkStatus === "checked") {
    updateData.checked_by = userId;
    updateData.checked_at = new Date().toISOString();
  } else {
    updateData.checked_by = null;
    updateData.checked_at = null;
  }

  const { data, error } = await supabase
    .from("hunt_bars")
    .update(updateData)
    .eq("id", barId)
    .eq("hunt_id", huntId)
    .select()
    .single();

  if (error) {
    throw createError({
      statusCode: error.code === "PGRST116" ? 404 : 500,
      statusMessage: `Failed to update bar: ${error.message}`,
    });
  }

  return {
    bar: mapBar(data),
  };
});
