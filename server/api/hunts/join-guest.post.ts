import { defineEventHandler, readBody, createError } from "h3";
import { createClient } from "@supabase/supabase-js";
import { getAdminClient } from "../../utils/supabase";

// POST /api/hunts/join-guest
// Body: { code: "ABC123", email: "player@example.com" }
// Matches email to a pre-registered team member, creates a guest user, joins the hunt.
// Falls back to allowing any email if the hunt has no teams (backward compat).
export default defineEventHandler(async (event) => {
  const body = await readBody<{ code: string; email: string }>(event);

  if (!body?.code?.trim()) {
    throw createError({ statusCode: 400, statusMessage: "Hunt code is required" });
  }

  if (!body?.email?.trim()) {
    throw createError({ statusCode: 400, statusMessage: "Email is required" });
  }

  const code = body.code.trim().toUpperCase();
  const email = body.email.trim().toLowerCase();
  const admin = getAdminClient();

  // 1. Validate the hunt code exists and determine role before creating a user
  //    Check hunter_code first, then chicken_code
  let huntCheck: { id: string; name: string } | null = null;
  let joiningAs: "hunter" | "chicken" = "hunter";

  const { data: hunterMatch } = await admin
    .from("hunts")
    .select("id, name")
    .eq("hunter_code", code)
    .eq("status", "active")
    .single();

  if (hunterMatch) {
    huntCheck = hunterMatch;
    joiningAs = "hunter";
  } else {
    const { data: chickenMatch } = await admin
      .from("hunts")
      .select("id, name")
      .eq("chicken_code", code)
      .eq("status", "active")
      .single();

    if (chickenMatch) {
      huntCheck = chickenMatch;
      joiningAs = "chicken";
    }
  }

  if (!huntCheck) {
    throw createError({
      statusCode: 404,
      statusMessage: "Invalid hunt code. Check your code and try again.",
    });
  }

  // 2. Validate email against pre-registered list based on role
  let memberName = email.split("@")[0]; // fallback display name

  if (joiningAs === "hunter") {
    // Check if hunt has teams — if so, email must match a team member
    const { data: teams } = await admin
      .from("hunt_teams")
      .select("id")
      .eq("hunt_id", huntCheck.id)
      .limit(1);

    if (teams && teams.length > 0) {
      const { data: member } = await admin
        .from("hunt_team_members")
        .select("name, team_id, hunt_teams!inner(hunt_id)")
        .eq("hunt_teams.hunt_id", huntCheck.id)
        .eq("email", email)
        .single();

      if (!member) {
        throw createError({
          statusCode: 404,
          statusMessage: "Email not registered for this hunt. Ask your host to add you to a team.",
        });
      }

      memberName = member.name;
    }
  } else {
    // Chicken: check if hunt has pre-registered chickens — if so, email must match
    const { data: chickens } = await admin
      .from("hunt_chickens")
      .select("id")
      .eq("hunt_id", huntCheck.id)
      .limit(1);

    if (chickens && chickens.length > 0) {
      const { data: chicken } = await admin
        .from("hunt_chickens")
        .select("name")
        .eq("hunt_id", huntCheck.id)
        .eq("email", email)
        .single();

      if (!chicken) {
        throw createError({
          statusCode: 404,
          statusMessage: "Email not registered as a chicken for this hunt. Ask your host to add you.",
        });
      }

      memberName = chicken.name;
    }
  }

  // 4. Reuse an existing guest user for this real email, or create a new one.
  //    This prevents duplicate auth users (and duplicate hunt_participants rows)
  //    when the same person joins multiple times.
  const config = useRuntimeConfig();
  const guestPassword = crypto.randomUUID(); // fresh password each sign-in
  let guestUserId: string;
  let guestEmail: string;

  // Check if a guest auth user already exists for this real email
  const { data: existingGuestId } = await admin.rpc("find_guest_by_real_email", {
    p_email: email,
  });

  if (existingGuestId) {
    // Reuse existing guest: update password (so we can sign in) and display name
    guestUserId = existingGuestId;
    const { data: existingUser } = await admin.auth.admin.getUserById(guestUserId);
    guestEmail = existingUser?.user?.email || "";

    const { error: updateError } = await admin.auth.admin.updateUserById(guestUserId, {
      password: guestPassword,
      user_metadata: {
        display_name: memberName,
        is_guest: true,
        real_email: email,
      },
    });

    if (updateError) {
      throw createError({
        statusCode: 500,
        statusMessage: `Failed to update guest session: ${updateError.message}`,
      });
    }
  } else {
    // No existing guest — create a new one
    const guestId = crypto.randomUUID().slice(0, 8);
    guestEmail = `guest_${guestId}@chickenrun.guest`;

    const { data: newUser, error: createError2 } =
      await admin.auth.admin.createUser({
        email: guestEmail,
        password: guestPassword,
        email_confirm: true,
        user_metadata: {
          display_name: memberName,
          is_guest: true,
          real_email: email,
        },
      });

    if (createError2 || !newUser.user) {
      throw createError({
        statusCode: 500,
        statusMessage: `Failed to create guest session: ${createError2?.message}`,
      });
    }

    guestUserId = newUser.user.id;
  }

  // 5. Sign them in to get a session
  //    Use a THROWAWAY client — never call signInWithPassword on the
  //    singleton admin client, because it overwrites the auth state and
  //    makes all subsequent admin requests act as this guest user.
  const tempClient = createClient(config.public.supabaseUrl, config.public.supabaseAnonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: session, error: signInError } =
    await tempClient.auth.signInWithPassword({
      email: guestEmail,
      password: guestPassword,
    });

  if (signInError || !session.session) {
    throw createError({
      statusCode: 500,
      statusMessage: `Failed to create session: ${signInError?.message}`,
    });
  }

  // 6. Join the hunt (pass email so join_hunt_by_code can match team)
  const { data: joinResult, error: joinError } = await admin.rpc(
    "join_hunt_by_code",
    {
      p_code: code,
      p_user_id: guestUserId,
      p_email: email,
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
      id: guestUserId,
      displayName: memberName,
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
    teamId: joinResult.team_id,
    teamName: joinResult.team_name,
  };
});
