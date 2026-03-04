import { defineEventHandler, readBody, createError } from "h3";
import { getAdminClient } from "../../utils/supabase";

// POST /api/hunts/join-guest
// Body: { code: "ABC123", nickname: "Dave" }
// Creates a guest user behind the scenes, joins the hunt, returns a session.
// No account needed from the player's perspective.
export default defineEventHandler(async (event) => {
  const body = await readBody<{ code: string; nickname: string }>(event);

  if (!body?.code?.trim()) {
    throw createError({ statusCode: 400, statusMessage: "Hunt code is required" });
  }

  if (!body?.nickname?.trim()) {
    throw createError({ statusCode: 400, statusMessage: "Nickname is required" });
  }

  const code = body.code.trim().toUpperCase();
  const nickname = body.nickname.trim();
  const admin = getAdminClient();

  // 1. Validate the hunt code exists before creating a user
  const { data: huntCheck } = await admin
    .from("hunts")
    .select("id, name")
    .or(`hunter_code.eq.${code},chicken_code.eq.${code}`)
    .eq("status", "active")
    .single();

  if (!huntCheck) {
    throw createError({
      statusCode: 404,
      statusMessage: "Invalid hunt code. Check your code and try again.",
    });
  }

  // 2. Create a guest user with a generated email
  const guestId = crypto.randomUUID().slice(0, 8);
  const guestEmail = `guest_${guestId}@chickenrun.guest`;
  const guestPassword = crypto.randomUUID(); // random, they'll never need it

  const { data: newUser, error: createError2 } =
    await admin.auth.admin.createUser({
      email: guestEmail,
      password: guestPassword,
      email_confirm: true,
      user_metadata: {
        display_name: nickname,
        is_guest: true,
      },
    });

  if (createError2 || !newUser.user) {
    throw createError({
      statusCode: 500,
      statusMessage: `Failed to create guest session: ${createError2?.message}`,
    });
  }

  // 3. Sign them in to get a session
  const { data: session, error: signInError } =
    await admin.auth.signInWithPassword({
      email: guestEmail,
      password: guestPassword,
    });

  if (signInError || !session.session) {
    throw createError({
      statusCode: 500,
      statusMessage: `Failed to create session: ${signInError?.message}`,
    });
  }

  // 4. Join the hunt
  const { data: joinResult, error: joinError } = await admin.rpc(
    "join_hunt_by_code",
    {
      p_code: code,
      p_user_id: newUser.user.id,
    }
  );

  if (joinError || joinResult?.error) {
    throw createError({
      statusCode: 500,
      statusMessage: joinResult?.error || joinError?.message || "Failed to join hunt",
    });
  }

  return {
    user: {
      id: newUser.user.id,
      displayName: nickname,
      isGuest: true,
    },
    session: {
      access_token: session.session.access_token,
      refresh_token: session.session.refresh_token,
      expires_at: session.session.expires_at,
    },
    huntId: joinResult.hunt_id,
    huntName: joinResult.hunt_name,
    role: joinResult.role,
  };
});
