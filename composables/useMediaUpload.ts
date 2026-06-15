/**
 * useMediaUpload — the new client-side photo upload flow.
 *
 * One call does the whole dance, so check-ins / hints / arrivals can all share it:
 *   1. Compress the image (never throws — falls back to the original).
 *   2. Ask our server for a one-time signed upload URL (/api/media/upload-url).
 *   3. PUT the bytes STRAIGHT to Supabase Storage — they never pass through our
 *      server, which is what dodges Vercel's request-body limit that silently
 *      dropped uploads in v1.
 *   4. Return the storage path. The caller saves it on the check-in/hint/arrival.
 */
export function useMediaUpload() {
  const auth = useAuth();
  const { compressImage } = useImageCompression();
  const { uploadToSignedUrl } = useSupabaseClient();

  type MediaKind = "check-ins" | "hints" | "arrivals";

  async function uploadImage(huntId: string, kind: MediaKind, file: File): Promise<string> {
    // 1. Compress (robust — worst case this is the original file).
    const blob = await compressImage(file);

    // 2. Get a place to put it.
    const { path, token } = await auth.authFetch<{
      path: string;
      signedUrl: string;
      token: string;
    }>("/api/media/upload-url", {
      method: "POST",
      body: { huntId, kind },
    });

    // 3. Upload directly to Storage.
    await uploadToSignedUrl(path, token, blob);

    // 4. Hand back the path for the caller to persist.
    return path;
  }

  return { uploadImage };
}
