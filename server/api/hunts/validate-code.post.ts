import { defineEventHandler, readBody, createError } from "h3";
import { getAdminClient } from "../../utils/supabase";

// POST /api/hunts/validate-code
// Body: { code: "ABC123" }
// Validates a team or chicken code and returns the member list for the
// "pick your name" step on the home page.
export default defineEventHandler(async (event) => {
  const body = await readBody<{ code: string }>(event);

  if (!body?.code?.trim()) {
    throw createError({ statusCode: 400, statusMessage: "Code is required" });
  }

  const code = body.code.trim().toUpperCase();
  const admin = getAdminClient();

  // Call the DB function that checks team codes then chicken codes
  const { data, error } = await admin.rpc("validate_team_code", {
    p_code: code,
  });

  if (error) {
    throw createError({
      statusCode: 500,
      statusMessage: `Validation failed: ${error.message}`,
    });
  }

  if (data?.error) {
    throw createError({
      statusCode: 404,
      statusMessage: data.error,
    });
  }

  return data;
});
