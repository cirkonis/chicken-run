import { defineEventHandler, getRouterParam, readBody, createError } from "h3";
import { getAdminClient } from "../../../../utils/supabase";
import { validateBattleTeams } from "../../../../utils/checkInTeams";

// PATCH /api/hunts/:huntId/check-ins/:checkInId
// Edit a check-in's note and/or the teams it "ran into". Author or hunt creator.
// Body: { note?: string, withTeamIds?: string[] }.
export default defineEventHandler(async (event) => {
  const userId = event.context.userId!;
  const huntId = getRouterParam(event, "huntId");
  const checkInId = getRouterParam(event, "checkInId");
  if (!huntId || !checkInId) {
    throw createError({ statusCode: 400, statusMessage: "Missing huntId or checkInId" });
  }

  const admin = getAdminClient();

  const [{ data: ci }, { data: hunt }] = await Promise.all([
    admin.from("hunt_check_ins").select("user_id, team_id").eq("id", checkInId).eq("hunt_id", huntId).maybeSingle(),
    admin.from("hunts").select("creator_id").eq("id", huntId).maybeSingle(),
  ]);
  if (!ci) throw createError({ statusCode: 404, statusMessage: "Check-in not found" });
  if (ci.user_id !== userId && hunt?.creator_id !== userId) {
    throw createError({ statusCode: 403, statusMessage: "You can only edit your own check-ins" });
  }

  const body = await readBody<{ note?: string; withTeamIds?: string[] }>(event);
  if (body.note === undefined && body.withTeamIds === undefined) {
    throw createError({ statusCode: 400, statusMessage: "Nothing to update" });
  }

  // Replace the battle teams if provided.
  if (body.withTeamIds !== undefined) {
    const battleTeams = await validateBattleTeams(admin, huntId, body.withTeamIds || [], ci.team_id);
    await admin.from("hunt_check_in_teams").delete().eq("check_in_id", checkInId);
    if (battleTeams.length) {
      await admin
        .from("hunt_check_in_teams")
        .insert(battleTeams.map((t) => ({ check_in_id: checkInId, team_id: t.id })));
    }
  }

  // Update the note (also touches the row so the realtime feed refreshes).
  if (body.note !== undefined) {
    await admin.from("hunt_check_ins").update({ note: (body.note || "").trim() }).eq("id", checkInId);
  }

  // Re-read with the battle teams embedded.
  const { data, error } = await admin
    .from("hunt_check_ins")
    .select("*, hunt_check_in_teams(hunt_teams(id, name))")
    .eq("id", checkInId)
    .single();
  if (error) {
    throw createError({ statusCode: 500, statusMessage: `Failed to update check-in: ${error.message}` });
  }

  return { checkIn: mapCheckIn(data) };
});
