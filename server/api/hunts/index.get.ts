import { defineEventHandler } from "h3";
import { getUserClient } from "../../utils/supabase";

// GET /api/hunts — list all hunts the current user is a participant in
export default defineEventHandler(async (event) => {
  const userId = event.context.userId!;
  const supabase = getUserClient(event);

  // Get hunts the user participates in
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

  const roleMap = Object.fromEntries(
    (participations || []).map((p) => [p.hunt_id, p.role])
  );

  // Get hunts the user created (creator is no longer in hunt_participants)
  const { data: createdHunts, error: cError } = await supabase
    .from("hunts")
    .select("*")
    .eq("creator_id", userId)
    .order("created_at", { ascending: false });

  if (cError) {
    throw createError({
      statusCode: 500,
      statusMessage: `Failed to fetch created hunts: ${cError.message}`,
    });
  }

  // Get hunts the user joined (but didn't create)
  const participantHuntIds = (participations || [])
    .map((p) => p.hunt_id)
    .filter((id) => !(createdHunts || []).some((h) => h.id === id));

  let joinedHunts: any[] = [];
  if (participantHuntIds.length > 0) {
    const { data, error: hError } = await supabase
      .from("hunts")
      .select("*")
      .in("id", participantHuntIds)
      .order("created_at", { ascending: false });

    if (hError) {
      throw createError({
        statusCode: 500,
        statusMessage: `Failed to fetch hunts: ${hError.message}`,
      });
    }
    joinedHunts = data || [];
  }

  // Merge and dedupe: created hunts first, then joined hunts
  const allHunts = [...(createdHunts || []), ...joinedHunts];

  return {
    hunts: allHunts.map((h) =>
      mapHuntWithRole(h, h.creator_id === userId ? "creator" : (roleMap[h.id] || "hunter"))
    ),
  };
});
