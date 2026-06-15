import { defineEventHandler, readBody, createError } from "h3";
import { isHuntMember } from "../../utils/supabase";
import { buildMediaPath, createMediaUploadUrl, type MediaKind } from "../../utils/storage";

const VALID_KINDS: MediaKind[] = ["check-ins", "hints", "arrivals"];

/**
 * POST /api/media/upload-url  — mint a one-time signed upload URL.
 * Body: { huntId, kind }  (kind ∈ check-ins | hints | arrivals)
 *
 * This is the first step of the new upload flow: the browser asks us for a
 * place to put a photo, then PUTs the bytes straight to Supabase Storage using
 * the returned URL. The image bytes never pass through this server — which is
 * what avoids Vercel's 4.5 MB function body limit that was silently dropping
 * uploads before.
 *
 * Auth: the normal Bearer-header middleware runs for this POST (it's only the
 * GET proxy that's exempt), so event.context.userId is already set.
 */
export default defineEventHandler(async (event) => {
  const userId = event.context.userId!;
  const { huntId, kind } = await readBody<{ huntId?: string; kind?: MediaKind }>(event);

  if (!huntId || !kind || !VALID_KINDS.includes(kind)) {
    throw createError({
      statusCode: 400,
      statusMessage: "huntId and a valid kind (check-ins | hints | arrivals) are required",
    });
  }

  // Only participants/creator of this hunt may upload to it.
  if (!(await isHuntMember(huntId, userId))) {
    throw createError({
      statusCode: 403,
      statusMessage: "You must be a hunt participant to upload",
    });
  }

  const path = buildMediaPath(kind, huntId);
  const { signedUrl, token } = await createMediaUploadUrl(path);

  // The client uploads to signedUrl, then sends `path` back with the check-in /
  // hint / arrival so we can store it in image_path.
  return { path, signedUrl, token };
});
