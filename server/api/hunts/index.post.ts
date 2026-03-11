import { defineEventHandler, readBody, createError } from "h3";
import { getUserClient } from "../../utils/supabase";
import type { TeamInput, ChickenInput } from "~/types";

// POST /api/hunts — create a new hunt (optionally with teams and chickens)
// Body: { name, centerLat, centerLng, radiusMeters?, teams?: TeamInput[], chickens?: ChickenInput[] }
export default defineEventHandler(async (event) => {
  const userId = event.context.userId!;
  const supabase = getUserClient(event);

  const body = await readBody<{
    name: string;
    centerLat: number;
    centerLng: number;
    radiusMeters?: number;
    budget?: number | null;
    teams?: TeamInput[];
    chickens?: ChickenInput[];
  }>(event);

  if (!body?.name || body.centerLat == null || body.centerLng == null) {
    throw createError({
      statusCode: 400,
      statusMessage: "name, centerLat, and centerLng are required",
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
        const membersToInsert = teamInput.members
          .filter((m) => m.name.trim())
          .map((m) => ({
            team_id: team.id,
            name: m.name.trim(),
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

  // Create chickens if provided
  if (body.chickens && body.chickens.length > 0) {
    const chickensToInsert = body.chickens
      .filter((c) => c.name.trim() && c.email.trim())
      .map((c) => ({
        hunt_id: hunt.id,
        name: c.name.trim(),
        email: c.email.trim().toLowerCase(),
      }));

    if (chickensToInsert.length > 0) {
      const { error: chickensError } = await supabase
        .from("hunt_chickens")
        .insert(chickensToInsert);

      if (chickensError) {
        throw createError({
          statusCode: 500,
          statusMessage: `Failed to add chickens: ${chickensError.message}`,
        });
      }
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
