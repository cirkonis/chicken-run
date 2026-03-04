import { defineEventHandler, getRouterParam, createError } from "h3";
import { getUserClient, requireUser } from "../../../../utils/supabase";

// GET /api/hunts/:huntId/hints
export default defineEventHandler(async (event) => {
  await requireUser(event);
  const huntId = getRouterParam(event, "huntId");
  const supabase = getUserClient(event);

  if (!huntId) {
    throw createError({ statusCode: 400, statusMessage: "Missing huntId" });
  }

  const { data, error } = await supabase
    .from("hints")
    .select("id, text, author_id, created_at, profiles(display_name)")
    .eq("hunt_id", huntId)
    .order("created_at", { ascending: false });

  if (error) {
    throw createError({
      statusCode: 500,
      statusMessage: `Failed to fetch hints: ${error.message}`,
    });
  }

  return {
    hints: (data || []).map((h: any) => ({
      id: h.id,
      text: h.text,
      authorId: h.author_id,
      authorName: h.profiles?.display_name || "Unknown",
      createdAt: h.created_at,
    })),
  };
});
