import {
  defineEventHandler,
  getRouterParam,
  createError,
  readMultipartFormData,
} from "h3";
import { getAdminClient } from "../../../../utils/supabase";
import {
  uploadArrivalImage,
  getSignedImageUrl,
  MAX_HUNT_STORAGE_BYTES,
} from "../../../../utils/storage";

// POST /api/hunts/:huntId/arrivals — record a team arrival (with optional image)
// Body: multipart/form-data with "teamId" field + optional "image" file
//
// Uses the admin client for the insert to bypass RLS edge cases with guest sessions.
// Auth is already validated by the middleware (event.context.userId).
export default defineEventHandler(async (event) => {
  const userId = event.context.userId!;
  const huntId = getRouterParam(event, "huntId");

  if (!huntId) {
    throw createError({ statusCode: 400, statusMessage: "Missing huntId" });
  }

  const admin = getAdminClient();

  // ── Verify user is a chicken participant or the hunt creator ─
  const [{ data: participant }, { data: huntRow }] = await Promise.all([
    admin
      .from("hunt_participants")
      .select("role")
      .eq("hunt_id", huntId)
      .eq("user_id", userId)
      .single(),
    admin
      .from("hunts")
      .select("creator_id, storage_used_bytes")
      .eq("id", huntId)
      .single(),
  ]);

  const isChicken = participant?.role === "chicken";
  const isCreator = huntRow?.creator_id === userId;

  if (!isChicken && !isCreator) {
    throw createError({
      statusCode: 403,
      statusMessage: "Only chickens or the host can record arrivals",
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

  const teamIdPart = formData.find((p) => p.name === "teamId");
  const notePart = formData.find((p) => p.name === "note");
  const imagePart = formData.find((p) => p.name === "image");
  const teamId = teamIdPart?.data?.toString("utf-8")?.trim() || "";
  const note = notePart?.data?.toString("utf-8")?.trim() || "";

  if (!teamId) {
    throw createError({ statusCode: 400, statusMessage: "teamId is required" });
  }

  // ── Validate image + check storage quota ──────────────
  let imageSize = 0;
  let currentStorageUsed = huntRow?.storage_used_bytes ?? 0;

  if (imagePart?.data) {
    imageSize = imagePart.data.length;

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
  }

  // ── Insert arrival row (admin client bypasses RLS) ────
  const { data, error } = await admin
    .from("hunt_arrivals")
    .insert({
      hunt_id: huntId,
      team_id: teamId,
      note,
    })
    .select("*, hunt_teams(name)")
    .single();

  if (error) {
    // Unique constraint violation = team already arrived
    if (error.code === "23505") {
      throw createError({
        statusCode: 409,
        statusMessage: "This team has already been recorded as arrived",
      });
    }
    throw createError({
      statusCode: 500,
      statusMessage: `Failed to record arrival: ${error.message}`,
    });
  }

  // ── Upload image if present ───────────────────────────
  let imageUrl: string | null = null;

  if (imagePart?.data) {
    try {
      const imagePath = await uploadArrivalImage(
        huntId,
        data.id,
        Buffer.from(imagePart.data),
        imagePart.type || "image/jpeg"
      );

      // Update arrival with image_path + increment storage counter
      await admin
        .from("hunt_arrivals")
        .update({ image_path: imagePath })
        .eq("id", data.id);

      await admin
        .from("hunts")
        .update({ storage_used_bytes: currentStorageUsed + imageSize })
        .eq("id", huntId);

      imageUrl = await getSignedImageUrl(imagePath);
    } catch (uploadErr: any) {
      // Arrival still exists without image if upload fails
      console.error("Arrival image upload failed:", uploadErr.message);
    }
  }

  const mapped = mapArrival(data);
  return {
    arrival: {
      id: mapped.id,
      huntId: mapped.huntId,
      teamId: mapped.teamId,
      teamName: mapped.teamName,
      arrivedAt: mapped.arrivedAt,
      note: mapped.note,
      imageUrl,
    },
  };
});
