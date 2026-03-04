import { defineEventHandler, readBody, createError } from "h3";
import { getAdminClient } from "../../utils/supabase";

// POST /api/auth/signup
// Body: { email, password, displayName? }
export default defineEventHandler(async (event) => {
  const body = await readBody<{
    email: string;
    password: string;
    displayName?: string;
  }>(event);

  if (!body?.email || !body?.password) {
    throw createError({
      statusCode: 400,
      statusMessage: "Email and password are required",
    });
  }

  const supabase = getAdminClient();

  const { data, error } = await supabase.auth.admin.createUser({
    email: body.email,
    password: body.password,
    email_confirm: true, // auto-confirm for dev — turn off in prod
    user_metadata: {
      display_name: body.displayName || body.email.split("@")[0],
    },
  });

  if (error) {
    throw createError({
      statusCode: 400,
      statusMessage: error.message,
    });
  }

  // Now sign them in to get a session
  const { data: session, error: signInError } =
    await supabase.auth.signInWithPassword({
      email: body.email,
      password: body.password,
    });

  if (signInError) {
    throw createError({
      statusCode: 500,
      statusMessage: `Account created but sign-in failed: ${signInError.message}`,
    });
  }

  return {
    user: {
      id: data.user.id,
      email: data.user.email,
      displayName:
        data.user.user_metadata?.display_name || body.email.split("@")[0],
    },
    session: {
      access_token: session.session?.access_token,
      refresh_token: session.session?.refresh_token,
      expires_at: session.session?.expires_at,
    },
  };
});
