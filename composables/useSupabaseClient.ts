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

  /**
   * Upload a blob to Supabase Storage using a one-time signed upload URL that our
   * server minted (/api/media/upload-url). Works with the anon client because the
   * signed token authorizes the write — no user session needed on this client.
   */
  async function uploadToSignedUrl(path: string, token: string, body: Blob): Promise<void> {
    if (!import.meta.client) throw new Error("Uploads can only run in the browser");
    const client = getClient();
    const { error } = await client.storage
      .from("hunt-media")
      .uploadToSignedUrl(path, token, body, { contentType: body.type || "image/jpeg" });
    if (error) throw new Error(`Upload failed: ${error.message}`);
  }

  // getClient is exposed so useHuntRealtime can open a realtime channel on the
  // same lazily-created client.
  return { signInWithGoogle, uploadToSignedUrl, getClient };
}
