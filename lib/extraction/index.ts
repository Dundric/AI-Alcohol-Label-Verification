import OpenAI from "openai";
import { evaluateCandidates, runExtractionPasses } from "@/lib/extraction/engine";
import { countMissingFields } from "@/lib/extraction/heuristics";
import { mergeCandidates } from "@/lib/extraction/merger";
import { compressAndEncodeImage } from "@/lib/extraction/image-service";
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
 * Runs the shared extraction/evaluation pipeline once an image payload is available.
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
 * Steps: validate config, load bytes, compress + encode, run two
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
  const formImageResult = getImageFromFormData(formData);
  if (!formImageResult.ok) {
    return formImageResult.error;
  }

  // Expected data is optional; missing/invalid inputs only affect evaluation.
  const expectedData = parseExpectedData(formData.get("expected"), logger.warn);

  const imageBytesResult = await loadImageBytes(formImageResult.value);
  if (!imageBytesResult.ok) {
    return imageBytesResult.error;
  }

  const imageResult = await compressAndEncodeImage(
    imageBytesResult.value.buffer,
    imageBytesResult.value.mimeType,
    logger
  );
  if (!imageResult.ok) {
    return imageResult.error;
  }

  const imageLabel = formImageResult.value.name ?? undefined;
  return extractFromImageUrl(
    imageResult.value.imageUrl,
    expectedData,
    configResult.value,
    logger,
    imageLabel
  );
}

/**
 * Orchestrates extraction using a pre-encoded image data URL.
 */
export async function extractLabelFromImageDataUrl(
  imageDataUrl: string,
  expectedData: ExpectedAlcoholLabel | null,
  options: { logger?: Logger; imageName?: string } = {}
): Promise<ExtractLabelResult> {
  const configResult = validateConfig();
  if (!configResult.ok) {
    return configResult.error;
  }

  const logger = resolveLogger(options.logger);
  const imageLabel = options.imageName;
  return extractFromImageUrl(
    imageDataUrl,
    expectedData,
    configResult.value,
    logger,
    imageLabel
  );
}

export type { ExtractLabelError, ExtractLabelResult, ExtractLabelSuccess } from "@/lib/extraction/types";
