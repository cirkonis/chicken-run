import { defineEventHandler, getRouterParam, readBody, createError } from "h3";
import { getAdminClient } from "../../../../utils/supabase";
import { buildSearchMapsUrl, geocodeAddress } from "../../../../utils/places";

// POST /api/hunts/:huntId/bars/add — add a bar by hand (name + address).
// Host or a chicken only. We geocode the address for the map pin and build a
// Google Maps search link, so it behaves like a normal bar.
export default defineEventHandler(async (event) => {
  const userId = event.context.userId!;
  const huntId = getRouterParam(event, "huntId");
  if (!huntId) throw createError({ statusCode: 400, statusMessage: "Missing huntId" });

  const admin = getAdminClient();
  const [{ data: participant }, { data: hunt }] = await Promise.all([
    admin.from("hunt_participants").select("role").eq("hunt_id", huntId).eq("user_id", userId).maybeSingle(),
    admin.from("hunts").select("creator_id, center_lat, center_lng").eq("id", huntId).maybeSingle(),
  ]);
  if (!hunt) throw createError({ statusCode: 404, statusMessage: "Hunt not found" });
  // A hunt manager (creator or co-manager) or a chicken can add bars (issue #4).
  if (!(await isHuntManager(huntId, userId)) && participant?.role !== "chicken") {
    throw createError({ statusCode: 403, statusMessage: "Only a manager or a chicken can add bars" });
  }

  const body = await readBody<{ name?: string; address?: string }>(event);
  const name = (body?.name || "").trim();
  const address = (body?.address || "").trim();
  if (!name) throw createError({ statusCode: 400, statusMessage: "Bar name is required" });

  // Geocode for the map pin (best-effort); fall back to the hunt centre.
  const config = useRuntimeConfig();
  const geo = await geocodeAddress(`${name} ${address}`, config.googlePlacesApiKey);

  const { data, error } = await admin
    .from("hunt_bars")
    .insert({
      hunt_id: huntId,
      place_id: null,
      source: "manual",
      name,
      address,
      lat: geo?.lat ?? hunt.center_lat,
      lng: geo?.lng ?? hunt.center_lng,
      maps_url: buildSearchMapsUrl(name, address),
      category: "bar",
      edited: true,
    })
    .select("*").single();
  if (error) throw createError({ statusCode: 500, statusMessage: `Failed to add bar: ${error.message}` });

  return { bar: mapBar(data) };
});
