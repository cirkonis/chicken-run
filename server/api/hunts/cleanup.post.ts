import { defineEventHandler, getHeader, createError } from "h3";
import { getAdminClient } from "../../utils/supabase";

const HUNT_TTL_DAYS = 90;

// POST /api/hunts/cleanup — delete completed hunts older than 90 days
// Secured with CLEANUP_SECRET header so it can be called by cron / scheduled task.
// Also runs inline during normal user flows, but this endpoint allows global sweeps.
export default defineEventHandler(async (event) => {
  const secret = getHeader(event, "x-cleanup-secret");
  const expected = process.env.CLEANUP_SECRET;

  if (!expected || secret !== expected) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }

  const admin = getAdminClient();
  const ninetyDaysAgo = new Date(Date.now() - HUNT_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await admin
    .from("hunts")
    .delete()
    .eq("status", "completed")
    .lt("completed_at", ninetyDaysAgo)
    .select("id");

  if (error) {
    throw createError({
      statusCode: 500,
      statusMessage: `Cleanup failed: ${error.message}`,
    });
  }

  return { deleted: (data || []).length, ids: (data || []).map((h) => h.id) };
});
