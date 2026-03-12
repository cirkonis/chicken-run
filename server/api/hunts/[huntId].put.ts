import { defineEventHandler, getRouterParam, readBody, createError } from "h3";
import { getUserClient } from "../../utils/supabase";
import type { TeamInput } from "~/types";

// PUT /api/hunts/:huntId — edit an existing hunt (creator only)
// Body: { name?, centerLat?, centerLng?, radiusMeters?, budget?, teams?: TeamInput[] }
export default defineEventHandler(async (event) => {
  const userId = event.context.userId!;
  const huntId = getRouterParam(event, "huntId");
  const supabase = getUserClient(event);

  if (!huntId) {
    throw createError({ statusCode: 400, statusMessage: "Missing huntId" });
  }

  const body = await readBody<{
    name?: string;
    centerLat?: number;
    centerLng?: number;
    radiusMeters?: number;
    budget?: number | null;
    teams?: TeamInput[];
  }>(event);

  // Verify this hunt exists and user is the creator
  const { data: hunt, error: huntError } = await supabase
    .from("hunts")
    .select("id, creator_id, status")
    .eq("id", huntId)
    .single();

  if (huntError || !hunt) {
    throw createError({ statusCode: 404, statusMessage: "Hunt not found" });
  }

  if (hunt.creator_id !== userId) {
    throw createError({ statusCode: 403, statusMessage: "Only the hunt creator can edit it" });
  }

  // Lock edits once hunt has been started
  if (hunt.status !== "preparing") {
    throw createError({ statusCode: 403, statusMessage: "Hunt is locked. Cannot edit while running or completed." });
  }

  // Update hunt fields if provided
  const updates: Record<string, any> = {};
  if (body.name !== undefined) updates.name = body.name.trim();
  if (body.centerLat !== undefined) updates.center_lat = body.centerLat;
  if (body.centerLng !== undefined) updates.center_lng = body.centerLng;
  if (body.radiusMeters !== undefined) updates.radius_meters = body.radiusMeters;
  if (body.budget !== undefined) updates.budget = body.budget;

  if (Object.keys(updates).length > 0) {
    const { error: updateError } = await supabase
      .from("hunts")
      .update(updates)
      .eq("id", huntId);

    if (updateError) {
      throw createError({
        statusCode: 500,
        statusMessage: `Failed to update hunt: ${updateError.message}`,
      });
    }
  }

  // Replace teams if provided (includes chicken team via isChicken flag)
  if (body.teams !== undefined) {
    // Save existing team codes so we can re-apply them after re-insert
    // (keyed by team name so renamed teams get a fresh code)
    const { data: existingTeams } = await supabase
      .from("hunt_teams")
      .select("name, join_code")
      .eq("hunt_id", huntId);

    const codesByName = new Map<string, string>();
    for (const t of existingTeams || []) {
      codesByName.set(t.name, t.join_code);
    }

    // Delete existing teams (cascade deletes team members too)
    const { error: deleteError } = await supabase
      .from("hunt_teams")
      .delete()
      .eq("hunt_id", huntId);

    if (deleteError) {
      throw createError({
        statusCode: 500,
        statusMessage: `Failed to clear existing teams: ${deleteError.message}`,
      });
    }

    // Also clear team_id from existing participants since teams were deleted
    await supabase
      .from("hunt_participants")
      .update({ team_id: null })
      .eq("hunt_id", huntId);

    // Insert new teams
    for (let i = 0; i < body.teams.length; i++) {
      const teamInput = body.teams[i];
      const teamName = teamInput.name.trim();

      // Re-use the old join_code if the team name matches, otherwise let DB generate a new one
      const insertData: Record<string, any> = {
        hunt_id: huntId,
        name: teamName,
        display_order: i,
        is_chicken: teamInput.isChicken || false,
      };
      const existingCode = codesByName.get(teamName);
      if (existingCode) insertData.join_code = existingCode;

      const { data: team, error: teamError } = await supabase
        .from("hunt_teams")
        .insert(insertData)
        .select()
        .single();

      if (teamError || !team) {
        throw createError({
          statusCode: 500,
          statusMessage: `Failed to create team: ${teamError?.message}`,
        });
      }

      // Insert team members (name only, no email required)
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
    }
  }

  // Re-fetch the full hunt with teams for the response
  const { data: updatedHunt } = await supabase
    .from("hunts")
    .select("*")
    .eq("id", huntId)
    .single();

  const { data: teamsWithMembers } = await supabase
    .from("hunt_teams")
    .select("*, hunt_team_members(*)")
    .eq("hunt_id", huntId)
    .order("display_order");

  const result = mapHunt(updatedHunt!);
  result.teams = (teamsWithMembers || []).map(mapTeam);

  return { hunt: result };
});
