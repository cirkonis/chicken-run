import { defineEventHandler, getQuery, createError } from "h3";

// ── Places API (New) types ──────────────────────────────────────────
// Uses the Nearby Search (New) endpoint:
// POST https://places.googleapis.com/v1/places:searchNearby

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

// ── Multi-circle geometry ───────────────────────────────────────────
// The new API caps at 20 results per call. To get better coverage we
// tile the big circle with smaller overlapping sub-circles and dedupe.
// For a 1500m radius we use: 1 center circle (750m) + 6 surrounding
// circles (750m each) offset at 60° intervals at ~750m from center.
// This covers the full area with overlap for deduplication.

type Circle = { latitude: number; longitude: number; radius: number };

function generateSearchCircles(
  lat: number,
  lng: number,
  radius: number
): Circle[] {
  // For small radii, a single circle is fine
  if (radius <= 800) {
    return [{ latitude: lat, longitude: lng, radius }];
  }

  const subRadius = radius * 0.55; // slightly more than half for overlap
  const offsetDist = radius * 0.5; // how far out to push the ring circles

  const circles: Circle[] = [
    // Center circle
    { latitude: lat, longitude: lng, radius: subRadius },
  ];

  // 6 circles in a ring around center
  const earthRadius = 6371000; // meters
  for (let i = 0; i < 6; i++) {
    const angle = (i * 60 * Math.PI) / 180; // 0°, 60°, 120°, ...
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

  return circles;
}

// Field mask controls what fields come back (and what you get billed for).
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
].join(",");

async function searchOneCircle(
  circle: Circle,
  apiKey: string
): Promise<PlaceNewResult[]> {
  const body = {
    includedTypes: ["bar"],
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

  // Generate sub-circles and fetch them all in parallel
  const circles = generateSearchCircles(lat, lng, radius);
  const allPlaces = (
    await Promise.all(circles.map((c) => searchOneCircle(c, apiKey)))
  ).flat();

  const bars = allPlaces
    .map((r) => {
      const loc = r.location;
      const placeId = r.id ?? "";
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
      };
    })
    .filter(
      (b): b is typeof b & { lat: number; lng: number } =>
        typeof b.lat === "number" && typeof b.lng === "number"
    );

  // De-dupe by placeId (lots of overlap between circles, this is expected)
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
