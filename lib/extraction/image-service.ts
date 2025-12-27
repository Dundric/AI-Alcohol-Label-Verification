import crypto from "crypto";
import sharp from "sharp";
import { uploadAndGetSasUrl } from "@/lib/azureBlob";
import type { LoggerFns, StepResult } from "@/lib/extraction/types";

// Fallback when a file has no MIME type.
const DEFAULT_MIME_TYPE = "image/jpeg";

// Compress the image (best effort) and upload to blob storage.
/**
 * Compresses the image when possible, uploads to blob storage,
 * and returns a SAS URL for model ingestion.
 */
export async function compressAndUploadImage(
  buffer: Buffer,
  mimeType: string,
  logger: LoggerFns
): Promise<StepResult<{ imageUrl: string }>> {
  let uploadBuffer = buffer;
  let uploadContentType = mimeType;

  // Attempt compression to reduce size and improve OCR; fall back on failure.
  try {
    const compressed = await sharp(buffer)
      .resize({ width: 1600, withoutEnlargement: true })
      .normalize()
      .sharpen()
      .jpeg({ quality: 70 })
      .toBuffer();
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

  const blobName = `labels/${crypto.randomUUID()}.jpg`;

  // Upload to blob storage so the model can fetch the image via SAS URL.
  try {
    const imageUrl = await uploadAndGetSasUrl({
      buffer: uploadBuffer,
      contentType: uploadContentType,
      blobName,
    });
    logger.log("[extract-label] SAS URL created");
    return { ok: true, value: { imageUrl } };
  } catch (uploadError) {
    logger.error("[extract-label] blob upload failed", uploadError);
    return {
      ok: false,
      error: { ok: false, status: 502, error: "Failed to upload image to storage" },
    };
  }
}
