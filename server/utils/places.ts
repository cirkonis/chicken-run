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

// ── Classification constants ────────────────────────────────
const BAR_TYPES = new Set(["bar", "bar_and_grill", "pub", "wine_bar", "night_club"]);
const REAL_BAR_PRIMARY_TYPES = new Set(["bar", "bar_and_grill", "pub", "wine_bar"]);
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

type Category = "bar" | "cafe" | "restaurant" | "hotel" | "other";

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
  if (primaryType) {
    if (BAR_TYPES.has(primaryType)) return "bar";
    if (CAFE_TYPES.has(primaryType)) return "cafe";
    if (RESTAURANT_TYPES.has(primaryType)) return "restaurant";
    if (HOTEL_TYPES.has(primaryType)) return "hotel";
  }
  if (types?.length) {
    for (const t of types) if (BAR_TYPES.has(t)) return "bar";
    for (const t of types) if (CAFE_TYPES.has(t)) return "cafe";
    for (const t of types) if (RESTAURANT_TYPES.has(t)) return "restaurant";
    for (const t of types) if (HOTEL_TYPES.has(t)) return "hotel";
  }
  return "other";
}

function getEarliestOpenHour(hours?: PlaceNewResult["regularOpeningHours"]): number | null {
  if (!hours?.periods?.length) return null;
  let earliest = 24;
  for (const p of hours.periods) {
    if (p.open) {
      const h = p.open.hour + p.open.minute / 60;
      if (h < earliest) earliest = h;
    }
  }
  return earliest === 24 ? null : earliest;
}

function isNightclub(primaryType?: string, openHour?: number | null): boolean {
  if (primaryType === "night_club") return true;
  if (openHour != null && openHour >= 18) return true;
  return false;
}

// ── Multi-circle geometry ───────────────────────────────────
//
// Google Places returns max 20 results per request. In dense areas (city centres)
// a single circle misses bars once there are more than 20 in range. We tile the
// search area with overlapping sub-circles to overcome this limit.
//
//  ≤ 300m  →  1 circle   (1 API call)   — small area, 20-cap is fine
//  ≤ 800m  →  7 circles  (7 API calls)  — center + ring of 6
//  > 800m  → 19 circles  (19 API calls) — center + inner ring of 6 + outer ring of 12
//
// Max allowed radius is 3000m (capped in endpoints, not here).

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

  // Small: single circle is enough
  if (radius <= 300) {
    return [{ latitude: lat, longitude: lng, radius }];
  }

  // Medium: center + ring of 6 (7 circles)
  if (radius <= 800) {
    const subRadius = radius * 0.55;
    const offset = radius * 0.5;
    const circles: Circle[] = [{ latitude: lat, longitude: lng, radius: subRadius }];
    addRing(circles, 6, offset, subRadius);
    return circles;
  }

  // Large: center + inner ring of 6 + outer ring of 12 (19 circles)
  const subRadius = radius * 0.35;
  const innerOffset = radius * 0.38;
  const outerOffset = radius * 0.75;
  const circles: Circle[] = [{ latitude: lat, longitude: lng, radius: subRadius }];
  addRing(circles, 6, innerOffset, subRadius);
  addRing(circles, 12, outerOffset, subRadius);
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

async function searchOneCircle(circle: Circle, apiKey: string): Promise<PlaceNewResult[]> {
  const resp = await fetch("https://places.googleapis.com/v1/places:searchNearby", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": FIELD_MASK,
    },
    body: JSON.stringify({
      includedTypes: ["bar"],
      excludedTypes: ["hotel", "restaurant", "cafe", "coffee_shop", "lodging"],
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
 * Search for bars near a location using Google Places API.
 * Handles multi-circle coverage, filtering, and deduplication.
 */
export async function searchBarsNearby(
  lat: number,
  lng: number,
  radius: number,
  apiKey: string
): Promise<{ bars: PlaceBar[]; circlesUsed: number }> {
  const circles = generateSearchCircles(lat, lng, radius);
  const allPlaces = (await Promise.all(circles.map((c) => searchOneCircle(c, apiKey)))).flat();

  // Filter and classify
  const bars = allPlaces
    .map((r) => {
      const loc = r.location;
      const openHour = getEarliestOpenHour(r.regularOpeningHours);
      const category = classifyPlace(r.primaryType, r.types);
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
        primaryType: r.primaryType ?? null,
        category,
        openHour,
      };
    })
    .filter((b): b is typeof b & { lat: number; lng: number } =>
      typeof b.lat === "number" && typeof b.lng === "number"
    )
    .filter((b) => !isNightclub(b.primaryType ?? undefined, b.openHour))
    .filter((b) => b.primaryType != null && REAL_BAR_PRIMARY_TYPES.has(b.primaryType));

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
