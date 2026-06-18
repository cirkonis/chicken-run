/**
 * Shared Google Places API search logic.
 * Used by both the hunt bar search and the standalone bar-finder endpoint.
 */
import { createError } from "h3";

// ── Places API types ────────────────────────────────────────
export type PlaceNewResult = {
  id: string;
  displayName?: { text: string };
  formattedAddress?: string;
  shortFormattedAddress?: string;
  location?: { latitude: number; longitude: number };
  rating?: number;
  userRatingCount?: number;
  priceLevel?: string;
  businessStatus?: string;
  googleMapsUri?: string;
  primaryType?: string;
  types?: string[];
  regularOpeningHours?: {
    periods?: Array<{
      open?: { day: number; hour: number; minute: number };
      close?: { day: number; hour: number; minute: number };
    }>;
  };
};

type NearbySearchNewResponse = { places?: PlaceNewResult[] };

// ── Return type ─────────────────────────────────────────────
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

// ── Venue categories ────────────────────────────────────────
// Each Google place maps to ONE category (below). The host's bar rules choose
// which categories count as a target (default: just "bar"). Nightclubs are now a
// category of their own (they used to be lumped with bars then dropped by a
// hardcoded "opens after 6pm" rule — that heuristic is gone, replaced by the
// schedule-aware opening-time filter).
export type Category = "bar" | "cafe" | "restaurant" | "hotel" | "nightclub" | "other";

const BAR_TYPES = new Set(["bar", "bar_and_grill", "pub", "wine_bar", "beer_hall", "beer_garden", "brewpub", "sports_bar"]);
const NIGHTCLUB_TYPES = new Set(["night_club"]);
const CAFE_TYPES = new Set(["cafe", "coffee_shop"]);
const RESTAURANT_TYPES = new Set([
  "restaurant", "fast_food_restaurant", "fine_dining_restaurant",
  "hamburger_restaurant", "pizza_restaurant", "seafood_restaurant",
  "steak_house", "sushi_restaurant", "chinese_restaurant",
  "french_restaurant", "greek_restaurant", "indian_restaurant",
  "italian_restaurant", "japanese_restaurant", "mexican_restaurant",
  "thai_restaurant", "vietnamese_restaurant", "korean_restaurant",
  "ramen_restaurant", "barbecue_restaurant", "brazilian_restaurant",
  "mediterranean_restaurant", "middle_eastern_restaurant",
  "spanish_restaurant", "turkish_restaurant", "lebanese_restaurant",
  "indonesian_restaurant", "american_restaurant", "asian_restaurant",
  "vegan_restaurant", "vegetarian_restaurant", "deli", "diner",
  "breakfast_restaurant", "brunch_restaurant",
]);
const HOTEL_TYPES = new Set([
  "hotel", "bed_and_breakfast", "hostel", "inn", "motel", "resort_hotel", "lodging",
]);

// Which Google Places "includedType" to REQUEST for each category. We only ask
// Google for the categories the host wants, then re-classify the results to be
// sure (Google's primaryType is authoritative).
const CATEGORY_INCLUDED_TYPE: Record<Exclude<Category, "other">, string> = {
  bar: "bar",
  nightclub: "night_club",
  cafe: "cafe",
  restaurant: "restaurant",
  hotel: "lodging",
};

// ── Helpers ─────────────────────────────────────────────────

export function priceLevelToNumber(pl?: string): number | null {
  if (!pl) return null;
  const map: Record<string, number> = {
    PRICE_LEVEL_FREE: 0,
    PRICE_LEVEL_INEXPENSIVE: 1,
    PRICE_LEVEL_MODERATE: 2,
    PRICE_LEVEL_EXPENSIVE: 3,
    PRICE_LEVEL_VERY_EXPENSIVE: 4,
  };
  return map[pl] ?? null;
}

function classifyPlace(primaryType?: string, types?: string[]): Category {
  // primaryType is authoritative; nightclub is checked first so a club that also
  // carries a "bar" type isn't mis-bucketed as a bar.
  if (primaryType) {
    if (NIGHTCLUB_TYPES.has(primaryType)) return "nightclub";
    if (BAR_TYPES.has(primaryType)) return "bar";
    if (CAFE_TYPES.has(primaryType)) return "cafe";
    if (RESTAURANT_TYPES.has(primaryType)) return "restaurant";
    if (HOTEL_TYPES.has(primaryType)) return "hotel";
  }
  if (types?.length) {
    for (const t of types) if (NIGHTCLUB_TYPES.has(t)) return "nightclub";
    for (const t of types) if (BAR_TYPES.has(t)) return "bar";
    for (const t of types) if (CAFE_TYPES.has(t)) return "cafe";
    for (const t of types) if (RESTAURANT_TYPES.has(t)) return "restaurant";
    for (const t of types) if (HOTEL_TYPES.has(t)) return "hotel";
  }
  return "other";
}

type OpeningPeriods = NonNullable<PlaceNewResult["regularOpeningHours"]>["periods"];

const WEEK_MINUTES = 7 * 1440;

/**
 * Is a venue open at a given day-of-week (0=Sun..6=Sat) + minute-of-day, per
 * Google's weekly `regularOpeningHours.periods`?
 *   true  — open at that moment
 *   false — closed at that moment
 *   null  — unknown (no hours data) → callers KEEP the bar (don't punish missing data)
 *
 * We work in "minutes since the start of the week" so periods that cross
 * midnight or the Saturday→Sunday boundary are handled by adding a week to the
 * close (and re-checking the target a week later). A period with an `open` but
 * no `close` means 24/7.
 */
function isOpenAt(periods: OpeningPeriods, day: number, minute: number): boolean | null {
  if (!periods || periods.length === 0) return null;
  const target = day * 1440 + minute;
  for (const p of periods) {
    if (!p.open) continue;
    if (!p.close) return true; // open with no close = always open (24/7)
    const start = p.open.day * 1440 + p.open.hour * 60 + p.open.minute;
    let end = p.close.day * 1440 + p.close.hour * 60 + p.close.minute;
    if (end <= start) end += WEEK_MINUTES; // wraps past the end of the week
    if ((target >= start && target < end) || (target + WEEK_MINUTES >= start && target + WEEK_MINUTES < end)) {
      return true;
    }
  }
  return false;
}

// ── Multi-circle geometry ───────────────────────────────────
//
// Google Places returns max 20 results per request. In dense areas (city centres)
// a single circle misses bars once there are more than 20 in range. We tile the
// search area with overlapping sub-circles to overcome this limit.
//
// 5 Tiers (concentric ring pattern, each ring adds more circles):
//  ≤  300m →   7 circles (  7 API calls) — center + 6
//  ≤  600m →  19 circles ( 19 API calls) — center + 6 + 12
//  ≤ 1000m →  37 circles ( 37 API calls) — center + 6 + 12 + 18
//  ≤ 1500m →  61 circles ( 61 API calls) — center + 6 + 12 + 18 + 24
//  ≤ 2000m →  91 circles ( 91 API calls) — center + 6 + 12 + 18 + 24 + 30
//
// Key principle: ring-to-ring distance < sub-radius → guaranteed overlap.
// Max allowed radius is 2000m (capped in endpoints, not here).

type Circle = { latitude: number; longitude: number; radius: number };

function generateSearchCircles(lat: number, lng: number, radius: number): Circle[] {
  const earthRadius = 6371000;

  function addRing(circles: Circle[], count: number, offsetDist: number, subRadius: number) {
    for (let i = 0; i < count; i++) {
      const angle = (i * (360 / count) * Math.PI) / 180;
      const dLat = (offsetDist * Math.cos(angle)) / earthRadius;
      const dLng = (offsetDist * Math.sin(angle)) / (earthRadius * Math.cos((lat * Math.PI) / 180));
      circles.push({
        latitude: lat + (dLat * 180) / Math.PI,
        longitude: lng + (dLng * 180) / Math.PI,
        radius: subRadius,
      });
    }
  }

  // Tier 1 — Tiny (≤300m): center + 6 = 7 circles
  if (radius <= 300) {
    const subRadius = radius * 0.55;
    const circles: Circle[] = [{ latitude: lat, longitude: lng, radius: subRadius }];
    addRing(circles, 6, radius * 0.5, subRadius);
    return circles;
  }

  // Tier 2 — Small (≤600m): center + 6 + 12 = 19 circles
  if (radius <= 600) {
    const subRadius = radius * 0.4;
    const circles: Circle[] = [{ latitude: lat, longitude: lng, radius: subRadius }];
    addRing(circles, 6, radius * 0.38, subRadius);
    addRing(circles, 12, radius * 0.75, subRadius);
    return circles;
  }

  // Tier 3 — Medium (≤1000m): center + 6 + 12 + 18 = 37 circles
  if (radius <= 1000) {
    const subRadius = radius * 0.3;
    const circles: Circle[] = [{ latitude: lat, longitude: lng, radius: subRadius }];
    addRing(circles, 6, radius * 0.28, subRadius);
    addRing(circles, 12, radius * 0.55, subRadius);
    addRing(circles, 18, radius * 0.82, subRadius);
    return circles;
  }

  // Tier 4 — Large (≤1500m): center + 6 + 12 + 18 + 24 = 61 circles
  if (radius <= 1500) {
    const subRadius = radius * 0.24;
    const circles: Circle[] = [{ latitude: lat, longitude: lng, radius: subRadius }];
    addRing(circles, 6, radius * 0.20, subRadius);
    addRing(circles, 12, radius * 0.40, subRadius);
    addRing(circles, 18, radius * 0.60, subRadius);
    addRing(circles, 24, radius * 0.80, subRadius);
    return circles;
  }

  // Tier 5 — Full game (≤2000m): center + 6 + 12 + 18 + 24 + 30 = 91 circles
  const subRadius = radius * 0.2;
  const circles: Circle[] = [{ latitude: lat, longitude: lng, radius: subRadius }];
  addRing(circles, 6, radius * 0.17, subRadius);
  addRing(circles, 12, radius * 0.34, subRadius);
  addRing(circles, 18, radius * 0.51, subRadius);
  addRing(circles, 24, radius * 0.68, subRadius);
  addRing(circles, 30, radius * 0.85, subRadius);
  return circles;
}

// ── Search one circle via Places API ────────────────────────
const FIELD_MASK = [
  "places.id", "places.displayName", "places.formattedAddress",
  "places.shortFormattedAddress", "places.location", "places.rating",
  "places.userRatingCount", "places.priceLevel", "places.businessStatus",
  "places.googleMapsUri", "places.primaryType", "places.types",
  "places.regularOpeningHours",
].join(",");

async function searchOneCircle(circle: Circle, apiKey: string, includedTypes: string[]): Promise<PlaceNewResult[]> {
  const resp = await fetch("https://places.googleapis.com/v1/places:searchNearby", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": FIELD_MASK,
    },
    body: JSON.stringify({
      includedTypes,
      maxResultCount: 20,
      locationRestriction: {
        circle: {
          center: { latitude: circle.latitude, longitude: circle.longitude },
          radius: circle.radius,
        },
      },
    }),
  });

  if (!resp.ok) {
    const errorText = await resp.text();
    throw createError({ statusCode: 502, statusMessage: `Google Places HTTP ${resp.status}: ${errorText}` });
  }

  const data = (await resp.json()) as NearbySearchNewResponse;
  return data.places ?? [];
}

// ── Main search function ────────────────────────────────────

/**
 * Host-editable filter rules applied to a search (issue: bar rules).
 */
export interface BarFilters {
  /** Categories that count as a target. Default ["bar"]. */
  venueTypes?: Category[];
  /**
   * If set, keep only venues open at this day-of-week (0=Sun..6=Sat) +
   * minute-of-day. Venues with no opening-hours data are KEPT. Omit/null to
   * skip the opening-time filter entirely (e.g. an unscheduled hunt).
   */
  openAt?: { day: number; minute: number } | null;
}

/**
 * Search for bars near a location using Google Places API.
 * Handles multi-circle coverage, filtering, and deduplication.
 *
 * Filtering applied to every result:
 *   • ALWAYS drops temporarily/permanently CLOSED venues,
 *   • keeps only the chosen venue categories (default: bars),
 *   • if `openAt` is set, keeps only venues open at that day+time (unknown hours kept).
 */
export async function searchBarsNearby(
  lat: number,
  lng: number,
  radius: number,
  apiKey: string,
  filters: BarFilters = {}
): Promise<{ bars: PlaceBar[]; circlesUsed: number }> {
  // Resolve which categories we want and which Google types to request for them.
  const categories: Category[] =
    filters.venueTypes && filters.venueTypes.length ? filters.venueTypes : ["bar"];
  const includedTypes = [
    ...new Set(
      categories
        .filter((c): c is Exclude<Category, "other"> => c !== "other")
        .map((c) => CATEGORY_INCLUDED_TYPE[c])
    ),
  ];
  if (includedTypes.length === 0) includedTypes.push("bar");

  const allowed = new Set<Category>(categories);
  const CLOSED_STATUSES = new Set(["CLOSED_TEMPORARILY", "CLOSED_PERMANENTLY"]);

  const circles = generateSearchCircles(lat, lng, radius);
  const allPlaces = (await Promise.all(circles.map((c) => searchOneCircle(c, apiKey, includedTypes)))).flat();

  // Map → classify → filter
  const bars = allPlaces
    .map((r) => {
      const loc = r.location;
      return {
        placeId: r.id ?? "",
        name: r.displayName?.text ?? "Unknown",
        address: r.shortFormattedAddress ?? r.formattedAddress ?? "",
        lat: loc?.latitude ?? null,
        lng: loc?.longitude ?? null,
        rating: r.rating ?? null,
        ratingsTotal: r.userRatingCount ?? null,
        priceLevel: priceLevelToNumber(r.priceLevel),
        businessStatus: r.businessStatus ?? null,
        mapsUrl: r.googleMapsUri ?? `https://www.google.com/maps/search/?api=1&query_place_id=${encodeURIComponent(r.id ?? "")}`,
        category: classifyPlace(r.primaryType, r.types),
        periods: r.regularOpeningHours?.periods ?? null,
      };
    })
    .filter((b): b is typeof b & { lat: number; lng: number } =>
      typeof b.lat === "number" && typeof b.lng === "number"
    )
    // Always exclude closed venues (temporary or permanent).
    .filter((b) => !b.businessStatus || !CLOSED_STATUSES.has(b.businessStatus))
    // Venue-type rule.
    .filter((b) => allowed.has(b.category))
    // Opening-time rule: only when a schedule is supplied; unknown hours are kept.
    .filter((b) => {
      if (!filters.openAt) return true;
      return isOpenAt(b.periods, filters.openAt.day, filters.openAt.minute) !== false;
    });

  // Deduplicate by placeId
  const unique = new Map<string, (typeof bars)[number]>();
  for (const b of bars) unique.set(b.placeId, b);

  const result: PlaceBar[] = Array.from(unique.values()).map((b) => ({
    placeId: b.placeId,
    name: b.name,
    address: b.address,
    lat: b.lat,
    lng: b.lng,
    rating: b.rating,
    ratingsTotal: b.ratingsTotal,
    priceLevel: b.priceLevel,
    businessStatus: b.businessStatus,
    mapsUrl: b.mapsUrl,
    category: b.category,
  }));

  return { bars: result, circlesUsed: circles.length };
}

// ── Editable / manual bars ──────────────────────────────────
//
// For bars a human edits or adds by hand we have no Google place id, so we build
// a Google Maps "search" URL from the name + address — it always resolves to the
// right place. The map pin (lat/lng) is geocoded best-effort.

/** A Google Maps link that searches for "<name>, <address>". Always works. */
export function buildSearchMapsUrl(name: string, address: string): string {
  const query = encodeURIComponent([name, address].filter(Boolean).join(", "));
  return `https://www.google.com/maps/search/?api=1&query=${query}`;
}

/**
 * Geocode an address to lat/lng via the Google Geocoding API (best-effort).
 * Returns null on no key / no result / any error — callers fall back to the hunt
 * centre. Requires the Geocoding API enabled on the key.
 */
export async function geocodeAddress(
  query: string,
  apiKey: string
): Promise<{ lat: number; lng: number } | null> {
  if (!apiKey || !query.trim()) return null;
  try {
    const resp = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&key=${apiKey}`
    );
    if (!resp.ok) return null;
    const data = (await resp.json()) as any;
    const loc = data?.results?.[0]?.geometry?.location;
    return loc && typeof loc.lat === "number" ? { lat: loc.lat, lng: loc.lng } : null;
  } catch {
    return null;
  }
}
