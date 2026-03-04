import { defineEventHandler, readBody, createError } from "h3";
import { getAdminClient } from "../../utils/supabase";

// POST /api/auth/refresh
// Body: { refresh_token }
export default defineEventHandler(async (event) => {
  const body = await readBody<{ refresh_token: string }>(event);

  if (!body?.refresh_token) {
    throw createError({
      statusCode: 400,
      statusMessage: "refresh_token is required",
    });
  }

  const supabase = getAdminClient();

  const { data, error } = await supabase.auth.refreshSession({
    refresh_token: body.refresh_token,
  });

  if (error || !data.session) {
    throw createError({
      statusCode: 401,
      statusMessage: error?.message || "Failed to refresh session",
    });
  }

  return {
    session: {
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      expires_at: data.session.expires_at,
    },
  };
});
