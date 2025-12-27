import OpenAI from "openai";
import crypto from "crypto";
import sharp from "sharp";
import { createReadSasUrl, uploadAndGetSasUrl } from "@/lib/azureBlob";
import {
  expectedAlcoholLabelSchema,
  type AdditiveDisclosure,
  type AccuracyDecision,
  type ExtractedAlcoholLabel,
  type FieldAccuracy,
  type GovernmentWarningField,
  type SimpleField,
} from "@/lib/schemas";
import type { ExpectedAlcoholLabel } from "@/lib/schemas";
import { evaluateCandidates, runExtractionPasses } from "@/lib/extraction/engine";
import {
  isBetterCandidate,
  shouldCheckAdditives,
  shouldCheckAlcoholContent,
  shouldCheckCountryOfOrigin,
} from "@/lib/extraction/heuristics";
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

const FIELD_KEYS = [
  "brandName",
  "classType",
  "alcoholContent",
  "netContents",
  "governmentWarning",
  "bottlerProducer",
  "countryOfOrigin",
  "additivesDisclosed",
] as const;

type FieldKey = (typeof FIELD_KEYS)[number];

function getEvaluationFlags(expected: ExpectedAlcoholLabel) {
  return {
    includeAlcohol: shouldCheckAlcoholContent(expected),
    includeCountry: shouldCheckCountryOfOrigin(expected),
    includeAdditives: shouldCheckAdditives(expected),
  };
}

function buildDefaultFields(
  flags: ReturnType<typeof getEvaluationFlags>,
  defaultValue: 0 | 1
): FieldAccuracy {
  return {
    brandName: defaultValue,
    classType: defaultValue,
    alcoholContent: flags.includeAlcohol ? defaultValue : 1,
    netContents: defaultValue,
    governmentWarning: defaultValue,
    bottlerProducer: defaultValue,
    countryOfOrigin: flags.includeCountry ? defaultValue : 1,
    additivesDisclosed: flags.includeAdditives ? defaultValue : 1,
  };
}

function normalizeForSimilarity(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function levenshteinDistance(str1: string, str2: string): number {
  const len1 = str1.length;
  const len2 = str2.length;
  const matrix: number[][] = [];

  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  return matrix[len1][len2];
}

function similarityRatio(str1: string, str2: string): number {
  const distance = levenshteinDistance(str1, str2);
  const maxLength = Math.max(str1.length, str2.length);
  if (maxLength === 0) return 1;
  return 1 - distance / maxLength;
}

function getTextValue(
  value: SimpleField | GovernmentWarningField | null
): string {
  return value?.text ?? "";
}

function getExpectedValue(
  expected: ExpectedAlcoholLabel,
  key: FieldKey
): SimpleField | GovernmentWarningField | AdditiveDisclosure | null {
  switch (key) {
    case "brandName":
      return expected.brandName;
    case "classType":
      return expected.classType;
    case "alcoholContent":
      return expected.alcoholContent;
    case "netContents":
      return expected.netContents;
    case "governmentWarning":
      return expected.governmentWarning;
    case "bottlerProducer":
      return expected.bottlerProducer;
    case "countryOfOrigin":
      return expected.countryOfOrigin;
    case "additivesDisclosed":
      return expected.additivesDetected;
  }
}

function similarityScore(
  key: FieldKey,
  extracted: ExtractedAlcoholLabel[FieldKey],
  expected: SimpleField | GovernmentWarningField | AdditiveDisclosure | null
): number {
  if (!expected) return 0;

  if (key === "additivesDisclosed") {
    const expectedAdditives = expected as AdditiveDisclosure;
    const extractedAdditives = extracted as AdditiveDisclosure | null;
    if (!extractedAdditives) return 0;

    const keys = Object.keys(expectedAdditives) as Array<
      keyof AdditiveDisclosure
    >;
    const matches = keys.filter(
      (field) => expectedAdditives[field] === extractedAdditives[field]
    ).length;
    return matches / keys.length;
  }

  const expectedText = normalizeForSimilarity(
    getTextValue(expected as SimpleField | GovernmentWarningField | null)
  );
  const extractedText = normalizeForSimilarity(
    getTextValue(extracted as SimpleField | GovernmentWarningField | null)
  );

  if (!expectedText) return 0;
  return similarityRatio(extractedText, expectedText);
}

function selectBestCandidate(
  candidates: ExtractionCandidate[],
  expectedData: ExpectedAlcoholLabel | null
): ExtractionCandidate {
  return candidates.reduce((current, contender) =>
    isBetterCandidate(contender, current, expectedData) ? contender : current
  );
}

function selectContender(
  contenders: Array<{
    index: number;
    score: 0 | 1;
    similarity: number;
    hasValue: boolean;
  }>,
  requireAccurate: boolean
) {
  const pool = requireAccurate
    ? contenders.filter((contender) => contender.score === 1)
    : contenders;

  return pool.reduce((best, current) => {
    if (current.similarity !== best.similarity) {
      return current.similarity > best.similarity ? current : best;
    }
    if (current.hasValue !== best.hasValue) {
      return current.hasValue ? current : best;
    }
    return current.index < best.index ? current : best;
  });
}

function mergeCandidates(
  candidates: ExtractionCandidate[],
  expected: ExpectedAlcoholLabel,
  logger: LoggerFns
): { label: ExtractedAlcoholLabel; evaluation: AccuracyDecision } {
  const flags = getEvaluationFlags(expected);
  const fallbackFields = buildDefaultFields(flags, 0);
  const candidateFields = candidates.map(
    (candidate) => candidate.evaluation?.fields ?? fallbackFields
  );

  const mergedFields = buildDefaultFields(flags, 0);
  const mergedLabel: ExtractedAlcoholLabel = {
    brandName: null,
    classType: null,
    alcoholContent: null,
    netContents: null,
    governmentWarning: null,
    bottlerProducer: null,
    countryOfOrigin: null,
    additivesDisclosed: null,
  };

  FIELD_KEYS.forEach((key) => {
    const expectedValue = getExpectedValue(expected, key);
    const contenders = candidates.map((candidate, index) => {
      const value = candidate.extracted[key];
      return {
        index,
        score: candidateFields[index][key],
        similarity: similarityScore(key, value, expectedValue),
        hasValue: value !== null && value !== undefined,
      };
    });

    const hasAccurate = contenders.some((contender) => contender.score === 1);
    const best = selectContender(contenders, hasAccurate);
    const selected = candidates[best.index].extracted;
    switch (key) {
      case "brandName":
        mergedLabel.brandName = selected.brandName;
        break;
      case "classType":
        mergedLabel.classType = selected.classType;
        break;
      case "alcoholContent":
        mergedLabel.alcoholContent = selected.alcoholContent;
        break;
      case "netContents":
        mergedLabel.netContents = selected.netContents;
        break;
      case "governmentWarning":
        mergedLabel.governmentWarning = selected.governmentWarning;
        break;
      case "bottlerProducer":
        mergedLabel.bottlerProducer = selected.bottlerProducer;
        break;
      case "countryOfOrigin":
        mergedLabel.countryOfOrigin = selected.countryOfOrigin;
        break;
      case "additivesDisclosed":
        mergedLabel.additivesDisclosed = selected.additivesDisclosed;
        break;
    }
    mergedFields[key] = hasAccurate ? 1 : 0;
  });

  const passed = Object.values(mergedFields).every((value) => value === 1);
  logger.log("[extract-label] merged evaluation", mergedFields, { passed });

  return {
    label: mergedLabel,
    evaluation: { fields: mergedFields, passed },
  };
}

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

/**
 * Runs the shared extraction/evaluation pipeline once an image URL is available.
 */
async function extractFromImageUrl(
  imageUrl: string,
  expectedData: ExpectedAlcoholLabel | null,
  config: OpenAIConfig,
  logger: LoggerFns,
  imageLabel?: string
): Promise<ExtractLabelResult> {
  // Initialize OpenAI client for extraction and evaluation calls.
  const client = new OpenAI({
    apiKey: config.apiKey,
    baseURL: config.endpoint,
  });

  const extractionResult = await runExtractionPasses(
    client,
    config.deployment,
    imageUrl,
    logger
  );
  if (!extractionResult.ok) {
    return extractionResult.error;
  }

  const evaluatedCandidates = await evaluateCandidates(
    client,
    config.deployment,
    expectedData,
    extractionResult.value
  );

  if (expectedData) {
    const labelSuffix = imageLabel ? ` (${imageLabel})` : "";
    evaluatedCandidates.forEach((candidate) => {
      logger.log(
        `[extract-label] evaluation attempt ${candidate.index + 1}${labelSuffix}`,
        candidate.evaluation ?? null
      );
    });
  }

  if (!expectedData) {
    const bestCandidate = selectBestCandidate(evaluatedCandidates, expectedData);
    return {
      ok: true,
      label: bestCandidate.extracted,
      evaluation: bestCandidate.evaluation,
    };
  }

  const merged = mergeCandidates(evaluatedCandidates, expectedData, logger);
  return { ok: true, label: merged.label, evaluation: merged.evaluation };
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

  const imageLabel = imageResult.value.name ?? undefined;
  return extractFromImageUrl(
    uploadResult.value.imageUrl,
    expectedData,
    configResult.value,
    logger,
    imageLabel
  );
}

/**
 * Orchestrates extraction using an existing blob name already in storage.
 * This keeps the API payload small while reusing the same extraction engine.
 */
export async function extractLabelFromBlobName(
  blobName: string,
  expectedData: ExpectedAlcoholLabel | null,
  options: { logger?: Logger; imageName?: string } = {}
): Promise<ExtractLabelResult> {
  const configResult = validateConfig();
  if (!configResult.ok) {
    return configResult.error;
  }

  const logger = resolveLogger(options.logger);
  const imageLabel = options.imageName ?? blobName;

  try {
    const { readUrl } = await createReadSasUrl({ blobName });
    return extractFromImageUrl(
      readUrl,
      expectedData,
      configResult.value,
      logger,
      imageLabel
    );
  } catch (error) {
    logger.error("[extract-label] failed to create read SAS", error);
    return {
      ok: false,
      status: 502,
      error: "Failed to create read URL for image",
    };
  }
}

export type { ExtractLabelError, ExtractLabelResult, ExtractLabelSuccess } from "@/lib/extraction/types";
