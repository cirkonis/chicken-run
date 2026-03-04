import { defineEventHandler } from "h3";
import { getUserClient } from "../../utils/supabase";

// GET /api/auth/me — get current user's profile
export default defineEventHandler(async (event) => {
  const userId = event.context.userId!;
  const supabase = getUserClient(event);

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_url, created_at")
    .eq("id", userId)
    .single();

  if (error || !profile) {
    throw createError({
      statusCode: 404,
      statusMessage: "Profile not found",
    });
  }

  return { user: profile };
});
