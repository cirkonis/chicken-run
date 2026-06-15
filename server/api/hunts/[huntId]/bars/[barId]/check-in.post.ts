import { defineEventHandler, getRouterParam, readBody, createError } from "h3";
import { getAdminClient } from "../../../../../utils/supabase";

// POST /api/hunts/:huntId/bars/:barId/check-in — record a bar visit.
//
// New flow: the photo is ALREADY in Storage (the client uploaded it directly via
// /api/media/upload-url), so this endpoint just takes JSON and stores the path.
// No multipart, no byte streaming, no Vercel body-limit landmine.
//
// Body JSON: { imagePath: string, note?: string, withTeamId?: string | null }
// Uses the admin client to bypass RLS; auth is validated by the middleware.
export default defineEventHandler(async (event) => {
  const userId = event.context.userId!;
  const huntId = getRouterParam(event, "huntId");
  const barId = getRouterParam(event, "barId");

  if (!huntId || !barId) {
    throw createError({ statusCode: 400, statusMessage: "Missing huntId or barId" });
  }

  const admin = getAdminClient();

  // ── Verify the user is a participant + get their team_id ──
  const { data: participant } = await admin
    .from("hunt_participants")
    .select("role, team_id")
    .eq("hunt_id", huntId)
    .eq("user_id", userId)
    .maybeSingle();

  if (!participant) {
    throw createError({
      statusCode: 403,
      statusMessage: "You must be a hunt participant to check in",
    });
  }

  // ── Read body ─────────────────────────────────────────
  const body = await readBody<{
    imagePath?: string;
    note?: string;
    withTeamId?: string | null;
  }>(event);

  const note = (body?.note || "").trim();
  const imagePath = body?.imagePath?.trim() || null;
  const withTeamId = body?.withTeamId || null;

  // ── Require a photo (the whole point of the feed) ─────
  if (!imagePath) {
    throw createError({ statusCode: 400, statusMessage: "Photo is required for check-in" });
  }

  // Sanity-check the path belongs to this hunt's check-in folder, so a client
  // can't point a check-in at someone else's file.
  if (!imagePath.startsWith(`check-ins/${huntId}/`)) {
    throw createError({ statusCode: 400, statusMessage: "Invalid image path" });
  }

  // ── Validate withTeamId (battle mechanic) if provided ──
  if (withTeamId) {
    const { data: targetTeam } = await admin
      .from("hunt_teams")
      .select("id, is_chicken")
      .eq("id", withTeamId)
      .eq("hunt_id", huntId)
      .maybeSingle();

    if (!targetTeam || targetTeam.is_chicken) {
      throw createError({ statusCode: 400, statusMessage: "Invalid team selection" });
    }
    if (targetTeam.id === participant.team_id) {
      throw createError({ statusCode: 400, statusMessage: "Cannot select your own team" });
    }
  }

  // ── Insert the check-in (with the image path) ─────────
  const { data, error } = await admin
    .from("hunt_check_ins")
    .insert({
      hunt_id: huntId,
      bar_id: barId,
      team_id: participant.team_id ?? null,
      with_team_id: withTeamId,
      user_id: userId,
      note,
      image_path: imagePath,
    })
    .select("*")
    .single();

  if (error) {
    throw createError({
      statusCode: 500,
      statusMessage: `Failed to record check-in: ${error.message}`,
    });
  }

  // ── Mark the bar as checked ───────────────────────────
  const checkedAt = new Date().toISOString();
  await admin
    .from("hunt_bars")
    .update({ check_status: "checked", checked_by: userId, checked_at: checkedAt })
    .eq("id", barId)
    .eq("hunt_id", huntId);

  // ── Resolve the battle team's name for the response ───
  let withTeamName: string | null = null;
  if (withTeamId) {
    const { data: wt } = await admin
      .from("hunt_teams")
      .select("name")
      .eq("id", withTeamId)
      .maybeSingle();
    withTeamName = wt?.name ?? null;
  }

  const mapped = mapCheckIn(data); // includes imagePath
  return {
    checkIn: { ...mapped, withTeamName },
    bar: { checkStatus: "checked", checkedBy: userId, checkedAt },
  };
});
