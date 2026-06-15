import {
  defineEventHandler,
  getRouterParam,
  getQuery,
  getHeader,
  setHeader,
  sendRedirect,
  createError,
} from "h3";
import { getUserIdFromToken, isHuntMember } from "../../utils/supabase";
import { createMediaSignedUrl } from "../../utils/storage";

/**
 * GET /api/media/<kind>/<huntId>/<file>  — private image proxy.
 *
 * The 'hunt-media' bucket is private, so images need authenticated access. But
 * an <img src> tag can't send an Authorization header, so the caller passes the
 * access token as a `?token=` query param instead (the same JWT useAuth holds).
 *
 * Flow: validate the token → confirm the user can see this hunt → 302-redirect
 * to a short-lived Supabase signed URL. The app-facing URL is STABLE and never
 * expires (we mint a fresh signed URL on every request), which fixes the old
 * "photos randomly disappear after a few hours" problem.
 *
 * This route is exempt from the global Bearer-header auth middleware (see
 * server/middleware/auth.ts) because it authenticates itself via the query token.
 */
export default defineEventHandler(async (event) => {
  // Catch-all param, e.g. "check-ins/<huntId>/<uuid>.jpg"
  const path = getRouterParam(event, "path") || "";
  const segments = path.split("/");
  if (segments.length < 3) {
    throw createError({ statusCode: 400, statusMessage: "Bad media path" });
  }
  const huntId = segments[1];

  // Token from ?token= (used by <img> tags) or an Authorization header (fallback).
  const query = getQuery(event);
  const headerToken = (getHeader(event, "authorization") || "").replace(/^Bearer\s+/i, "");
  const token = (typeof query.token === "string" ? query.token : "") || headerToken;

  const userId = await getUserIdFromToken(token);
  if (!userId) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }

  // Only people in this hunt may view its photos.
  if (!(await isHuntMember(huntId, userId))) {
    throw createError({ statusCode: 403, statusMessage: "Not a member of this hunt" });
  }

  const signedUrl = await createMediaSignedUrl(path, 3600);
  if (!signedUrl) {
    throw createError({ statusCode: 404, statusMessage: "Image not found" });
  }

  // Cache the redirect briefly; the image bytes themselves are cached by the
  // browser per Supabase's storage response headers.
  setHeader(event, "Cache-Control", "private, max-age=300");
  return sendRedirect(event, signedUrl, 302);
});
