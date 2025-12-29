import sharp from "sharp";
import type { LoggerFns, StepResult } from "@/lib/extraction/types";

// Fallback when a file has no MIME type.
const DEFAULT_MIME_TYPE = "image/jpeg";

// Compress the image (best effort) and encode it for model ingestion.
/**
 * Compresses the image when possible and returns a data URL
 * that can be sent directly to the model.
 */
export async function compressAndEncodeImage(
  buffer: Buffer,
  mimeType: string,
  logger: LoggerFns
): Promise<StepResult<{ imageUrl: string }>> {
  let uploadBuffer = buffer;
  let uploadContentType = mimeType;

  // Attempt compression to reduce size and improve OCR; fall back on failure.
  try {
    const pipeline = sharp(buffer);
    pipeline.resize({ width: 1600, withoutEnlargement: true });
    pipeline.rotate();
    pipeline.normalize();
    pipeline.sharpen();
    pipeline.jpeg({ quality: 70 });
    const compressed = await pipeline.toBuffer();
    uploadBuffer = Buffer.from(compressed);
    uploadContentType = DEFAULT_MIME_TYPE;
    logger.log("[extract-label] image bytes:", buffer.length);
    logger.log("[extract-label] preprocessed bytes:", compressed.length);
  } catch (compressionError) {
    logger.warn(
      "[extract-label] image compression failed, using original",
      compressionError
    );
    logger.log("[extract-label] image bytes:", buffer.length);
  }

  const imageUrl = `data:${uploadContentType};base64,${uploadBuffer.toString(
    "base64"
  )}`;
  return { ok: true, value: { imageUrl } };
}
