import OpenAI from "openai";
import { createReadSasUrl } from "@/lib/azureBlob";
import { evaluateCandidates, runExtractionPasses } from "@/lib/extraction/engine";
import { countMissingFields } from "@/lib/extraction/heuristics";
import { mergeCandidates } from "@/lib/extraction/merger";
import { compressAndUploadImage } from "@/lib/extraction/image-service";
import {
  getImageFromFormData,
  loadImageBytes,
  parseExpectedData,
  resolveLogger,
  validateConfig,
} from "@/lib/extraction/utils";
import type { ExpectedAlcoholLabel } from "@/lib/schemas";
import type {
  ExtractLabelResult,
  FormDataLike,
  Logger,
  LoggerFns,
  OpenAIConfig,
} from "@/lib/extraction/types";

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
    const bestCandidate = evaluatedCandidates.reduce((best, candidate) => {
      const bestMissing = countMissingFields(best.extracted);
      const candidateMissing = countMissingFields(candidate.extracted);
      if (candidateMissing !== bestMissing) {
        return candidateMissing < bestMissing ? candidate : best;
      }
      return candidate.index < best.index ? candidate : best;
    });
    return { ok: true, label: bestCandidate.extracted, evaluation: null };
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
