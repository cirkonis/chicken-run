import { defineEventHandler, getRouterParam, createError } from "h3";
import { getUserClient } from "../../../../utils/supabase";

// POST /api/hunts/:huntId/bars/search
// Searches Google Places for bars around the hunt's center, saves them to Supabase
export default defineEventHandler(async (event) => {
  const huntId = getRouterParam(event, "huntId");
  const supabase = getUserClient(event);

  if (!huntId) {
    throw createError({ statusCode: 400, statusMessage: "Missing huntId" });
  }

  // Verify hunt exists and user has access
  const { data: hunt, error: hError } = await supabase
    .from("hunts")
    .select("id, center_lat, center_lng, radius_meters")
    .eq("id", huntId)
    .single();

  if (hError || !hunt) {
    throw createError({ statusCode: 404, statusMessage: "Hunt not found or no access" });
  }

  const config = useRuntimeConfig();
  const apiKey = config.googlePlacesApiKey;
  if (!apiKey) {
    throw createError({ statusCode: 500, statusMessage: "Missing GOOGLE_PLACES_API_KEY" });
  }

  // Search Google Places via shared util
  const { bars: uniqueBars, circlesUsed } = await searchBarsNearby(
    hunt.center_lat,
    hunt.center_lng,
    hunt.radius_meters,
    apiKey
  );

  // Upsert bars into Supabase (don't overwrite existing check_status)
  if (uniqueBars.length > 0) {
    const rows = uniqueBars.map((b) => ({
      hunt_id: huntId,
      place_id: b.placeId,
      name: b.name,
      address: b.address,
      lat: b.lat,
      lng: b.lng,
      rating: b.rating,
      ratings_total: b.ratingsTotal,
      price_level: b.priceLevel,
      business_status: b.businessStatus,
      maps_url: b.mapsUrl,
      category: b.category,
    }));

    const { error: upsertError } = await supabase
      .from("hunt_bars")
      .upsert(rows, { onConflict: "hunt_id,place_id", ignoreDuplicates: false });

    if (upsertError) {
      throw createError({
        statusCode: 500,
        statusMessage: `Failed to save bars: ${upsertError.message}`,
      });
    }
  }

  // Remove stale bars from old location that aren't in the new search results
  if (uniqueBars.length > 0) {
    const newPlaceIds = uniqueBars.map((b) => b.placeId);
    await supabase
      .from("hunt_bars")
      .delete()
      .eq("hunt_id", huntId)
      .not("place_id", "in", `(${newPlaceIds.join(",")})`);
  }

  // Return the full bar list from DB
  const { data: savedBars } = await supabase
    .from("hunt_bars")
    .select("*")
    .eq("hunt_id", huntId)
    .order("name");

  return {
    center: { lat: hunt.center_lat, lng: hunt.center_lng },
    radius: hunt.radius_meters,
    circlesUsed,
    count: uniqueBars.length,
    bars: (savedBars || []).map(mapBar),
  };
});
