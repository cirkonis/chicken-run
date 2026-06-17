/**
 * POST /api/dev/login  —  DEV-ONLY host sign-in shortcut.
 *
 * Why this exists: the host/management screens (dashboard, dashboard/edit) are
 * gated behind real Google OAuth, which we can't drive against the local
 * Supabase stack. This endpoint signs in the seeded local host account with a
 * password and returns a real Supabase session — identical in shape to what the
 * OAuth callback produces — so host flows can be exercised locally.
 *
 * Safety: hard-gated to development. In any production build `import.meta.dev`
 * is false, so this immediately returns 403 and can never mint a session in
 * prod. It's also listed as a PUBLIC_ROUTE in the auth middleware because it IS
 * the login step (it can't require a prior session).
 */
import { defineEventHandler, readBody, createError } from "h3";
import { createClient } from "@supabase/supabase-js";
import { getAdminClient } from "../../utils/supabase";

// The seeded local-stack host (see project memory / supabase seed).
const DEFAULT_DEV_HOST_EMAIL = "host@test.local";
const DEFAULT_DEV_HOST_PASSWORD = "password123";

export default defineEventHandler(async (event) => {
  // Refuse outright unless we're running `nuxt dev`. This is the production guard.
  if (!import.meta.dev) {
    throw createError({ statusCode: 403, statusMessage: "Dev login is disabled" });
  }

  // Allow overriding the account from the body, but default to the seeded host.
  const body = await readBody<{ email?: string; password?: string }>(event).catch(() => ({}));
  const email = body?.email?.trim() || DEFAULT_DEV_HOST_EMAIL;
  const password = body?.password || DEFAULT_DEV_HOST_PASSWORD;

  const config = useRuntimeConfig();

  // Sign in with a throwaway anon client (same approach as guest join) so we
  // mint a real session without persisting anything server-side.
  const client = createClient(config.public.supabaseUrl, config.public.supabaseAnonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: signIn, error: signInError } = await client.auth.signInWithPassword({
    email,
    password,
  });

  if (signInError || !signIn.session || !signIn.user) {
    throw createError({
      statusCode: 401,
      statusMessage: `Dev login failed for ${email}: ${signInError?.message || "no session"}. Is the local stack seeded?`,
    });
  }

  // Pull the host's profile so the client can show their name/avatar like OAuth does.
  const admin = getAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("id, display_name, avatar_url")
    .eq("id", signIn.user.id)
    .single();

  return {
    user: {
      id: signIn.user.id,
      displayName: profile?.display_name || signIn.user.email || "Host",
      avatarUrl: profile?.avatar_url || undefined,
      // NB: no `isGuest` flag → useAuth treats this as a real host (isHost === true).
    },
    session: {
      access_token: signIn.session.access_token,
      refresh_token: signIn.session.refresh_token,
      expires_at: signIn.session.expires_at,
    },
  };
});
