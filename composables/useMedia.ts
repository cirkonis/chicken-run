/**
 * useMedia — builds the URL for a private hunt photo.
 *
 * Images live in a private bucket and are served by the /api/media proxy, which
 * needs the user's access token. Since <img> can't send an Authorization header,
 * the token rides in a query param. This is the single source of truth for that
 * URL shape; MediaImage.vue and the results timeline both use it.
 */
export function useMedia() {
  const auth = useAuth();

  /** Proxy URL for a storage path (e.g. "check-ins/<hunt>/<uuid>.jpg"), or null. */
  function mediaUrl(path?: string | null): string | null {
    if (!path) return null;
    const token = auth.state.accessToken || "";
    return `/api/media/${path}?token=${encodeURIComponent(token)}`;
  }

  return { mediaUrl };
}
