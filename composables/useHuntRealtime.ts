/**
 * useHuntRealtime — live feed updates via Supabase Realtime.
 *
 * Subscribes to changes on a hunt's check-ins, arrivals, and hints (these tables
 * are in the realtime publication — see migration 20260615000004). When one
 * fires, onChange() runs — typically the composable's poll()/refetch — so every
 * player sees new check-ins and photos instantly instead of waiting for the next
 * poll.
 *
 * Design: this is ADDITIVE on top of polling. start()/stop() fold into the
 * existing startPolling/stopPolling, and they never throw — if the websocket
 * fails, polling is the safety net and the feed still catches up.
 */
import type { RealtimeChannel } from "@supabase/supabase-js";

export function useHuntRealtime(huntId: string, onChange: () => void) {
  const auth = useAuth();
  const { getClient } = useSupabaseClient();
  let channel: RealtimeChannel | null = null;

  function start() {
    if (!import.meta.client || channel) return;
    try {
      const client = getClient();
      // Realtime applies RLS using the caller's token.
      client.realtime.setAuth(auth.state.accessToken || "");

      let ch = client.channel(`hunt-feed-${huntId}`);
      for (const table of ["hunt_check_ins", "hunt_arrivals", "hints"]) {
        ch = ch.on(
          "postgres_changes",
          { event: "*", schema: "public", table, filter: `hunt_id=eq.${huntId}` },
          () => onChange()
        );
      }
      channel = ch.subscribe();
    } catch {
      // Best-effort — polling is the safety net.
      channel = null;
    }
  }

  function stop() {
    try {
      channel?.unsubscribe();
    } catch {
      /* ignore */
    }
    channel = null;
  }

  return { start, stop };
}
