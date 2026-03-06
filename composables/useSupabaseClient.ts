/**
 * Composable: minimal client-side Supabase client for OAuth.
 *
 * Only used to trigger Google OAuth redirect. Session management
 * stays in useAuth — we parse the callback hash ourselves.
 *
 * Client is created lazily (on first signInWithGoogle call) to avoid
 * throwing during SSR or component setup when config isn't available yet.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let _client: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (_client) return _client;

  const config = useRuntimeConfig();
  const url = config.public.supabaseUrl;
  const key = config.public.supabaseAnonKey;

  if (!url || !key) {
    throw new Error("Missing Supabase config — check SUPABASE_URL and SUPABASE_ANON_KEY env vars");
  }

  _client = createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });

  return _client;
}

export function useSupabaseClient() {
  async function signInWithGoogle() {
    if (!import.meta.client) throw new Error("OAuth can only be triggered in the browser");
    const client = getClient();
    const { error } = await client.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin,
      },
    });
    if (error) throw error;
  }

  return { signInWithGoogle };
}
