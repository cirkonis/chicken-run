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

  // Verify hunt exists and user has access (also pull the schedule + bar rules)
  const { data: hunt, error: hError } = await supabase
    .from("hunts")
    .select("id, center_lat, center_lng, radius_meters, game_day, start_minute, bar_filters")
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

  // Resolve the host's bar rules (issue: bar rules).
  //  • venueTypes — which categories count (default: just bars).
  //  • openAt     — apply the opening-time filter only if the host left it on AND
  //                 the hunt has a scheduled day + start time.
  const bf = (hunt.bar_filters as any) || {};
  const venueTypes: string[] =
    Array.isArray(bf.venueTypes) && bf.venueTypes.length ? bf.venueTypes : ["bar"];
  const filterByOpeningTime = bf.filterByOpeningTime !== false; // default ON
  const openAt =
    filterByOpeningTime && hunt.game_day != null && hunt.start_minute != null
      ? { day: hunt.game_day as number, minute: hunt.start_minute as number }
      : null;

  // Search Google Places via shared util, honoring the rules
  const { bars: uniqueBars, circlesUsed } = await searchBarsNearby(
    hunt.center_lat,
    hunt.center_lng,
    hunt.radius_meters,
    apiKey,
    { venueTypes: venueTypes as any, openAt }
  );

  // Bars a human has edited keep their corrections — exclude them from the
  // re-upsert so a re-search can't overwrite the fix.
  const { data: editedRows } = await supabase
    .from("hunt_bars")
    .select("place_id")
    .eq("hunt_id", huntId)
    .eq("edited", true)
    .not("place_id", "is", null);
  const editedPlaceIds = new Set((editedRows || []).map((r) => r.place_id));

  // Upsert bars into Supabase (don't overwrite existing check_status / edits)
  if (uniqueBars.length > 0) {
    const rows = uniqueBars
      .filter((b) => !editedPlaceIds.has(b.placeId))
      .map((b) => ({
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
      .eq("source", "google")
      .eq("edited", false)
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
