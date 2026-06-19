/**
 * Composable: lightweight bar-finder state, search, and local-only toggling.
 * No auth, no persistence, no polling — just Google Places search + local status.
 */
import type { HuntBar } from "~/types";

export function useBarFinder() {
  // ── State ──────────────────────────────────────────────
  const searching = ref(false);
  const error = ref<string | null>(null);
  const bars = ref<HuntBar[]>([]);
  const center = ref<{ lat: number; lng: number } | null>(null);
  const searchRadius = ref<number>(1500);

  // UI state
  const filter = ref("");
  const statusFilter = ref("all");

  // Venue-type rule (bar rules feature). The finder has no game schedule, so
  // there's no opening-time filter here — just these categories. Defaults to the
  // standard drinking spots; the user can broaden it.
  const { DEFAULT_VENUE_TYPES } = useSchedule();
  const venueTypes = ref<string[]>([...DEFAULT_VENUE_TYPES]);

  function toggleVenueType(v: string) {
    const i = venueTypes.value.indexOf(v);
    if (i >= 0) venueTypes.value.splice(i, 1);
    else venueTypes.value.push(v);
  }

  // ── Computed ───────────────────────────────────────────
  const statusCounts = computed(() => {
    let unchecked = 0,
      checked = 0,
      not_checking = 0;
    for (const b of bars.value) {
      if (b.checkStatus === "checked") checked++;
      else if (b.checkStatus === "not_checking") not_checking++;
      else unchecked++;
    }
    return { unchecked, checked, not_checking };
  });

  const filteredBars = computed(() => {
    let result = bars.value;
    const f = filter.value.trim().toLowerCase();
    if (f) {
      result = result.filter((b) =>
        `${b.name} ${b.address}`.toLowerCase().includes(f)
      );
    }
    if (statusFilter.value !== "all") {
      result = result.filter((b) => b.checkStatus === statusFilter.value);
    }
    return result;
  });

  // ── Callback for map repaint ───────────────────────────
  let onMarkersChanged: (() => void) | null = null;

  function setOnMarkersChanged(fn: () => void) {
    onMarkersChanged = fn;
  }

  // ── Actions ────────────────────────────────────────────
  async function searchBars(lat: number, lng: number, radius: number) {
    searching.value = true;
    error.value = null;

    try {
      const res = await $fetch<any>("/api/bars/search", {
        method: "POST",
        body: { lat, lng, radius, venueTypes: venueTypes.value },
      });
      bars.value = res.bars;
      center.value = res.center;
      searchRadius.value = res.radius;
      onMarkersChanged?.();
    } catch (e: any) {
      error.value = e?.data?.message || e?.message || "Search failed";
    } finally {
      searching.value = false;
    }
  }

  function toggleStatus(bar: HuntBar, target: string) {
    // Pure local toggle — no API call
    bar.checkStatus = (bar.checkStatus === target ? "unchecked" : target) as HuntBar["checkStatus"];
    onMarkersChanged?.();
  }

  return {
    // State
    searching,
    error,
    bars,
    center,
    searchRadius,
    filter,
    statusFilter,
    venueTypes,

    // Computed
    statusCounts,
    filteredBars,

    // Actions
    searchBars,
    toggleStatus,
    toggleVenueType,
    setOnMarkersChanged,
  };
}
