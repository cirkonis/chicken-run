import { defineEventHandler, getQuery, createError } from "h3";

// ── Places API (New) types ──────────────────────────────────────────

type PlaceNewResult = {
  id: string;
  displayName?: { text: string; languageCode?: string };
  formattedAddress?: string;
  shortFormattedAddress?: string;
  location?: { latitude: number; longitude: number };
  rating?: number;
  userRatingCount?: number;
  priceLevel?:
    | "PRICE_LEVEL_FREE"
    | "PRICE_LEVEL_INEXPENSIVE"
    | "PRICE_LEVEL_MODERATE"
    | "PRICE_LEVEL_EXPENSIVE"
    | "PRICE_LEVEL_VERY_EXPENSIVE";
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

type NearbySearchNewResponse = {
  places?: PlaceNewResult[];
};

function mustNumber(v: unknown, name: string): number {
  const n = typeof v === "string" ? Number(v) : NaN;
  if (!Number.isFinite(n))
    throw createError({ statusCode: 400, statusMessage: `Invalid ${name}` });
  return n;
}

function priceLevelToNumber(pl?: string): number | null {
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

// ── Category classification ─────────────────────────────────────────
// Based on primaryType + types from the Places API, we bucket each
// place into a category for the UI to section them.

const BAR_TYPES = new Set([
  "bar",
  "bar_and_grill",
  "pub",
  "wine_bar",
  "night_club",
]);

// Strict set: only these primaryTypes are "real" bars we want to keep
const REAL_BAR_PRIMARY_TYPES = new Set([
  "bar",
  "bar_and_grill",
  "pub",
  "wine_bar",
]);

const CAFE_TYPES = new Set([
  "cafe",
  "coffee_shop",
]);

const RESTAURANT_TYPES = new Set([
  "restaurant",
  "fast_food_restaurant",
  "fine_dining_restaurant",
  "hamburger_restaurant",
  "pizza_restaurant",
  "seafood_restaurant",
  "steak_house",
  "sushi_restaurant",
  "chinese_restaurant",
  "french_restaurant",
  "greek_restaurant",
  "indian_restaurant",
  "italian_restaurant",
  "japanese_restaurant",
  "mexican_restaurant",
  "thai_restaurant",
  "vietnamese_restaurant",
  "korean_restaurant",
  "ramen_restaurant",
  "barbecue_restaurant",
  "brazilian_restaurant",
  "mediterranean_restaurant",
  "middle_eastern_restaurant",
  "spanish_restaurant",
  "turkish_restaurant",
  "lebanese_restaurant",
  "indonesian_restaurant",
  "american_restaurant",
  "asian_restaurant",
  "vegan_restaurant",
  "vegetarian_restaurant",
  "deli",
  "diner",
  "breakfast_restaurant",
  "brunch_restaurant",
]);

const HOTEL_TYPES = new Set([
  "hotel",
  "bed_and_breakfast",
  "hostel",
  "inn",
  "motel",
  "resort_hotel",
  "lodging",
]);

type Category = "bar" | "cafe" | "restaurant" | "hotel" | "other";

function classifyPlace(primaryType?: string, types?: string[]): Category {
  // primaryType is the strongest signal
  if (primaryType) {
    if (BAR_TYPES.has(primaryType)) return "bar";
    if (CAFE_TYPES.has(primaryType)) return "cafe";
    if (RESTAURANT_TYPES.has(primaryType)) return "restaurant";
    if (HOTEL_TYPES.has(primaryType)) return "hotel";
  }

  // Fall back to checking the types array
  if (types && types.length > 0) {
    // Check in priority order: bar > cafe > restaurant > hotel
    for (const t of types) {
      if (BAR_TYPES.has(t)) return "bar";
    }
    for (const t of types) {
      if (CAFE_TYPES.has(t)) return "cafe";
    }
    for (const t of types) {
      if (RESTAURANT_TYPES.has(t)) return "restaurant";
    }
    for (const t of types) {
      if (HOTEL_TYPES.has(t)) return "hotel";
    }
  }

  return "other";
}

// ── Opening hours helpers ───────────────────────────────────────────

/** Returns the earliest opening hour across all periods, or null if unknown. */
function getEarliestOpenHour(
  hours?: PlaceNewResult["regularOpeningHours"]
): number | null {
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

/** Returns true if this place is a nightclub (opens at 18:00 or later). */
function isNightclub(
  primaryType?: string,
  openHour?: number | null
): boolean {
  if (primaryType === "night_club") return true;
  if (openHour !== null && openHour !== undefined && openHour >= 18) return true;
  return false;
}

// ── Multi-circle geometry ───────────────────────────────────────────

type Circle = { latitude: number; longitude: number; radius: number };

function generateSearchCircles(
  lat: number,
  lng: number,
  radius: number
): Circle[] {
  if (radius <= 800) {
    return [{ latitude: lat, longitude: lng, radius }];
  }

  // 19 circles: 1 center + 6 inner ring + 12 outer ring
  // Each sub-circle is 500m radius — good overlap for a 1.5km area
  const subRadius = radius * 0.35;
  const innerOffset = radius * 0.38;
  const outerOffset = radius * 0.75;

  const circles: Circle[] = [
    { latitude: lat, longitude: lng, radius: subRadius },
  ];

  const earthRadius = 6371000;

  function addRing(count: number, offsetDist: number) {
    for (let i = 0; i < count; i++) {
      const angle = (i * (360 / count) * Math.PI) / 180;
      const dLat = (offsetDist * Math.cos(angle)) / earthRadius;
      const dLng =
        (offsetDist * Math.sin(angle)) /
        (earthRadius * Math.cos((lat * Math.PI) / 180));

      circles.push({
        latitude: lat + (dLat * 180) / Math.PI,
        longitude: lng + (dLng * 180) / Math.PI,
        radius: subRadius,
      });
    }
  }

  // Inner ring: 6 circles
  addRing(6, innerOffset);
  // Outer ring: 12 circles
  addRing(12, outerOffset);

  return circles;
}

// Field mask — now includes primaryType and types
const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.shortFormattedAddress",
  "places.location",
  "places.rating",
  "places.userRatingCount",
  "places.priceLevel",
  "places.businessStatus",
  "places.googleMapsUri",
  "places.primaryType",
  "places.types",
  "places.regularOpeningHours",
].join(",");

async function searchOneCircle(
  circle: Circle,
  apiKey: string
): Promise<PlaceNewResult[]> {
  const body = {
    includedTypes: ["bar"],
    excludedTypes: ["hotel", "restaurant", "cafe", "coffee_shop", "lodging"],
    maxResultCount: 20,
    locationRestriction: {
      circle: {
        center: { latitude: circle.latitude, longitude: circle.longitude },
        radius: circle.radius,
      },
    },
  };

  const resp = await fetch(
    "https://places.googleapis.com/v1/places:searchNearby",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": FIELD_MASK,
      },
      body: JSON.stringify(body),
    }
  );

  if (!resp.ok) {
    const errorText = await resp.text();
    throw createError({
      statusCode: 502,
      statusMessage: `Google Places HTTP ${resp.status}: ${errorText}`,
    });
  }

  const data = (await resp.json()) as NearbySearchNewResponse;
  return data.places ?? [];
}

export default defineEventHandler(async (event) => {
  const q = getQuery(event);

  const lat = mustNumber(q.lat, "lat");
  const lng = mustNumber(q.lng, "lng");
  const radius = q.radius ? mustNumber(q.radius, "radius") : 1500;

  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    throw createError({
      statusCode: 500,
      statusMessage: "Missing GOOGLE_MAPS_API_KEY env var on the server",
    });
  }

  const circles = generateSearchCircles(lat, lng, radius);
  const allPlaces = (
    await Promise.all(circles.map((c) => searchOneCircle(c, apiKey)))
  ).flat();

  const bars = allPlaces
    .map((r) => {
      const loc = r.location;
      const placeId = r.id ?? "";
      const openHour = getEarliestOpenHour(r.regularOpeningHours);
      const category = classifyPlace(r.primaryType, r.types);

      return {
        placeId,
        name: r.displayName?.text ?? "Unknown",
        address: r.shortFormattedAddress ?? r.formattedAddress ?? "",
        lat: loc?.latitude ?? null,
        lng: loc?.longitude ?? null,
        rating: r.rating ?? null,
        ratingsTotal: r.userRatingCount ?? null,
        priceLevel: priceLevelToNumber(r.priceLevel),
        status: r.businessStatus ?? null,
        mapsUrl:
          r.googleMapsUri ??
          `https://www.google.com/maps/search/?api=1&query_place_id=${encodeURIComponent(placeId)}`,
        primaryType: r.primaryType ?? null,
        types: r.types ?? [],
        category,
        openHour,
      };
    })
    .filter(
      (b): b is typeof b & { lat: number; lng: number } =>
        typeof b.lat === "number" && typeof b.lng === "number"
    )
    // Drop nightclubs (primaryType night_club OR opens at 18:00+)
    .filter((b) => !isNightclub(b.primaryType ?? undefined, b.openHour))
    // Only keep places whose primaryType is a real bar type.
    // This catches music venues, IT companies, etc. that have "bar" in
    // their types array but are not actually bars.
    .filter((b) => b.primaryType != null && REAL_BAR_PRIMARY_TYPES.has(b.primaryType));

  const unique = new Map<string, (typeof bars)[number]>();
  for (const b of bars) unique.set(b.placeId, b);

  return {
    center: { lat, lng },
    radius,
    circlesUsed: circles.length,
    count: unique.size,
    bars: Array.from(unique.values()),
  };
});
