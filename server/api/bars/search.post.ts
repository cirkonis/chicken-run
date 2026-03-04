import { defineEventHandler, readBody, createError } from "h3";

// POST /api/bars/search
// Unauthenticated bar search — returns bars without persisting to DB.
// Used by the standalone bar-finder feature.
export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const lat = Number(body?.lat);
  const lng = Number(body?.lng);
  const radius = Number(body?.radius) || 1500;

  if (isNaN(lat) || isNaN(lng)) {
    throw createError({ statusCode: 400, statusMessage: "lat and lng are required numbers" });
  }

  if (radius < 100 || radius > 3000) {
    throw createError({ statusCode: 400, statusMessage: "radius must be between 100 and 3000 meters" });
  }

  const config = useRuntimeConfig();
  const apiKey = config.googlePlacesApiKey;
  if (!apiKey) {
    throw createError({ statusCode: 500, statusMessage: "Missing GOOGLE_PLACES_API_KEY" });
  }

  const { bars, circlesUsed } = await searchBarsNearby(lat, lng, radius, apiKey);

  // Return bars as HuntBar-compatible objects (synthetic IDs, all unchecked)
  return {
    center: { lat, lng },
    radius,
    circlesUsed,
    count: bars.length,
    bars: bars.map((b) => ({
      id: b.placeId,
      placeId: b.placeId,
      name: b.name,
      address: b.address,
      lat: b.lat,
      lng: b.lng,
      rating: b.rating,
      ratingsTotal: b.ratingsTotal,
      priceLevel: b.priceLevel,
      status: b.businessStatus,
      mapsUrl: b.mapsUrl,
      category: b.category,
      checkStatus: "unchecked",
      checkedBy: null,
      checkedAt: null,
    })),
  };
});
