import { defineEventHandler, readBody, getRouterParam, createError } from "h3";
import { getUserClient } from "../../../../utils/supabase";

// POST /api/hunts/:huntId/expenses — add an expense
// Body: { amount: number, note?: string }
export default defineEventHandler(async (event) => {
  const userId = event.context.userId!;
  const huntId = getRouterParam(event, "huntId");
  const supabase = getUserClient(event);

  if (!huntId) {
    throw createError({ statusCode: 400, statusMessage: "Missing huntId" });
  }

  const body = await readBody<{ amount: number; note?: string }>(event);

  if (!body?.amount || body.amount <= 0) {
    throw createError({ statusCode: 400, statusMessage: "A positive amount is required" });
  }

  const { data, error } = await supabase
    .from("hunt_expenses")
    .insert({
      hunt_id: huntId,
      amount: Math.round(body.amount),
      note: (body.note || "").trim(),
      created_by: userId,
    })
    .select("*")
    .single();

  if (error) {
    throw createError({
      statusCode: 500,
      statusMessage: `Failed to add expense: ${error.message}`,
    });
  }

  return { expense: mapExpense(data) };
});
