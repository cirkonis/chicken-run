import { defineEventHandler, readBody, createError } from "h3";
import { getUserClient, getAdminClient } from "../../utils/supabase";
import { deleteGuestUsersForHunts } from "../../utils/cleanupGuestUsers";
import { deleteHuntMedia } from "../../utils/storage";
import type { TeamInput } from "~/types";

const MAX_HUNTS_PER_USER = 3;
const HUNT_TTL_DAYS = 90;

// POST /api/hunts — create a new hunt (optionally with teams including chicken team)
// Body: { name, centerLat, centerLng, radiusMeters?, budget?, teams?: TeamInput[] }
export default defineEventHandler(async (event) => {
  const userId = event.context.userId!;
  const supabase = getUserClient(event);
  const admin = getAdminClient();

  const body = await readBody<{
    name: string;
    centerLat: number;
    centerLng: number;
    radiusMeters?: number;
    budget?: number | null;
    teams?: TeamInput[];
    gameDay?: number | null;
    startMinute?: number | null;
    barFilters?: Record<string, any>;
  }>(event);

  if (!body?.name || body.centerLat == null || body.centerLng == null) {
    throw createError({
      statusCode: 400,
      statusMessage: "name, centerLat, and centerLng are required",
    });
  }

  // Clean up expired completed hunts for this user
  const ninetyDaysAgo = new Date(Date.now() - HUNT_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();

  // Find expired hunts first so we can clean up guest users
  const { data: expiredHunts } = await admin
    .from("hunts")
    .select("id")
    .eq("creator_id", userId)
    .eq("status", "completed")
    .lt("completed_at", ninetyDaysAgo);

  const expiredIds = (expiredHunts || []).map((h) => h.id);
  if (expiredIds.length > 0) {
    await deleteGuestUsersForHunts(admin, expiredIds);
    await deleteHuntMedia(expiredIds);
    await admin
      .from("hunts")
      .delete()
      .eq("creator_id", userId)
      .eq("status", "completed")
      .lt("completed_at", ninetyDaysAgo);
  }

  // Enforce hunt limit
  const { count } = await admin
    .from("hunts")
    .select("id", { count: "exact", head: true })
    .eq("creator_id", userId);

  if (count != null && count >= MAX_HUNTS_PER_USER) {
    throw createError({
      statusCode: 403,
      statusMessage: `You can have at most ${MAX_HUNTS_PER_USER} hunts. Delete an old one first.`,
    });
  }

  // Create the hunt
  const insertData: Record<string, any> = {
    creator_id: userId,
    name: body.name.trim(),
    center_lat: body.centerLat,
    center_lng: body.centerLng,
    radius_meters: body.radiusMeters || 1500,
  };
  if (body.budget != null) insertData.budget = body.budget;
  // Schedule + bar rules (issue: bar rules). Optional at create; the edit page
  // can set/refine them later.
  if (body.gameDay != null) insertData.game_day = body.gameDay;
  if (body.startMinute != null) insertData.start_minute = body.startMinute;
  if (body.barFilters != null) insertData.bar_filters = body.barFilters;

  const { data: hunt, error } = await supabase
    .from("hunts")
    .insert(insertData)
    .select()
    .single();

  if (error) {
    throw createError({
      statusCode: 500,
      statusMessage: `Failed to create hunt: ${error.message}`,
    });
  }

  // Create teams if provided (includes chicken team via isChicken flag)
  let teams: any[] = [];
  if (body.teams && body.teams.length > 0) {
    for (let i = 0; i < body.teams.length; i++) {
      const teamInput = body.teams[i];

      // Insert team
      const { data: team, error: teamError } = await supabase
        .from("hunt_teams")
        .insert({
          hunt_id: hunt.id,
          name: teamInput.name.trim(),
          display_order: i,
          is_chicken: teamInput.isChicken || false,
        })
        .select()
        .single();

      if (teamError || !team) {
        throw createError({
          statusCode: 500,
          statusMessage: `Failed to create team: ${teamError?.message}`,
        });
      }

      // Insert team members
      if (teamInput.members && teamInput.members.length > 0) {
        const membersToInsert = teamInput.members
          .filter((m) => m.name.trim())
          .map((m) => ({
            team_id: team.id,
            name: m.name.trim(),
          }));

        if (membersToInsert.length > 0) {
          const { error: membersError } = await supabase
            .from("hunt_team_members")
            .insert(membersToInsert);

          if (membersError) {
            throw createError({
              statusCode: 500,
              statusMessage: `Failed to add team members: ${membersError.message}`,
            });
          }
        }
      }

      teams.push(team);
    }
  }

  // Re-fetch teams with members for the response
  const huntResult = mapHunt(hunt);
  if (teams.length > 0) {
    const { data: teamsWithMembers } = await supabase
      .from("hunt_teams")
      .select("*, hunt_team_members(*)")
      .eq("hunt_id", hunt.id)
      .order("display_order");

    huntResult.teams = (teamsWithMembers || []).map(mapTeam);
  }

  return { hunt: huntResult };
});
