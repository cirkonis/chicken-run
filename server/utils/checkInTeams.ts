import { createError } from "h3";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Validate the "ran into" battle teams for a check-in. Each must be a real,
 * non-chicken team in this hunt, and not the checking-in team itself. Returns the
 * validated, deduped [{ id, name }], or throws a 400 if any id is bogus.
 * Shared by the check-in create + edit endpoints.
 */
export async function validateBattleTeams(
  admin: SupabaseClient,
  huntId: string,
  teamIds: string[],
  ownTeamId: string | null
): Promise<{ id: string; name: string }[]> {
  const ids = [...new Set(teamIds)].filter((id) => id && id !== ownTeamId);
  if (!ids.length) return [];

  const { data: teams } = await admin
    .from("hunt_teams")
    .select("id, name, is_chicken")
    .eq("hunt_id", huntId)
    .in("id", ids);

  if (!teams || teams.length !== ids.length || teams.some((t) => t.is_chicken)) {
    throw createError({ statusCode: 400, statusMessage: "Invalid team selection" });
  }
  return teams.map((t) => ({ id: t.id, name: t.name }));
}
