/**
 * Client-side image compression using Canvas.
 *
 * Design rule after the v1 disaster: **compression must NEVER block a check-in.**
 * Previously a failed canvas/toBlob (common with big iOS HEIC camera shots) threw,
 * which aborted the whole upload while the preview still showed — so people thought
 * they'd posted a photo that never saved. Now, if anything goes wrong we silently
 * fall back to uploading the original file. A slightly bigger upload always beats
 * a lost photo.
 *
 * We also fix EXIF rotation: createImageBitmap with imageOrientation "from-image"
 * bakes the orientation in, so portrait phone photos no longer come out sideways.
 */

const MAX_WIDTH = 1200;
const MAX_HEIGHT = 1200;
const JPEG_QUALITY = 0.7;

export function useImageCompression() {
  /**
   * Decode a file into something drawable. Prefers createImageBitmap (handles
   * EXIF orientation and is faster/lower-memory); falls back to an <img> element.
   */
  async function decode(file: File): Promise<ImageBitmap | HTMLImageElement> {
    if (typeof createImageBitmap === "function") {
      try {
        // @ts-expect-error — imageOrientation is valid but missing in some TS libs
        return await createImageBitmap(file, { imageOrientation: "from-image" });
      } catch {
        // fall through to the <img> path
      }
    }
    return await new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve(img);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("Image decode failed"));
      };
      img.src = url;
    });
  }

  /**
   * Resize + re-encode to JPEG. Returns a Blob on success, or the ORIGINAL file
   * if compression isn't possible — never throws.
   */
  async function compressImage(file: File): Promise<Blob> {
    try {
      const source = await decode(file);

      const srcW = (source as HTMLImageElement).naturalWidth || source.width;
      const srcH = (source as HTMLImageElement).naturalHeight || source.height;
      if (!srcW || !srcH) return file;

      let width = srcW;
      let height = srcH;
      if (width > MAX_WIDTH || height > MAX_HEIGHT) {
        const ratio = Math.min(MAX_WIDTH / width, MAX_HEIGHT / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return file; // no 2d context → upload original

      ctx.drawImage(source as CanvasImageSource, 0, 0, width, height);
      if ("close" in source) source.close(); // free ImageBitmap memory

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY)
      );

      // If toBlob failed, or compression somehow made it bigger, keep the original.
      if (!blob) return file;
      if (blob.size >= file.size && file.type === "image/jpeg") return file;
      return blob;
    } catch {
      // Decode/draw failed (e.g. exotic format) → upload the original untouched.
      return file;
    }
  }

  return { compressImage };
}
