import {
  defineEventHandler,
  getRouterParam,
  createError,
  readMultipartFormData,
} from "h3";
import { getUserClient, getAdminClient } from "../../../../utils/supabase";
import {
  uploadHintImage,
  getSignedImageUrl,
  MAX_HUNT_STORAGE_BYTES,
} from "../../../../utils/storage";

// POST /api/hunts/:huntId/hints — add a hint (with optional image)
// Body: multipart/form-data with "text" field + optional "image" file
export default defineEventHandler(async (event) => {
  const userId = event.context.userId!;
  const huntId = getRouterParam(event, "huntId");
  const supabase = getUserClient(event);

  if (!huntId) {
    throw createError({ statusCode: 400, statusMessage: "Missing huntId" });
  }

  // ── Parse multipart form data ─────────────────────────
  const formData = await readMultipartFormData(event);
  if (!formData) {
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid request body",
    });
  }

  const textPart = formData.find((p) => p.name === "text");
  const imagePart = formData.find((p) => p.name === "image");
  const text = textPart?.data?.toString("utf-8")?.trim() || "";

  if (!text && !imagePart?.data) {
    throw createError({
      statusCode: 400,
      statusMessage: "Hint text or image is required",
    });
  }

  // ── Validate image + check storage quota ──────────────
  let imageSize = 0;
  let currentStorageUsed = 0;

  if (imagePart?.data) {
    imageSize = imagePart.data.length;

    if (imageSize > 2 * 1024 * 1024) {
      throw createError({
        statusCode: 413,
        statusMessage: "Image too large (max 2MB)",
      });
    }

    // Check hunt storage quota
    const admin = getAdminClient();
    const { data: huntRow } = await admin
      .from("hunts")
      .select("storage_used_bytes")
      .eq("id", huntId)
      .single();

    currentStorageUsed = huntRow?.storage_used_bytes ?? 0;

    if (currentStorageUsed + imageSize > MAX_HUNT_STORAGE_BYTES) {
      throw createError({
        statusCode: 413,
        statusMessage:
          "Hunt storage limit reached (50MB). Delete old hints to free space.",
      });
    }
  }

  // ── Insert hint row ───────────────────────────────────
  const { data, error } = await supabase
    .from("hints")
    .insert({
      hunt_id: huntId,
      author_id: userId,
      text: text || "(photo)",
    })
    .select("id, text, author_id, created_at")
    .single();

  if (error) {
    throw createError({
      statusCode: 500,
      statusMessage: `Failed to add hint: ${error.message}`,
    });
  }

  // ── Upload image if present ───────────────────────────
  let imageUrl: string | null = null;

  if (imagePart?.data) {
    try {
      const imagePath = await uploadHintImage(
        huntId,
        data.id,
        Buffer.from(imagePart.data),
        imagePart.type || "image/jpeg"
      );

      // Update hint with image_path + increment storage counter
      const admin = getAdminClient();
      await admin
        .from("hints")
        .update({ image_path: imagePath })
        .eq("id", data.id);

      await admin
        .from("hunts")
        .update({ storage_used_bytes: currentStorageUsed + imageSize })
        .eq("id", huntId);

      imageUrl = await getSignedImageUrl(imagePath);
    } catch (uploadErr: any) {
      // Hint still exists as text-only if upload fails
      console.error("Image upload failed:", uploadErr.message);
    }
  }

  return {
    hint: {
      id: data.id,
      text: data.text,
      authorId: data.author_id,
      createdAt: data.created_at,
      imageUrl,
    },
  };
});
