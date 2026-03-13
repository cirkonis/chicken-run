/**
 * Supabase Storage helpers for hunt images (hints, arrivals, check-ins).
 * Uses the admin client (service role) to bypass storage RLS.
 */

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

  if (error || !data) return new Map();

  const map = new Map<string, string>();
  data.forEach((item) => {
    if (item.signedUrl && item.path) {
      map.set(item.path, item.signedUrl);
    }
  });
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
