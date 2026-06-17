/**
 * Composable: guard the browser / hardware Back button on the in-game screens.
 *
 * The problem (issue #1): on mobile, pressing Back while playing would leave the
 * app entirely — and because we never remembered where the player was, they had
 * to re-type their join code to get back in. This guard intercepts the first
 * Back press and asks "Leave the hunt?" instead of silently navigating away.
 *
 * How it works — the classic "sentinel history entry" trick:
 *   1. On mount we push a throwaway history entry (same URL) so there is always
 *      one extra step for Back to consume.
 *   2. When the player presses Back, the browser pops that sentinel and fires a
 *      `popstate` event. We immediately push the sentinel again (so there is
 *      still a buffer for next time) and raise `showLeaveConfirm`, which the
 *      page binds to a ConfirmModal.
 *   3. Cancel → nothing happens, they stay put (the buffer is already back in
 *      place). Confirm → the page does a *full* navigation away (window.location),
 *      which wipes the SPA history and all our sentinels in one clean sweep.
 *
 * Doing the actual "leave" as a full navigation (in the page, not here) is what
 * keeps this simple: we never have to surgically remove sentinel entries from
 * the history stack — leaving the SPA throws the whole stack away.
 */
export function useLeaveGuard() {
  // Bound to the "Leave the hunt?" ConfirmModal in the page template.
  const showLeaveConfirm = ref(false);

  // Whether our popstate listener is live (guards against firing after unmount).
  let armed = false;

  // Marker stashed on our sentinel history entries (purely for debugging).
  const SENTINEL = { chickenLeaveGuard: true } as const;

  function onPopState() {
    if (!armed) return;
    // Re-arm the buffer so the *next* Back press is caught too, then prompt.
    window.history.pushState(SENTINEL, "");
    showLeaveConfirm.value = true;
  }

  onMounted(() => {
    if (!import.meta.client) return;
    // Drop the first sentinel so Back has something harmless to pop.
    window.history.pushState(SENTINEL, "");
    window.addEventListener("popstate", onPopState);
    armed = true;
  });

  onBeforeUnmount(() => {
    if (!import.meta.client) return;
    window.removeEventListener("popstate", onPopState);
    armed = false;
  });

  return { showLeaveConfirm };
}
