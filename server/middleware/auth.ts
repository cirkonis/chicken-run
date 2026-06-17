/**
 * Server middleware: authenticates all /api/** requests except public routes.
 * Sets event.context.userId for downstream handlers.
 */
import { getUserClient } from "../utils/supabase";

const PUBLIC_ROUTES = [
  "/api/auth/refresh",
  "/api/hunts/join-guest",
  "/api/hunts/validate-code",
  "/api/bars/search",
  // DEV-ONLY host sign-in (the handler itself 403s outside `nuxt dev`).
  "/api/dev/login",
];

export default defineEventHandler(async (event) => {
  const path = getRequestURL(event).pathname;

  // Only apply to API routes
  if (!path.startsWith("/api/")) return;

  // Skip public routes
  if (PUBLIC_ROUTES.includes(path)) return;

  // The media proxy (GET /api/media/<path>) authenticates itself via a ?token=
  // query param, because <img> tags can't send an Authorization header. The
  // POST /api/media/upload-url still goes through normal Bearer auth below.
  if (event.method === "GET" && path.startsWith("/api/media/")) return;

  // Validate JWT and extract user
  const client = getUserClient(event);
  const {
    data: { user },
    error,
  } = await client.auth.getUser();

  if (error || !user) {
    throw createError({
      statusCode: 401,
      statusMessage: "Unauthorized -- please sign in",
    });
  }

  event.context.userId = user.id;
});
