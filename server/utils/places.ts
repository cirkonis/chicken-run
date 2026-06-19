/**
 * Shared bar types + the "Open in Maps" link helper.
 *
 * The bar SEARCH (and geocoding) now lives in geoapify.ts — we replaced Google
 * Places with Geoapify (OpenStreetMap data via a clean, free REST API). This
 * file keeps only the provider-agnostic bits the rest of the app depends on.
 * (Kept the filename to avoid churn across imports.)
 */

// ── Venue categories ────────────────────────────────────────
// The categories the app understands. The host's bar rules pick which ones
// count as a target; each maps to a Geoapify category (see geoapify.ts).
export type Category =
  | "bar"
  | "pub"
  | "taproom"
  | "biergarten"
  | "nightclub"
  | "brewery"
  | "cafe"
  | "restaurant"
  | "other";

// ── A bar from the search, ready to upsert into hunt_bars ───
// rating / ratingsTotal / priceLevel / businessStatus are kept for DB-shape
// compatibility but are always null now (OSM/Geoapify don't provide them).
export interface PlaceBar {
  placeId: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  rating: number | null;
  ratingsTotal: number | null;
  priceLevel: number | null;
  businessStatus: string | null;
  mapsUrl: string;
  category: string;
}

// ── Host-editable filter rules applied to a search ──────────
export interface BarFilters {
  /** Venue categories to include. Defaults to the bar-ish set (see geoapify.ts). */
  venueTypes?: Category[];
  /**
   * If set, keep only venues open at this day-of-week (0=Sun..6=Sat) +
   * minute-of-day. Venues with no / unparseable hours are KEPT. Null = skip.
   */
  openAt?: { day: number; minute: number } | null;
}

// ── Maps link ───────────────────────────────────────────────
/**
 * A Google Maps "search" link from name + address. This is just a URL — it
 * needs NO API key and works anywhere — so we keep using it for the bar's
 * "Open in Maps" button regardless of where the bar data came from.
 */
export function buildSearchMapsUrl(name: string, address: string): string {
  const query = encodeURIComponent([name, address].filter(Boolean).join(", "));
  return `https://www.google.com/maps/search/?api=1&query=${query}`;
}
