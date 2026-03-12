import {
  defineEventHandler,
  getRouterParam,
  createError,
  readMultipartFormData,
} from "h3";
import { getAdminClient } from "../../../../../utils/supabase";
import {
  uploadCheckInImage,
  getSignedImageUrl,
  MAX_HUNT_STORAGE_BYTES,
} from "../../../../../utils/storage";

// POST /api/hunts/:huntId/bars/:barId/check-in — record a bar visit
// Body: multipart/form-data with required "image", optional "note" and "withTeamId".
// Uses admin client to bypass RLS; auth validated by middleware.
export default defineEventHandler(async (event) => {
  const userId = event.context.userId!;
  const huntId = getRouterParam(event, "huntId");
  const barId = getRouterParam(event, "barId");

  if (!huntId || !barId) {
    throw createError({ statusCode: 400, statusMessage: "Missing huntId or barId" });
  }

  const admin = getAdminClient();

  // ── Verify user is a participant + get their team_id ────
  const [{ data: participant }, { data: huntRow }] = await Promise.all([
    admin
      .from("hunt_participants")
      .select("role, team_id")
      .eq("hunt_id", huntId)
      .eq("user_id", userId)
      .single(),
    admin
      .from("hunts")
      .select("creator_id, storage_used_bytes")
      .eq("id", huntId)
      .single(),
  ]);

  if (!participant) {
    throw createError({
      statusCode: 403,
      statusMessage: "You must be a hunt participant to check in",
    });
  }

  // ── Parse multipart form data ─────────────────────────
  const formData = await readMultipartFormData(event);
  if (!formData) {
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid request body",
    });
  }

  const notePart = formData.find((p) => p.name === "note");
  const imagePart = formData.find((p) => p.name === "image");
  const withTeamIdPart = formData.find((p) => p.name === "withTeamId");
  const note = notePart?.data?.toString("utf-8")?.trim() || "";
  const withTeamId = withTeamIdPart?.data?.toString("utf-8")?.trim() || null;

  // ── Require photo ───────────────────────────────────
  if (!imagePart?.data) {
    throw createError({
      statusCode: 400,
      statusMessage: "Photo is required for check-in",
    });
  }

  // ── Validate withTeamId if provided ─────────────────
  if (withTeamId) {
    const { data: targetTeam } = await admin
      .from("hunt_teams")
      .select("id, is_chicken")
      .eq("id", withTeamId)
      .eq("hunt_id", huntId)
      .single();

    if (!targetTeam || targetTeam.is_chicken) {
      throw createError({ statusCode: 400, statusMessage: "Invalid team selection" });
    }
    if (targetTeam.id === participant.team_id) {
      throw createError({ statusCode: 400, statusMessage: "Cannot select your own team" });
    }
  }

  // ── Validate image + check storage quota ──────────────
  const imageSize = imagePart.data.length;
  const currentStorageUsed = huntRow?.storage_used_bytes ?? 0;

  if (imageSize > 2 * 1024 * 1024) {
    throw createError({
      statusCode: 413,
      statusMessage: "Image too large (max 2MB)",
    });
  }

  if (currentStorageUsed + imageSize > MAX_HUNT_STORAGE_BYTES) {
    throw createError({
      statusCode: 413,
      statusMessage:
        "Hunt storage limit reached (50MB). Delete old images to free space.",
    });
  }

  // ── Insert check-in row ─────────────────────────────────
  const { data, error } = await admin
    .from("hunt_check_ins")
    .insert({
      hunt_id: huntId,
      bar_id: barId,
      team_id: participant.team_id ?? null,
      with_team_id: withTeamId,
      user_id: userId,
      note,
    })
    .select("*")
    .single();

  if (error) {
    throw createError({
      statusCode: 500,
      statusMessage: `Failed to record check-in: ${error.message}`,
    });
  }

  // ── Upload image ─────────────────────────────────────
  let imageUrl: string | null = null;

  try {
    const imagePath = await uploadCheckInImage(
      huntId,
      data.id,
      Buffer.from(imagePart.data),
      imagePart.type || "image/jpeg"
    );

    // Update check-in with image_path + increment storage counter
    await admin
      .from("hunt_check_ins")
      .update({ image_path: imagePath })
      .eq("id", data.id);

    await admin
      .from("hunts")
      .update({ storage_used_bytes: currentStorageUsed + imageSize })
      .eq("id", huntId);

    imageUrl = await getSignedImageUrl(imagePath);
  } catch (uploadErr: any) {
    // Check-in still exists without image if upload fails
    console.error("Check-in image upload failed:", uploadErr.message);
  }

  // ── Mark the bar as checked ────────────────────────────
  const checkedAt = new Date().toISOString();
  await admin
    .from("hunt_bars")
    .update({
      check_status: "checked",
      checked_by: userId,
      checked_at: checkedAt,
    })
    .eq("id", barId)
    .eq("hunt_id", huntId);

  // ── Resolve withTeamName if needed ────────────────────
  let withTeamName: string | null = null;
  if (withTeamId) {
    const { data: wt } = await admin
      .from("hunt_teams")
      .select("name")
      .eq("id", withTeamId)
      .single();
    withTeamName = wt?.name ?? null;
  }

  const mapped = mapCheckIn(data);
  return {
    checkIn: {
      id: mapped.id,
      huntId: mapped.huntId,
      barId: mapped.barId,
      teamId: mapped.teamId,
      withTeamId: withTeamId,
      withTeamName,
      userId: mapped.userId,
      note: mapped.note,
      imageUrl,
      createdAt: mapped.createdAt,
    },
    bar: {
      checkStatus: "checked",
      checkedBy: userId,
      checkedAt,
    },
  };
});
