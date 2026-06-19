import { defineEventHandler, readBody, createError } from "h3";

// POST /api/bars/search
// Unauthenticated bar search — returns bars without persisting to DB.
// Used by the standalone bar-finder feature.
export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const lat = Number(body?.lat);
  const lng = Number(body?.lng);
  const radius = Number(body?.radius) || 1500;
  // Optional venue-type filter from the finder UI (undefined → default set). The
  // finder has no game schedule, so there's no opening-time filter here.
  const venueTypes =
    Array.isArray(body?.venueTypes) && body.venueTypes.length ? body.venueTypes : undefined;

  if (isNaN(lat) || isNaN(lng)) {
    throw createError({ statusCode: 400, statusMessage: "lat and lng are required numbers" });
  }

  if (radius < 100 || radius > 2000) {
    throw createError({ statusCode: 400, statusMessage: "radius must be between 100 and 2000 meters" });
  }

  const config = useRuntimeConfig();
  const apiKey = config.geoapifyApiKey;

  const { bars, total } = await searchBarsViaGeoapify(
    lat,
    lng,
    radius,
    { venueTypes: venueTypes as any },
    apiKey
  );

  // Return bars as HuntBar-compatible objects (synthetic IDs, all unchecked)
  return {
    center: { lat, lng },
    radius,
    total,
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
