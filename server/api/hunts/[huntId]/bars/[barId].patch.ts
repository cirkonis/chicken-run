import { defineEventHandler, readBody, getRouterParam, createError } from "h3";
import { getAdminClient, isHuntMember } from "../../../../utils/supabase";
import { buildSearchMapsUrl, geocodeAddress } from "../../../../utils/places";

// PATCH /api/hunts/:huntId/bars/:barId
//   • { name?, address? } — fix a bar's details (host or a chicken only). We
//     geocode the new address for the map pin and rebuild the Maps link.
//   • { checkStatus } — any participant marks a bar visited / maybe-skip.
export default defineEventHandler(async (event) => {
  const userId = event.context.userId!;
  const huntId = getRouterParam(event, "huntId");
  const barId = getRouterParam(event, "barId");
  if (!huntId || !barId) {
    throw createError({ statusCode: 400, statusMessage: "Missing huntId or barId" });
  }

  const admin = getAdminClient();
  const body = await readBody<{ checkStatus?: string; name?: string; address?: string }>(event);

  // ── Edit details (name / address) — host or chicken ───
  if (body.name !== undefined || body.address !== undefined) {
    const [{ data: participant }, { data: hunt }] = await Promise.all([
      admin.from("hunt_participants").select("role").eq("hunt_id", huntId).eq("user_id", userId).maybeSingle(),
      admin.from("hunts").select("creator_id").eq("id", huntId).maybeSingle(),
    ]);
    if (hunt?.creator_id !== userId && participant?.role !== "chicken") {
      throw createError({ statusCode: 403, statusMessage: "Only the host or a chicken can edit bar details" });
    }

    const { data: existing } = await admin
      .from("hunt_bars").select("name, address, lat, lng").eq("id", barId).eq("hunt_id", huntId).maybeSingle();
    if (!existing) throw createError({ statusCode: 404, statusMessage: "Bar not found" });

    const name = (body.name ?? existing.name).trim() || existing.name;
    const address = (body.address ?? existing.address ?? "").trim();

    // Geocode the corrected address for an accurate pin (best-effort), and
    // rebuild the "Open in Maps" link so it points at the right place.
    const config = useRuntimeConfig();
    const geo = await geocodeAddress(`${name} ${address}`, config.googlePlacesApiKey);

    const { data, error } = await admin
      .from("hunt_bars")
      .update({
        name,
        address,
        lat: geo?.lat ?? existing.lat,
        lng: geo?.lng ?? existing.lng,
        maps_url: buildSearchMapsUrl(name, address),
        edited: true,
      })
      .eq("id", barId).eq("hunt_id", huntId)
      .select("*").single();
    if (error) throw createError({ statusCode: 500, statusMessage: `Failed to update bar: ${error.message}` });
    return { bar: mapBar(data) };
  }

  // ── Update check status — any participant ─────────────
  const validStatuses = ["unchecked", "checked", "not_checking"];
  if (!body?.checkStatus || !validStatuses.includes(body.checkStatus)) {
    throw createError({ statusCode: 400, statusMessage: `checkStatus must be one of: ${validStatuses.join(", ")}` });
  }
  if (!(await isHuntMember(huntId, userId))) {
    throw createError({ statusCode: 403, statusMessage: "You must be a hunt participant" });
  }

  const updateData: Record<string, unknown> = { check_status: body.checkStatus };
  if (body.checkStatus === "checked") {
    updateData.checked_by = userId;
    updateData.checked_at = new Date().toISOString();
  } else {
    updateData.checked_by = null;
    updateData.checked_at = null;
  }

  const { data, error } = await admin
    .from("hunt_bars").update(updateData).eq("id", barId).eq("hunt_id", huntId).select("*").single();
  if (error) {
    throw createError({ statusCode: error.code === "PGRST116" ? 404 : 500, statusMessage: `Failed to update bar: ${error.message}` });
  }
  return { bar: mapBar(data) };
});
