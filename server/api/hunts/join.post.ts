import { defineEventHandler, readBody, createError } from "h3";
import { getAdminClient } from "../../utils/supabase";

// POST /api/hunts/join — join a hunt by code (Kahoot-style)
// Body: { code: "ABC123" }
export default defineEventHandler(async (event) => {
  const userId = event.context.userId!;
  const body = await readBody<{ code: string }>(event);

  if (!body?.code?.trim()) {
    throw createError({
      statusCode: 400,
      statusMessage: "Hunt code is required",
    });
  }

  // Use admin client to call the security-definer function
  // (user doesn't have RLS access to the hunt until they join)
  const admin = getAdminClient();

  const { data, error } = await admin.rpc("join_hunt_by_code", {
    p_code: body.code.trim().toUpperCase(),
    p_user_id: userId,
  });

  if (error) {
    throw createError({
      statusCode: 500,
      statusMessage: `Join failed: ${error.message}`,
    });
  }

  if (data?.error) {
    throw createError({
      statusCode: 404,
      statusMessage: data.error,
    });
  }

  return {
    huntId: data.hunt_id,
    huntName: data.hunt_name,
    role: data.role,
  };
});
