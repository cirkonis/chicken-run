import { defineEventHandler } from "h3";
import { getUserClient, requireUser } from "../../utils/supabase";

// GET /api/hunts — list all hunts the current user is a participant in
export default defineEventHandler(async (event) => {
  const userId = await requireUser(event);
  const supabase = getUserClient(event);

  // Get hunt IDs the user is participating in
  const { data: participations, error: pError } = await supabase
    .from("hunt_participants")
    .select("hunt_id, role")
    .eq("user_id", userId);

  if (pError) {
    throw createError({
      statusCode: 500,
      statusMessage: `Failed to fetch participations: ${pError.message}`,
    });
  }

  if (!participations || participations.length === 0) {
    return { hunts: [] };
  }

  const huntIds = participations.map((p) => p.hunt_id);
  const roleMap = Object.fromEntries(
    participations.map((p) => [p.hunt_id, p.role])
  );

  // Fetch the hunts
  const { data: hunts, error: hError } = await supabase
    .from("hunts")
    .select("*")
    .in("id", huntIds)
    .order("created_at", { ascending: false });

  if (hError) {
    throw createError({
      statusCode: 500,
      statusMessage: `Failed to fetch hunts: ${hError.message}`,
    });
  }

  return {
    hunts: (hunts || []).map((h) => ({
      id: h.id,
      name: h.name,
      hunterCode: h.hunter_code,
      chickenCode: h.chicken_code,
      centerLat: h.center_lat,
      centerLng: h.center_lng,
      radiusMeters: h.radius_meters,
      status: h.status,
      role: roleMap[h.id] || "hunter",
      createdAt: h.created_at,
    })),
  };
});
