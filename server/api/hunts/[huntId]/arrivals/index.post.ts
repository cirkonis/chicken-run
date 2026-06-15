import { defineEventHandler, getRouterParam, readBody, createError } from "h3";
import { getAdminClient } from "../../../../utils/supabase";

// POST /api/hunts/:huntId/arrivals — record a team arrival (with optional photo).
//
// New flow: the photo (if any) is ALREADY in Storage (uploaded directly by the
// client via /api/media/upload-url); we just store its path.
// Body JSON: { teamId, note?, imagePath? }
// Only chickens or the hunt creator may record arrivals.
export default defineEventHandler(async (event) => {
  const userId = event.context.userId!;
  const huntId = getRouterParam(event, "huntId");
  if (!huntId) throw createError({ statusCode: 400, statusMessage: "Missing huntId" });

  const admin = getAdminClient();

  // ── Verify the user is a chicken participant or the hunt creator ─
  const [{ data: participant }, { data: huntRow }] = await Promise.all([
    admin.from("hunt_participants").select("role").eq("hunt_id", huntId).eq("user_id", userId).maybeSingle(),
    admin.from("hunts").select("creator_id").eq("id", huntId).maybeSingle(),
  ]);

  const isChicken = participant?.role === "chicken";
  const isCreator = huntRow?.creator_id === userId;
  if (!isChicken && !isCreator) {
    throw createError({ statusCode: 403, statusMessage: "Only chickens or the host can record arrivals" });
  }

  const body = await readBody<{ teamId?: string; note?: string; imagePath?: string }>(event);
  const teamId = body?.teamId?.trim() || "";
  const note = (body?.note || "").trim();
  const imagePath = body?.imagePath?.trim() || null;

  if (!teamId) throw createError({ statusCode: 400, statusMessage: "teamId is required" });
  if (imagePath && !imagePath.startsWith(`arrivals/${huntId}/`)) {
    throw createError({ statusCode: 400, statusMessage: "Invalid image path" });
  }

  const { data, error } = await admin
    .from("hunt_arrivals")
    .insert({ hunt_id: huntId, team_id: teamId, note, image_path: imagePath })
    .select("*, hunt_teams(name)")
    .single();

  if (error) {
    // Unique (hunt_id, team_id) violation = team already arrived.
    if (error.code === "23505") {
      throw createError({ statusCode: 409, statusMessage: "This team has already been recorded as arrived" });
    }
    throw createError({ statusCode: 500, statusMessage: `Failed to record arrival: ${error.message}` });
  }

  return { arrival: mapArrival(data) }; // mapArrival includes imagePath
});
