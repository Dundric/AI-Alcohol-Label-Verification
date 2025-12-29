import { expectedAlcoholLabelSchema } from "@/lib/schemas";
import type { ExpectedAlcoholLabel } from "@/lib/schemas";
import type {
  BlobLike,
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
export function isBlobLike(value: unknown): value is BlobLike {
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
export function resolveLogger(logger?: Logger): LoggerFns {
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
export function validateConfig(): StepResult<OpenAIConfig> {
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const apiKey = process.env.AZURE_OPENAI_API_KEY;
  const deployment = process.env.AZURE_OPENAI_DEPLOYMENT;
  const deploymentsRaw = process.env.AZURE_OPENAI_DEPLOYMENTS;
  const deployments = deploymentsRaw
    ? deploymentsRaw
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean)
    : deployment
      ? [deployment]
      : [];

  if (!endpoint || !apiKey || deployments.length === 0) {
    return {
      ok: false,
      error: { ok: false, status: 500, error: "Missing Azure OpenAI configuration" },
    };
  }

  return { ok: true, value: { endpoint, apiKey, deployments } };
}

// Pull the image file out of multipart form data.
/**
 * Extracts the required image blob from multipart form data.
 */
export function getImageFromFormData(formData: FormDataLike): StepResult<BlobLike> {
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
export async function loadImageBytes(
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
export function parseExpectedData(
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
