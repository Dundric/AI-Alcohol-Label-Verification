import OpenAI from "openai";
import crypto from "crypto";
import sharp from "sharp";
import { uploadAndGetSasUrl } from "@/lib/azureBlob";
import { expectedAlcoholLabelSchema } from "@/lib/schemas";
import type { ExpectedAlcoholLabel } from "@/lib/schemas";
import { evaluateCandidates, runExtractionPasses } from "@/lib/extraction/engine";
import { isBetterCandidate } from "@/lib/extraction/heuristics";
import type {
  BlobLike,
  ExtractLabelResult,
  ExtractionCandidate,
  FormDataLike,
  Logger,
  LoggerFns,
  OpenAIConfig,
  StepResult,
} from "@/lib/extraction/types";

// Fallback when a file has no MIME type.
const DEFAULT_MIME_TYPE = "image/jpeg";

// Type guard that works for browser File and undici File/Blob.
/**
 * Type guard for values that behave like a Blob/File (have arrayBuffer).
 */
function isBlobLike(value: unknown): value is BlobLike {
  return (
    !!value &&
    typeof value === "object" &&
    "arrayBuffer" in value &&
    typeof (value as BlobLike).arrayBuffer === "function"
  );
}

// Normalize logger methods so downstream code always has log/warn/error.
/**
 * Normalizes optional logger methods so downstream code can always log.
 */
function resolveLogger(logger?: Logger): LoggerFns {
  const log = logger?.log ?? console.log;
  return {
    log,
    warn: logger?.warn ?? logger?.log ?? console.warn,
    error: logger?.error ?? logger?.log ?? console.error,
  };
}

// Validate required Azure OpenAI configuration.
/**
 * Validates that the Azure OpenAI config is present in environment variables.
 */
function validateConfig(): StepResult<OpenAIConfig> {
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const apiKey = process.env.AZURE_OPENAI_API_KEY;
  const deployment = process.env.AZURE_OPENAI_DEPLOYMENT;

  if (!endpoint || !apiKey || !deployment) {
    return {
      ok: false,
      error: { ok: false, status: 500, error: "Missing Azure OpenAI configuration" },
    };
  }

  return { ok: true, value: { endpoint, apiKey, deployment } };
}

// Pull the image file out of multipart form data.
/**
 * Extracts the required image blob from multipart form data.
 */
function getImageFromFormData(formData: FormDataLike): StepResult<BlobLike> {
  const image = formData.get("image");
  if (!isBlobLike(image)) {
    return { ok: false, error: { ok: false, status: 400, error: "Image file is required" } };
  }

  return { ok: true, value: image };
}

// Load the image into a Buffer for processing.
/**
 * Reads the image into memory and returns its bytes and MIME type.
 */
async function loadImageBytes(
  image: BlobLike
): Promise<StepResult<{ buffer: Buffer; mimeType: string }>> {
  const buffer = Buffer.from(await image.arrayBuffer());
  const mimeType = image.type && image.type.length > 0 ? image.type : DEFAULT_MIME_TYPE;
  return { ok: true, value: { buffer, mimeType } };
}

/**
 * Parses the optional "expected" JSON payload into a validated schema object.
 * Returns null for missing, malformed, or invalid data.
 */
function parseExpectedData(
  expectedRaw: unknown,
  warn: LoggerFns["warn"]
): ExpectedAlcoholLabel | null {
  // Expected data is passed as JSON in a multipart field.
  if (typeof expectedRaw !== "string") {
    return null;
  }

  try {
    const parsed = expectedAlcoholLabelSchema.safeParse(JSON.parse(expectedRaw));
    if (parsed.success) {
      return parsed.data;
    }
    warn("[extract-label] expected data failed validation", parsed.error.issues);
  } catch (parseError) {
    warn("[extract-label] expected data parse failed", parseError);
  }

  return null;
}

// Compress the image (best effort) and upload to blob storage.
/**
 * Compresses the image when possible, uploads to blob storage,
 * and returns a SAS URL for model ingestion.
 */
async function compressAndUploadImage(
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

// Select the strongest candidate based on accuracy and completeness.
/**
 * Selects the best candidate using accuracy, mismatches, and completeness.
 */
function selectBestCandidate(
  candidates: ExtractionCandidate[],
  expectedData: ExpectedAlcoholLabel | null
): ExtractionCandidate {
  return candidates.reduce((current, contender) =>
    isBetterCandidate(contender, current, expectedData) ? contender : current
  );
}

/**
 * Orchestrates the full extraction pipeline from multipart form data.
 * Expects a required "image" file and an optional "expected" JSON string.
 * Steps: validate config, load bytes, compress + upload, run two
 * extraction passes, evaluate, then select the best candidate.
 */
export async function extractLabelFromFormData(
  formData: FormDataLike,
  options: { logger?: Logger } = {}
): Promise<ExtractLabelResult> {
  const configResult = validateConfig();
  if (!configResult.ok) {
    return configResult.error;
  }

  const logger = resolveLogger(options.logger);
  const imageResult = getImageFromFormData(formData);
  if (!imageResult.ok) {
    return imageResult.error;
  }

  // Expected data is optional; missing/invalid inputs only affect evaluation.
  const expectedData = parseExpectedData(formData.get("expected"), logger.warn);

  const imageBytesResult = await loadImageBytes(imageResult.value);
  if (!imageBytesResult.ok) {
    return imageBytesResult.error;
  }

  const uploadResult = await compressAndUploadImage(
    imageBytesResult.value.buffer,
    imageBytesResult.value.mimeType,
    logger
  );
  if (!uploadResult.ok) {
    return uploadResult.error;
  }

  // Initialize OpenAI client for extraction and evaluation calls.
  const client = new OpenAI({
    apiKey: configResult.value.apiKey,
    baseURL: configResult.value.endpoint,
  });

  const extractionResult = await runExtractionPasses(
    client,
    configResult.value.deployment,
    uploadResult.value.imageUrl,
    logger
  );
  if (!extractionResult.ok) {
    return extractionResult.error;
  }

  const evaluatedCandidates = await evaluateCandidates(
    client,
    configResult.value.deployment,
    expectedData,
    extractionResult.value
  );

  const bestCandidate = selectBestCandidate(evaluatedCandidates, expectedData);

  return {
    ok: true,
    label: bestCandidate.extracted,
    evaluation: bestCandidate.evaluation,
  };
}

export type { ExtractLabelError, ExtractLabelResult, ExtractLabelSuccess } from "@/lib/extraction/types";
