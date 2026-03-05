import { defineEventHandler, readBody, createError } from "h3";
import { getUserClient } from "../../utils/supabase";
import type { TeamInput } from "~/types";

// POST /api/hunts — create a new hunt (optionally with teams)
// Body: { name, centerLat, centerLng, radiusMeters?, teams?: TeamInput[] }
export default defineEventHandler(async (event) => {
  const userId = event.context.userId!;
  const supabase = getUserClient(event);

  const body = await readBody<{
    name: string;
    centerLat: number;
    centerLng: number;
    radiusMeters?: number;
    teams?: TeamInput[];
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

  // Create teams if provided
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
        const membersToInsert = teamInput.members.map((m) => ({
          team_id: team.id,
          name: m.name.trim(),
          email: m.email.trim().toLowerCase(),
        }));

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
