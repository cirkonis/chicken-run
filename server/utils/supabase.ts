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

// ── Validate a raw JWT (e.g. the /api/media ?token= query param) ─────────────
/** Returns the user id for a valid access token, or null if invalid/expired. */
export async function getUserIdFromToken(token: string): Promise<string | null> {
  if (!token) return null;

  const config = useRuntimeConfig();
  const url = config.public.supabaseUrl;
  const anonKey = config.public.supabaseAnonKey;
  if (!url || !anonKey) return null;

  const client = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await client.auth.getUser();
  return error || !data.user ? null : data.user.id;
}

// ── Hunt membership check (admin client, bypasses RLS) ───────────────────────
/** True if the user is a participant of the hunt OR its creator. */
export async function isHuntMember(huntId: string, userId: string): Promise<boolean> {
  if (!huntId || !userId) return false;

  const admin = getAdminClient();
  const [{ data: participant }, { data: hunt }] = await Promise.all([
    admin
      .from("hunt_participants")
      .select("user_id")
      .eq("hunt_id", huntId)
      .eq("user_id", userId)
      .maybeSingle(),
    admin.from("hunts").select("creator_id").eq("id", huntId).maybeSingle(),
  ]);

  return !!participant || hunt?.creator_id === userId;
}

