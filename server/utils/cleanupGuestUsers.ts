import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Delete guest auth users who are participants of the given hunt IDs.
 * Must be called BEFORE deleting the hunts (cascade removes hunt_participants).
 * Uses the admin (service_role) client to access auth.users.
 */
export async function deleteGuestUsersForHunts(
  admin: SupabaseClient,
  huntIds: string[]
): Promise<{ deleted: number; errors: string[] }> {
  if (huntIds.length === 0) return { deleted: 0, errors: [] };

  // Find all participants of these hunts
  const { data: participants, error: pError } = await admin
    .from("hunt_participants")
    .select("user_id")
    .in("hunt_id", huntIds);

  if (pError || !participants?.length) {
    return { deleted: 0, errors: pError ? [pError.message] : [] };
  }

  const userIds = [...new Set(participants.map((p) => p.user_id))];

  // Check which of these users are guests and not participating in other hunts
  const errors: string[] = [];
  let deleted = 0;

  for (const userId of userIds) {
    // Get user metadata to check if guest
    const { data: userData } = await admin.auth.admin.getUserById(userId);
    if (!userData?.user?.user_metadata?.is_guest) continue;

    // Check if this guest participates in any hunts NOT in the deletion set
    const { count } = await admin
      .from("hunt_participants")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .not("hunt_id", "in", `(${huntIds.join(",")})`);

    if (count && count > 0) continue; // Still active in other hunts

    // Safe to delete — cascade will clean up profile if one exists
    const { error: delError } = await admin.auth.admin.deleteUser(userId);
    if (delError) {
      errors.push(`Failed to delete guest ${userId}: ${delError.message}`);
    } else {
      deleted++;
    }
  }

  return { deleted, errors };
}
