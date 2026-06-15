/**
 * Supabase Storage helpers for hunt images (hints, arrivals, check-ins).
 * Uses the admin client (service role) to bypass storage RLS.
 */

import { randomUUID } from "node:crypto";

const BUCKET = "hunt-media";
const SIGNED_URL_TTL = 14400; // 4 hours

/** Max storage per hunt (50MB) */
export const MAX_HUNT_STORAGE_BYTES = 50 * 1024 * 1024;

/**
 * Upload a hint image to the private bucket.
 * Returns the storage path (e.g. "hints/{huntId}/{hintId}.jpg").
 */
export async function uploadHintImage(
  huntId: string,
  hintId: string,
  fileBuffer: Buffer,
  contentType: string
): Promise<string> {
  const admin = getAdminClient();
  const path = `hints/${huntId}/${hintId}.jpg`;

  const { error } = await admin.storage
    .from(BUCKET)
    .upload(path, fileBuffer, {
      contentType,
      upsert: false,
    });

  if (error) throw new Error(`Storage upload failed: ${error.message}`);
  return path;
}

/**
 * Generate a signed URL for a single image path.
 */
export async function getSignedImageUrl(
  imagePath: string
): Promise<string | null> {
  if (!imagePath) return null;

  const admin = getAdminClient();
  const { data, error } = await admin.storage
    .from(BUCKET)
    .createSignedUrl(imagePath, SIGNED_URL_TTL);

  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

/**
 * Batch-generate signed URLs for multiple image paths (single API call).
 * Returns a Map of path → signedUrl.
 */
export async function getSignedImageUrls(
  paths: string[]
): Promise<Map<string, string>> {
  if (!paths.length) return new Map();

  const admin = getAdminClient();
  const { data, error } = await admin.storage
    .from(BUCKET)
    .createSignedUrls(paths, SIGNED_URL_TTL);

  if (error || !data) {
    console.error("[storage] Failed to create signed URLs:", error?.message, "paths:", paths.length);
    return new Map();
  }

  const map = new Map<string, string>();
  data.forEach((item) => {
    if (item.signedUrl && item.path) {
      map.set(item.path, item.signedUrl);
    }
  });

  if (map.size < paths.length) {
    console.warn(`[storage] Only ${map.size}/${paths.length} signed URLs generated`);
  }

  return map;
}

/**
 * Upload an arrival image to the private bucket.
 * Returns the storage path (e.g. "arrivals/{huntId}/{arrivalId}.jpg").
 */
export async function uploadArrivalImage(
  huntId: string,
  arrivalId: string,
  fileBuffer: Buffer,
  contentType: string
): Promise<string> {
  const admin = getAdminClient();
  const path = `arrivals/${huntId}/${arrivalId}.jpg`;

  const { error } = await admin.storage
    .from(BUCKET)
    .upload(path, fileBuffer, {
      contentType,
      upsert: false,
    });

  if (error) throw new Error(`Storage upload failed: ${error.message}`);
  return path;
}

/**
 * Upload a check-in image to the private bucket.
 * Returns the storage path (e.g. "check-ins/{huntId}/{checkInId}.jpg").
 */
export async function uploadCheckInImage(
  huntId: string,
  checkInId: string,
  fileBuffer: Buffer,
  contentType: string
): Promise<string> {
  const admin = getAdminClient();
  const path = `check-ins/${huntId}/${checkInId}.jpg`;

  const { error } = await admin.storage
    .from(BUCKET)
    .upload(path, fileBuffer, {
      contentType,
      upsert: false,
    });

  if (error) throw new Error(`Storage upload failed: ${error.message}`);
  return path;
}

/**
 * Delete an image from storage.
 */
export async function deleteHintImage(imagePath: string): Promise<void> {
  if (!imagePath) return;
  const admin = getAdminClient();
  await admin.storage.from(BUCKET).remove([imagePath]);
}

/**
 * Delete all media files for the given hunt IDs from storage.
 * Removes files from hints/, arrivals/, and check-ins/ folders per hunt.
 * Must be called BEFORE deleting hunts (needs DB records to find file paths).
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

// ════════════════════════════════════════════════════════════════════════════
// NEW PHOTO PIPELINE — direct-to-storage uploads + stable private serving.
//
// Old approach (the upload*Image / getSignedImageUrl* helpers above, now being
// phased out): the browser sent image bytes to our server, we uploaded them, and
// we returned a 4-hour signed URL baked into the response. That dropped uploads
// (Vercel's request-body limit) and the URLs expired mid-hunt.
//
// New approach: the browser uploads straight to Storage via a signed upload URL
// (createMediaUploadUrl), and reads images back through the /api/media proxy,
// which mints a fresh signed URL on every request (createMediaSignedUrl).
// ════════════════════════════════════════════════════════════════════════════

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
 * to. The 1-hour TTL doesn't matter to the app: because the proxy regenerates
 * it on every request, the app-facing /api/media URL effectively never expires.
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
