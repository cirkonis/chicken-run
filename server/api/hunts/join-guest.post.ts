import { defineEventHandler, readBody, createError } from "h3";
import { createClient } from "@supabase/supabase-js";
import { getAdminClient } from "../../utils/supabase";

// POST /api/hunts/join-guest
// Body: { code: "ABC123", name: "Alice" }
// Matches name to a pre-registered team member (or chicken), creates a guest
// user, and joins the hunt. The code can be a team join_code or a chicken_code.
export default defineEventHandler(async (event) => {
  const body = await readBody<{ code: string; name: string }>(event);

  if (!body?.code?.trim()) {
    throw createError({ statusCode: 400, statusMessage: "Hunt code is required" });
  }

  if (!body?.name?.trim()) {
    throw createError({ statusCode: 400, statusMessage: "Name is required" });
  }

  const code = body.code.trim().toUpperCase();
  const memberName = body.name.trim();
  const admin = getAdminClient();

  // 1. Validate the code and determine what kind it is
  //    Check team join codes first, then chicken codes, then hunter codes
  let huntId: string | null = null;
  let joiningAs: "hunter" | "chicken" = "hunter";

  // Check team join code
  const { data: teamMatch } = await admin
    .from("hunt_teams")
    .select("id, hunt_id, name, hunts!inner(id, name, status)")
    .eq("join_code", code)
    .single();

  if (teamMatch && (teamMatch as any).hunts?.status === "active") {
    huntId = teamMatch.hunt_id;
    joiningAs = "hunter";

    // Verify the name exists on this team
    const { data: member } = await admin
      .from("hunt_team_members")
      .select("name")
      .eq("team_id", teamMatch.id)
      .ilike("name", memberName)
      .single();

    if (!member) {
      throw createError({
        statusCode: 404,
        statusMessage: "Name not found on this team. Check with your host.",
      });
    }
  } else {
    // Check chicken code
    const { data: chickenMatch } = await admin
      .from("hunts")
      .select("id, name")
      .eq("chicken_code", code)
      .eq("status", "active")
      .single();

    if (chickenMatch) {
      huntId = chickenMatch.id;
      joiningAs = "chicken";

      // Verify the name exists in chickens list
      const { data: chicken } = await admin
        .from("hunt_chickens")
        .select("name")
        .eq("hunt_id", chickenMatch.id)
        .ilike("name", memberName)
        .single();

      if (!chicken) {
        throw createError({
          statusCode: 404,
          statusMessage: "Name not found. Check with your host.",
        });
      }
    } else {
      // Check hunter code (backward compat — no team code, using hunt-level code)
      const { data: hunterMatch } = await admin
        .from("hunts")
        .select("id, name")
        .eq("hunter_code", code)
        .eq("status", "active")
        .single();

      if (hunterMatch) {
        huntId = hunterMatch.id;
        joiningAs = "hunter";
      }
    }
  }

  if (!huntId) {
    throw createError({
      statusCode: 404,
      statusMessage: "Invalid hunt code. Check your code and try again.",
    });
  }

  // 2. Reuse an existing guest user for this code + name, or create a new one.
  const config = useRuntimeConfig();
  const guestPassword = crypto.randomUUID();
  let guestUserId: string;
  let guestEmail: string;

  // Check if a guest auth user already exists for this team_code + member_name
  const { data: existingGuestId } = await admin.rpc("find_guest_by_team_code", {
    p_team_code: code,
    p_member_name: memberName,
  });

  if (existingGuestId) {
    // Reuse existing guest: update password so we can sign in
    guestUserId = existingGuestId;
    const { data: existingUser } = await admin.auth.admin.getUserById(guestUserId);
    guestEmail = existingUser?.user?.email || "";

    const { error: updateError } = await admin.auth.admin.updateUserById(guestUserId, {
      password: guestPassword,
      user_metadata: {
        display_name: memberName,
        is_guest: true,
        team_code: code,
        member_name: memberName,
      },
    });

    if (updateError) {
      throw createError({
        statusCode: 500,
        statusMessage: `Failed to update guest session: ${updateError.message}`,
      });
    }
  } else {
    // Create a new guest auth user
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
          team_code: code,
          member_name: memberName,
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

  // 3. Sign them in to get a session
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

  // 4. Join the hunt
  const { data: joinResult, error: joinError } = await admin.rpc(
    "join_hunt_by_code",
    {
      p_code: code,
      p_user_id: guestUserId,
      p_member_name: memberName,
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
