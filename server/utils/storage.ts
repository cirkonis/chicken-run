/**
 * Supabase Storage helpers for hunt photos (check-ins, hints, arrivals).
 *
 * The 'hunt-media' bucket is PRIVATE. Uploads go straight from the browser to
 * Storage via a one-time signed upload URL (createMediaUploadUrl); reads go
 * through the /api/media proxy, which mints a fresh signed URL per request
 * (createMediaSignedUrl). All operations here use the admin (service-role)
 * client, which bypasses storage RLS.
 */
import { randomUUID } from "node:crypto";

const BUCKET = "hunt-media";

/** The three kinds of hunt media, matching the storage folder names. */
export type MediaKind = "check-ins" | "hints" | "arrivals";

/** Build a unique storage path for a new upload, e.g. "check-ins/<huntId>/<uuid>.jpg". */
export function buildMediaPath(kind: MediaKind, huntId: string): string {
  return `${kind}/${huntId}/${randomUUID()}.jpg`;
}

/**
 * Create a one-time signed UPLOAD URL. The browser PUTs the image directly to
 * this URL, so the bytes never touch our server (and never hit Vercel's limit).
 */
export async function createMediaUploadUrl(
  path: string
): Promise<{ path: string; signedUrl: string; token: string }> {
  const admin = getAdminClient();
  const { data, error } = await admin.storage.from(BUCKET).createSignedUploadUrl(path);
  if (error || !data) {
    throw new Error(`Failed to create upload URL: ${error?.message}`);
  }
  return { path, signedUrl: data.signedUrl, token: data.token };
}

/**
 * Create a short-lived signed DOWNLOAD URL for the /api/media proxy to redirect
 * to. The 1-hour TTL doesn't matter to the app: the proxy regenerates it on
 * every request, so the app-facing /api/media URL effectively never expires.
 */
export async function createMediaSignedUrl(
  path: string,
  ttlSeconds = 3600
): Promise<string | null> {
  const admin = getAdminClient();
  const { data, error } = await admin.storage.from(BUCKET).createSignedUrl(path, ttlSeconds);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

/** Delete a single media file by its storage path (used when a hint/arrival is removed). */
export async function deleteMediaFile(path: string): Promise<void> {
  if (!path) return;
  const admin = getAdminClient();
  await admin.storage.from(BUCKET).remove([path]);
}

/**
 * Delete ALL media for the given hunt IDs (the check-ins/, hints/, arrivals/
 * folders). Called before deleting hunts so storage doesn't leak orphaned files.
 */
export async function deleteHuntMedia(huntIds: string[]): Promise<void> {
  if (!huntIds.length) return;
  const admin = getAdminClient();
  const folders = ["hints", "arrivals", "check-ins"];

  for (const huntId of huntIds) {
    for (const folder of folders) {
      const prefix = `${folder}/${huntId}`;
      const { data: files } = await admin.storage.from(BUCKET).list(prefix);
      if (files && files.length > 0) {
        const paths = files.map((f) => `${prefix}/${f.name}`);
        await admin.storage.from(BUCKET).remove(paths);
      }
    }
  }
}
