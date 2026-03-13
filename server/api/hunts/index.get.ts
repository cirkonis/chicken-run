import { defineEventHandler } from "h3";
import { getUserClient, getAdminClient } from "../../utils/supabase";

const HUNT_TTL_DAYS = 90;

// GET /api/hunts — list all hunts the current user is a participant in
export default defineEventHandler(async (event) => {
  const userId = event.context.userId!;
  const supabase = getUserClient(event);
  const admin = getAdminClient();

  // Clean up expired completed hunts for this user
  const ninetyDaysAgo = new Date(Date.now() - HUNT_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();
  await admin
    .from("hunts")
    .delete()
    .eq("creator_id", userId)
    .eq("status", "completed")
    .lt("completed_at", ninetyDaysAgo);

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
  const allHuntIds = allHunts.map((h) => h.id);

  // Fetch summary stats for all hunts in batch
  const [teamsResult, barsResult] = await Promise.all([
    supabase
      .from("hunt_teams")
      .select("hunt_id, id, is_chicken, hunt_team_members(count)")
      .in("hunt_id", allHuntIds.length > 0 ? allHuntIds : [""]),
    supabase
      .from("hunt_bars")
      .select("hunt_id")
      .in("hunt_id", allHuntIds.length > 0 ? allHuntIds : [""]),
  ]);

  // Build stats maps (exclude chicken teams from counts)
  const teamCountMap = new Map<string, number>();
  const memberCountMap = new Map<string, number>();
  for (const t of teamsResult.data || []) {
    if (!t.is_chicken) {
      teamCountMap.set(t.hunt_id, (teamCountMap.get(t.hunt_id) || 0) + 1);
    }
    const memberCount = (t.hunt_team_members as any)?.[0]?.count ?? 0;
    if (!t.is_chicken) {
      memberCountMap.set(t.hunt_id, (memberCountMap.get(t.hunt_id) || 0) + memberCount);
    }
  }

  const barCountMap = new Map<string, number>();
  for (const b of barsResult.data || []) {
    barCountMap.set(b.hunt_id, (barCountMap.get(b.hunt_id) || 0) + 1);
  }

  // Count hunts the user created (for limit display)
  const createdCount = (createdHunts || []).length;

  return {
    hunts: allHunts.map((h) =>
      mapHuntWithRole(
        h,
        h.creator_id === userId ? "creator" : (roleMap[h.id] || "hunter"),
        {
          teamCount: teamCountMap.get(h.id) || 0,
          memberCount: memberCountMap.get(h.id) || 0,
          barCount: barCountMap.get(h.id) || 0,
          budget: h.budget ?? null,
        }
      )
    ),
    huntCount: createdCount,
    maxHunts: 3,
  };
});
