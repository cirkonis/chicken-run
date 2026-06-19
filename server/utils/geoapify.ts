/**
 * Bar search + geocoding via Geoapify — the free, no-billing replacement for
 * Google Places.
 *
 * Geoapify serves OpenStreetMap data through a clean REST API. Compared to the
 * old Google Places search:
 *   • ONE request covers the whole radius (no 20-per-circle tiling).
 *   • Querying specific categories IS the filter (server-side), so there's no
 *     client-side category filtering to do afterwards.
 *   • opening_hours comes back as an OSM-style string (e.g. "Mo-Th 16:00-24:00;
 *     Fr-Sa 14:00-02:00"), parsed here with the `opening_hours` library.
 *   • No ratings / reviews / price / business status (OSM has none → null).
 *
 * Returns the SAME `PlaceBar` shape as before, so endpoints / DB / UI are
 * unchanged.
 */
import { createError } from "h3";
import opening_hours from "opening_hours";
import { buildSearchMapsUrl, type PlaceBar, type BarFilters, type Category } from "./places";

// Max venues per request. Geoapify bills per-request (not per-result) and the
// densest spots we've seen top out ~180 in a 1500–2000m radius, so 500 (the API
// max) guarantees we never truncate. One free call gets everything.
const GEOAPIFY_LIMIT = 500;

// Default venue categories when the host hasn't customised their bar rules:
// the proper drinking spots. (Mirrors VENUE_TYPE_OPTIONS defaults in
// composables/useSchedule.ts — keep the two in sync.)
export const DEFAULT_VENUE_TYPES: Category[] = ["bar", "pub", "taproom", "biergarten"];

// Our venue keys → the Geoapify category that selects them. (Validated live:
// nightclubs live under adult.*, breweries under production.*; the rest under
// catering.*.)
const VENUE_TO_GEOAPIFY: Record<Exclude<Category, "other">, string> = {
  bar: "catering.bar",
  pub: "catering.pub",
  taproom: "catering.taproom",
  biergarten: "catering.biergarten",
  nightclub: "adult.nightclub",
  brewery: "production.brewery",
  cafe: "catering.cafe",
  restaurant: "catering.restaurant",
};

// Priority order for classifying a result back to ONE of our keys (a place can
// carry several category tags; we pick the most specific drinking one first).
const CLASSIFY_ORDER: Array<Exclude<Category, "other">> = [
  "taproom", "brewery", "biergarten", "pub", "bar", "nightclub", "cafe", "restaurant",
];

/** Map a Geoapify feature's `categories` array back to one of our venue keys. */
function classifyGeoapify(categories: string[]): string {
  const set = new Set(categories);
  for (const key of CLASSIFY_ORDER) {
    if (set.has(VENUE_TO_GEOAPIFY[key])) return key;
  }
  return "other";
}

// ── opening_hours parsing (OSM-style strings) ───────────────
// A reference Sunday (2024-01-07 is a Sunday); adding `day` lands on the right
// weekday so the parser can answer "open at this moment?".
function anchorDate(day: number, minute: number): Date {
  const d = new Date(2024, 0, 7 + day, 0, 0, 0, 0);
  d.setMinutes(minute);
  return d;
}

/**
 * Is a venue open at day-of-week (0=Sun..6=Sat) + minute-of-day per its OSM
 * opening_hours string? true / false, or null when absent/unparseable —
 * callers KEEP nulls ("don't punish missing data").
 */
function isOpenAt(value: string | undefined, day: number, minute: number): boolean | null {
  if (!value || !value.trim()) return null;
  try {
    const oh = new opening_hours(value);
    return oh.getState(anchorDate(day, minute));
  } catch {
    return null; // unparseable → keep the bar
  }
}

/** Coords-based Maps link for bars with no usable address. */
function coordMapsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/search/?api=1&query=${lat}%2C${lng}`;
}

/**
 * Search Geoapify for venues near a location, honoring the host's bar rules.
 * NOTE: Geoapify's circle filter takes LON,LAT order (not lat,lng).
 */
export async function searchBarsViaGeoapify(
  lat: number,
  lng: number,
  radius: number,
  filters: BarFilters,
  apiKey: string
): Promise<{ bars: PlaceBar[]; total: number }> {
  if (!apiKey) {
    throw createError({ statusCode: 500, statusMessage: "Missing GEOAPIFY_API_KEY" });
  }

  const categories: Category[] =
    filters.venueTypes && filters.venueTypes.length ? filters.venueTypes : DEFAULT_VENUE_TYPES;
  const geoapifyCats = [
    ...new Set(
      categories
        .filter((c): c is Exclude<Category, "other"> => c !== "other")
        .map((c) => VENUE_TO_GEOAPIFY[c])
    ),
  ];
  if (geoapifyCats.length === 0) geoapifyCats.push("catering.bar");

  const url =
    `https://api.geoapify.com/v2/places?categories=${geoapifyCats.join(",")}` +
    `&filter=circle:${lng},${lat},${radius}&limit=${GEOAPIFY_LIMIT}&apiKey=${apiKey}`;

  const resp = await fetch(url);
  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw createError({ statusCode: 502, statusMessage: `Geoapify HTTP ${resp.status}: ${text.slice(0, 120)}` });
  }
  const data: any = await resp.json();
  const features: any[] = data?.features ?? [];

  const seen = new Set<string>();
  const bars: PlaceBar[] = [];

  for (const f of features) {
    const p = f.properties || {};
    const name = (p.name || "").trim();
    if (!name) continue; // unnamed venue isn't useful to show/visit

    const lt = p.lat;
    const ln = p.lon;
    if (typeof lt !== "number" || typeof ln !== "number") continue;

    // Opening-time rule (only when a schedule is supplied; unknown hours kept).
    if (filters.openAt) {
      const hours = p.opening_hours ?? p.raw?.opening_hours;
      if (isOpenAt(hours, filters.openAt.day, filters.openAt.minute) === false) continue;
    }

    const placeId: string = p.place_id || `${ln},${lt}`;
    if (seen.has(placeId)) continue;
    seen.add(placeId);

    // address_line2 is the street/city WITHOUT the name (good for the Maps link);
    // fall back to the full formatted string.
    const address: string = p.address_line2 || p.formatted || "";

    bars.push({
      placeId,
      name,
      address,
      lat: lt,
      lng: ln,
      rating: null,
      ratingsTotal: null,
      priceLevel: null,
      businessStatus: null,
      mapsUrl: address ? buildSearchMapsUrl(name, address) : coordMapsUrl(lt, ln),
      category: classifyGeoapify(p.categories || []),
    });
  }

  return { bars, total: features.length };
}

/**
 * Geocode a free-text address to lat/lng via Geoapify (best-effort) — used when
 * a host adds/edits a bar by hand. Same signature as the old Google version
 * (query, apiKey); returns null on no key / no result / any error.
 */
export async function geocodeAddress(
  query: string,
  apiKey: string
): Promise<{ lat: number; lng: number } | null> {
  if (!apiKey || !query.trim()) return null;
  try {
    const url = `https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(query)}&limit=1&apiKey=${apiKey}`;
    const resp = await fetch(url);
    if (!resp.ok) return null;
    const data: any = await resp.json();
    const p = data?.features?.[0]?.properties;
    return p && typeof p.lat === "number" ? { lat: p.lat, lng: p.lon } : null;
  } catch {
    return null;
  }
}
