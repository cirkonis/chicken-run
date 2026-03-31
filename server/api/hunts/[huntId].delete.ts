import { defineEventHandler, getRouterParam, createError } from "h3";
import { getUserClient, getAdminClient } from "../../utils/supabase";
import { deleteGuestUsersForHunts } from "../../utils/cleanupGuestUsers";

// DELETE /api/hunts/:huntId
// Creator only — permanently deletes the hunt and all related data.
// Cascading deletes handle: participants, bars, hints, teams, team members.
// Also cleans up guest auth users who only belong to this hunt.
export default defineEventHandler(async (event) => {
  const userId = event.context.userId!;
  const huntId = getRouterParam(event, "huntId");
  const supabase = getUserClient(event);

  if (!huntId) {
    throw createError({ statusCode: 400, statusMessage: "Missing huntId" });
  }

  // Verify hunt exists and user is the creator
  const { data: hunt, error: huntError } = await supabase
    .from("hunts")
    .select("id, creator_id")
    .eq("id", huntId)
    .single();

  if (huntError || !hunt) {
    throw createError({ statusCode: 404, statusMessage: "Hunt not found" });
  }

  if (hunt.creator_id !== userId) {
    throw createError({ statusCode: 403, statusMessage: "Only the hunt creator can delete a hunt" });
  }

  // Delete guest auth users BEFORE deleting the hunt (need hunt_participants intact)
  const admin = getAdminClient();
  await deleteGuestUsersForHunts(admin, [huntId]);

  // Delete the hunt (cascades to all child tables)
  const { error: deleteError } = await supabase
    .from("hunts")
    .delete()
    .eq("id", huntId);

  if (deleteError) {
    throw createError({
      statusCode: 500,
      statusMessage: `Failed to delete hunt: ${deleteError.message}`,
    });
  }

  return { deleted: true };
});
