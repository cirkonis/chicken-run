import { defineEventHandler, getRouterParam, readBody, createError } from "h3";
import { getAdminClient } from "../../../../../utils/supabase";
import { validateBattleTeams } from "../../../../../utils/checkInTeams";

// POST /api/hunts/:huntId/bars/:barId/check-in — record a bar visit.
//
// Body JSON: { imagePath: string, note?: string, withTeamIds?: string[] }
//   withTeamIds = the OTHER teams you ran into here (the multi-team "battle").
// The photo is already in Storage (client uploaded it directly); we store the path.
export default defineEventHandler(async (event) => {
  const userId = event.context.userId!;
  const huntId = getRouterParam(event, "huntId");
  const barId = getRouterParam(event, "barId");
  if (!huntId || !barId) {
    throw createError({ statusCode: 400, statusMessage: "Missing huntId or barId" });
  }

  const admin = getAdminClient();

  // ── Verify participant + get their team ───────────────
  const { data: participant } = await admin
    .from("hunt_participants")
    .select("role, team_id")
    .eq("hunt_id", huntId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!participant) {
    throw createError({ statusCode: 403, statusMessage: "You must be a hunt participant to check in" });
  }

  // ── Read + validate body ──────────────────────────────
  const body = await readBody<{ imagePath?: string; note?: string; withTeamIds?: string[] }>(event);
  const note = (body?.note || "").trim();
  const imagePath = body?.imagePath?.trim() || null;

  if (!imagePath) {
    throw createError({ statusCode: 400, statusMessage: "Photo is required for check-in" });
  }
  if (!imagePath.startsWith(`check-ins/${huntId}/`)) {
    throw createError({ statusCode: 400, statusMessage: "Invalid image path" });
  }

  // The teams you ran into (any number) — validated against this hunt.
  const battleTeams = await validateBattleTeams(admin, huntId, body?.withTeamIds || [], participant.team_id);

  // ── Insert the check-in ───────────────────────────────
  const { data, error } = await admin
    .from("hunt_check_ins")
    .insert({
      hunt_id: huntId,
      bar_id: barId,
      team_id: participant.team_id ?? null,
      user_id: userId,
      note,
      image_path: imagePath,
    })
    .select("*")
    .single();
  if (error) {
    throw createError({ statusCode: 500, statusMessage: `Failed to record check-in: ${error.message}` });
  }

  // ── Record the battle teams ───────────────────────────
  if (battleTeams.length) {
    const { error: btErr } = await admin
      .from("hunt_check_in_teams")
      .insert(battleTeams.map((t) => ({ check_in_id: data.id, team_id: t.id })));
    if (btErr) console.error("Failed to record battle teams:", btErr.message);
  }

  // ── Mark the bar checked ──────────────────────────────
  const checkedAt = new Date().toISOString();
  await admin
    .from("hunt_bars")
    .update({ check_status: "checked", checked_by: userId, checked_at: checkedAt })
    .eq("id", barId)
    .eq("hunt_id", huntId);

  return {
    checkIn: { ...mapCheckIn(data), withTeams: battleTeams },
    bar: { checkStatus: "checked", checkedBy: userId, checkedAt },
  };
});
