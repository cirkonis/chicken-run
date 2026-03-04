import { defineEventHandler, getRouterParam, createError } from "h3";
import { getUserClient, requireUser } from "../../utils/supabase";

// GET /api/hunts/:huntId — get a single hunt with bars, hints, participants
export default defineEventHandler(async (event) => {
  const userId = await requireUser(event);
  const huntId = getRouterParam(event, "huntId");
  const supabase = getUserClient(event);

  if (!huntId) {
    throw createError({ statusCode: 400, statusMessage: "Missing huntId" });
  }

  // Fetch hunt (RLS will enforce participant access)
  const { data: hunt, error: hError } = await supabase
    .from("hunts")
    .select("*")
    .eq("id", huntId)
    .single();

  if (hError || !hunt) {
    throw createError({
      statusCode: 404,
      statusMessage: "Hunt not found or you don't have access",
    });
  }

  // Fetch bars, hints, and participants in parallel
  const [barsResult, hintsResult, participantsResult] = await Promise.all([
    supabase
      .from("hunt_bars")
      .select("*")
      .eq("hunt_id", huntId)
      .order("name"),
    supabase
      .from("hints")
      .select("id, text, author_id, created_at")
      .eq("hunt_id", huntId)
      .order("created_at", { ascending: false }),
    supabase
      .from("hunt_participants")
      .select("user_id, role, joined_at, profiles(display_name, avatar_url)")
      .eq("hunt_id", huntId),
  ]);

  return {
    hunt: {
      id: hunt.id,
      name: hunt.name,
      hunterCode: hunt.hunter_code,
      chickenCode: hunt.chicken_code,
      centerLat: hunt.center_lat,
      centerLng: hunt.center_lng,
      radiusMeters: hunt.radius_meters,
      status: hunt.status,
      creatorId: hunt.creator_id,
      createdAt: hunt.created_at,
    },
    bars: (barsResult.data || []).map((b) => ({
      id: b.id,
      placeId: b.place_id,
      name: b.name,
      address: b.address,
      lat: b.lat,
      lng: b.lng,
      rating: b.rating,
      ratingsTotal: b.ratings_total,
      priceLevel: b.price_level,
      status: b.business_status,
      mapsUrl: b.maps_url,
      category: b.category,
      checkStatus: b.check_status,
      checkedBy: b.checked_by,
      checkedAt: b.checked_at,
    })),
    hints: hintsResult.data || [],
    participants: (participantsResult.data || []).map((p: any) => ({
      userId: p.user_id,
      role: p.role,
      joinedAt: p.joined_at,
      displayName: p.profiles?.display_name || "Unknown",
      avatarUrl: p.profiles?.avatar_url,
    })),
  };
});
