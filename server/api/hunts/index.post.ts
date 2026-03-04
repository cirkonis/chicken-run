import { defineEventHandler, readBody, createError } from "h3";
import { getUserClient, requireUser } from "../../utils/supabase";

// POST /api/hunts — create a new hunt
// Body: { name, centerLat, centerLng, radiusMeters? }
export default defineEventHandler(async (event) => {
  const userId = await requireUser(event);
  const supabase = getUserClient(event);

  const body = await readBody<{
    name: string;
    centerLat: number;
    centerLng: number;
    radiusMeters?: number;
  }>(event);

  if (!body?.name || body.centerLat == null || body.centerLng == null) {
    throw createError({
      statusCode: 400,
      statusMessage: "name, centerLat, and centerLng are required",
    });
  }

  // Create the hunt
  const { data: hunt, error } = await supabase
    .from("hunts")
    .insert({
      creator_id: userId,
      name: body.name.trim(),
      center_lat: body.centerLat,
      center_lng: body.centerLng,
      radius_meters: body.radiusMeters || 1500,
    })
    .select()
    .single();

  if (error) {
    throw createError({
      statusCode: 500,
      statusMessage: `Failed to create hunt: ${error.message}`,
    });
  }

  // Add creator as a participant
  const { error: participantError } = await supabase
    .from("hunt_participants")
    .insert({
      hunt_id: hunt.id,
      user_id: userId,
      role: "creator",
    });

  if (participantError) {
    // Hunt was created but participant insert failed — try to clean up
    await supabase.from("hunts").delete().eq("id", hunt.id);
    throw createError({
      statusCode: 500,
      statusMessage: `Failed to add creator as participant: ${participantError.message}`,
    });
  }

  return {
    hunt: {
      id: hunt.id,
      name: hunt.name,
      hunterCode: hunt.hunter_code,
      chickenCode: hunt.chicken_code,
      centerLat: hunt.center_lat,
      centerLng: hunt.center_lng,
      radiusMeters: hunt.radius_meters,
      status: hunt.status,
      createdAt: hunt.created_at,
    },
  };
});
