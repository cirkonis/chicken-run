import { defineEventHandler, getRouterParam, readBody, createError } from "h3";
import { getAdminClient } from "../../../../utils/supabase";

// PATCH /api/hunts/:huntId/check-ins/:checkInId
// Edit a check-in's note and/or the team it "ran into" (the battle annotation).
// The author OR the hunt creator may edit. Body: { note?, withTeamId? }.
// (Photo replacement is a separate, later feature.)
export default defineEventHandler(async (event) => {
  const userId = event.context.userId!;
  const huntId = getRouterParam(event, "huntId");
  const checkInId = getRouterParam(event, "checkInId");
  if (!huntId || !checkInId) {
    throw createError({ statusCode: 400, statusMessage: "Missing huntId or checkInId" });
  }

  const admin = getAdminClient();

  const [{ data: ci }, { data: hunt }] = await Promise.all([
    admin
      .from("hunt_check_ins")
      .select("user_id, team_id")
      .eq("id", checkInId)
      .eq("hunt_id", huntId)
      .maybeSingle(),
    admin.from("hunts").select("creator_id").eq("id", huntId).maybeSingle(),
  ]);

  if (!ci) throw createError({ statusCode: 404, statusMessage: "Check-in not found" });
  if (ci.user_id !== userId && hunt?.creator_id !== userId) {
    throw createError({ statusCode: 403, statusMessage: "You can only edit your own check-ins" });
  }

  const body = await readBody<{ note?: string; withTeamId?: string | null }>(event);
  const update: Record<string, any> = {};

  if (body.note !== undefined) {
    update.note = (body.note || "").trim();
  }

  if (body.withTeamId !== undefined) {
    const withTeamId = body.withTeamId || null;
    if (withTeamId) {
      const { data: team } = await admin
        .from("hunt_teams")
        .select("id, is_chicken")
        .eq("id", withTeamId)
        .eq("hunt_id", huntId)
        .maybeSingle();
      if (!team || team.is_chicken) {
        throw createError({ statusCode: 400, statusMessage: "Invalid team selection" });
      }
      if (team.id === ci.team_id) {
        throw createError({ statusCode: 400, statusMessage: "Cannot select your own team" });
      }
    }
    update.with_team_id = withTeamId;
  }

  if (Object.keys(update).length === 0) {
    throw createError({ statusCode: 400, statusMessage: "Nothing to update" });
  }

  const { data, error } = await admin
    .from("hunt_check_ins")
    .update(update)
    .eq("id", checkInId)
    .select("*, with_team:hunt_teams!hunt_check_ins_with_team_id_fkey(name)")
    .single();

  if (error) {
    throw createError({ statusCode: 500, statusMessage: `Failed to update check-in: ${error.message}` });
  }

  return { checkIn: mapCheckIn(data) };
});
