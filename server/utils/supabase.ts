import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { H3Event } from "h3";

// ── Server-side admin client (uses service_role key) ────────
// Bypasses RLS — use for server operations like join_hunt_by_code
let _adminClient: SupabaseClient | null = null;

export function getAdminClient(): SupabaseClient {
  if (_adminClient) return _adminClient;

  const config = useRuntimeConfig();
  const url = config.public.supabaseUrl;
  const serviceRoleKey = config.supabaseServiceRoleKey;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars"
    );
  }

  _adminClient = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  return _adminClient;
}

// ── Per-request client (uses the user's JWT from Authorization header) ─
// Respects RLS — use for all user-facing operations
export function getUserClient(event: H3Event): SupabaseClient {
  const config = useRuntimeConfig();
  const url = config.public.supabaseUrl;
  const anonKey = config.public.supabaseAnonKey;

  if (!url || !anonKey) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_ANON_KEY env vars");
  }

  // Pull the user's access token from the Authorization header
  const authHeader = getHeader(event, "authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");

  const client = createClient(url, anonKey, {
    global: {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    },
    auth: { autoRefreshToken: false, persistSession: false },
  });

  return client;
}

