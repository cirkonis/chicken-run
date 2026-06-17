import { defineEventHandler, getRouterParam, readBody, createError } from "h3";
import { getAdminClient, isHuntMember } from "../../../../utils/supabase";

// POST /api/hunts/:huntId/hints — add a hint (with optional photo).
//
// New flow: the photo (if any) is ALREADY in Storage — the client uploaded it
// directly via /api/media/upload-url — so this endpoint just takes JSON and
// stores the path. No multipart, no byte streaming.
// Body JSON: { text?: string, imagePath?: string }
export default defineEventHandler(async (event) => {
  const userId = event.context.userId!;
  const huntId = getRouterParam(event, "huntId");
  if (!huntId) throw createError({ statusCode: 400, statusMessage: "Missing huntId" });

  // Any participant (or the creator) may post hints. We check membership and use
  // the admin client so an expiring guest token can't trip RLS mid-hunt.
  if (!(await isHuntMember(huntId, userId))) {
    throw createError({ statusCode: 403, statusMessage: "You must be a hunt participant to add hints" });
  }

  const admin = getAdminClient();
  const body = await readBody<{ text?: string; imagePath?: string }>(event);
  const text = (body?.text || "").trim();
  const imagePath = body?.imagePath?.trim() || null;

  if (!text && !imagePath) {
    throw createError({ statusCode: 400, statusMessage: "Hint text or image is required" });
  }
  // Make sure a supplied path belongs to this hunt's hints folder.
  if (imagePath && !imagePath.startsWith(`hints/${huntId}/`)) {
    throw createError({ statusCode: 400, statusMessage: "Invalid image path" });
  }

  const { data, error } = await admin
    .from("hints")
    .insert({
      hunt_id: huntId,
      author_id: userId,
      text: text || "(photo)",
      image_path: imagePath,
    })
    .select("id, text, author_id, created_at, image_path")
    .single();

  if (error) {
    throw createError({ statusCode: 500, statusMessage: `Failed to add hint: ${error.message}` });
  }

  return { hint: mapHint(data) }; // mapHint includes imagePath
});
