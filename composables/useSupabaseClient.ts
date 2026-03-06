/**
 * Composable: minimal client-side Supabase client for OAuth.
 *
 * Only used to trigger Google OAuth redirect. Session management
 * stays in useAuth — we parse the callback hash ourselves.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let _client: SupabaseClient | null = null;

export function useSupabaseClient() {
  if (!_client && import.meta.client) {
    const config = useRuntimeConfig();
    _client = createClient(config.public.supabaseUrl, config.public.supabaseAnonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    });
  }

  async function signInWithGoogle() {
    if (!_client) throw new Error("Supabase client not available on server");
    const { error } = await _client.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin,
      },
    });
    if (error) throw error;
  }

  return { signInWithGoogle };
}
