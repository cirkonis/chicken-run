import { defineEventHandler, getRouterParam, createError } from "h3";
import { getUserClient } from "../../../../utils/supabase";

// DELETE /api/hunts/:huntId/expenses/:expenseId — delete an expense
export default defineEventHandler(async (event) => {
  const huntId = getRouterParam(event, "huntId");
  const expenseId = getRouterParam(event, "expenseId");
  const supabase = getUserClient(event);

  if (!huntId || !expenseId) {
    throw createError({ statusCode: 400, statusMessage: "Missing huntId or expenseId" });
  }

  // RLS handles authorization (only expense author or hunt creator can delete)
  const { error } = await supabase
    .from("hunt_expenses")
    .delete()
    .eq("id", expenseId)
    .eq("hunt_id", huntId);

  if (error) {
    throw createError({
      statusCode: 500,
      statusMessage: `Failed to delete expense: ${error.message}`,
    });
  }

  return { success: true };
});
