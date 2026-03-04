import { defineEventHandler, readBody, getRouterParam, createError } from "h3";
import { getUserClient, requireUser } from "../../../../utils/supabase";

// POST /api/hunts/:huntId/hints — add a hint
// Body: { text: "Check the place near the river!" }
export default defineEventHandler(async (event) => {
  const userId = await requireUser(event);
  const huntId = getRouterParam(event, "huntId");
  const supabase = getUserClient(event);

  if (!huntId) {
    throw createError({ statusCode: 400, statusMessage: "Missing huntId" });
  }

  const body = await readBody<{ text: string }>(event);

  if (!body?.text?.trim()) {
    throw createError({ statusCode: 400, statusMessage: "Hint text is required" });
  }

  const { data, error } = await supabase
    .from("hints")
    .insert({
      hunt_id: huntId,
      author_id: userId,
      text: body.text.trim(),
    })
    .select("id, text, author_id, created_at")
    .single();

  if (error) {
    throw createError({
      statusCode: 500,
      statusMessage: `Failed to add hint: ${error.message}`,
    });
  }

  return { hint: data };
});
