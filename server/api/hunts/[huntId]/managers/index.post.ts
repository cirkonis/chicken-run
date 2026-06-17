import { defineEventHandler, getRouterParam, readBody, createError } from "h3";
import { getAdminClient } from "../../../../utils/supabase";

// POST /api/hunts/:huntId/managers — add a co-manager by email (issue #4).
//
// OWNER ONLY: only the hunt's creator may change the co-manager list (the agreed
// "owner keeps ownership" model). The email must belong to a real, signed-up
// (non-guest) account — guests join with codes and can't co-manage.
// Body: { email }
export default defineEventHandler(async (event) => {
  const userId = event.context.userId!;
  const huntId = getRouterParam(event, "huntId");
  if (!huntId) throw createError({ statusCode: 400, statusMessage: "Missing huntId" });

  const admin = getAdminClient();

  // Only the hunt owner (creator) may add co-managers.
  const { data: hunt } = await admin.from("hunts").select("creator_id").eq("id", huntId).maybeSingle();
  if (!hunt) throw createError({ statusCode: 404, statusMessage: "Hunt not found" });
  if (hunt.creator_id !== userId) {
    throw createError({ statusCode: 403, statusMessage: "Only the hunt owner can add co-managers" });
  }

  const body = await readBody<{ email?: string }>(event);
  const email = (body?.email || "").trim();
  if (!email) throw createError({ statusCode: 400, statusMessage: "Email is required" });

  // Resolve the email → a real (non-guest) account via the SECURITY DEFINER RPC.
  const { data: accounts, error: lookupError } = await admin.rpc("find_account_by_email", { p_email: email });
  if (lookupError) {
    throw createError({ statusCode: 500, statusMessage: `Lookup failed: ${lookupError.message}` });
  }
  const account = Array.isArray(accounts) ? accounts[0] : accounts;
  if (!account) {
    throw createError({
      statusCode: 404,
      statusMessage: "No signed-up account with that email. Ask them to sign in with Google once first.",
    });
  }
  if (account.id === hunt.creator_id) {
    throw createError({ statusCode: 400, statusMessage: "That's the hunt owner — they already manage it." });
  }

  // Add them. The unique (hunt_id, user_id) constraint makes this safe to retry.
  const { error: insertError } = await admin
    .from("hunt_managers")
    .insert({ hunt_id: huntId, user_id: account.id, added_by: userId });
  if (insertError) {
    if (insertError.code === "23505") {
      throw createError({ statusCode: 409, statusMessage: "That account is already a co-manager." });
    }
    throw createError({ statusCode: 500, statusMessage: `Failed to add co-manager: ${insertError.message}` });
  }

  return { manager: { userId: account.id, displayName: account.display_name || "Unknown" } };
});
