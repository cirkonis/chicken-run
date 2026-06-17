import { defineEventHandler, getRouterParam, createError } from "h3";
import { getAdminClient, isHuntManager } from "../../../../utils/supabase";

// GET /api/hunts/:huntId/managers — list a hunt's co-managers (issue #4).
// Any manager (the creator or a co-manager) may view the list. We resolve
// display names in a second query to avoid the ambiguous PostgREST embed
// (hunt_managers has two FKs to profiles: user_id and added_by).
export default defineEventHandler(async (event) => {
  const userId = event.context.userId!;
  const huntId = getRouterParam(event, "huntId");
  if (!huntId) throw createError({ statusCode: 400, statusMessage: "Missing huntId" });

  if (!(await isHuntManager(huntId, userId))) {
    throw createError({ statusCode: 403, statusMessage: "Only a hunt manager can view co-managers" });
  }

  const admin = getAdminClient();
  const { data: rows, error } = await admin
    .from("hunt_managers")
    .select("user_id, created_at")
    .eq("hunt_id", huntId)
    .order("created_at", { ascending: true });

  if (error) {
    throw createError({ statusCode: 500, statusMessage: `Failed to load co-managers: ${error.message}` });
  }

  const ids = (rows || []).map((r) => r.user_id);
  let nameMap: Record<string, string> = {};
  if (ids.length > 0) {
    const { data: profs } = await admin.from("profiles").select("id, display_name").in("id", ids);
    nameMap = Object.fromEntries((profs || []).map((p) => [p.id, p.display_name]));
  }

  return {
    managers: (rows || []).map((r) => ({
      userId: r.user_id,
      displayName: nameMap[r.user_id] || "Unknown",
      addedAt: r.created_at,
    })),
  };
});
