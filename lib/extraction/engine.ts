import OpenAI from "openai";
import type { ResponseInputMessageContentList } from "openai/resources/responses/responses";
import { zodTextFormat } from "openai/helpers/zod";
import { fieldAccuracySchema, extractedAlcoholLabelSchema } from "@/lib/schemas";
import type {
  AccuracyDecision,
  ExtractedAlcoholLabel,
  ExpectedAlcoholLabel,
  FieldAccuracy,
} from "@/lib/schemas";
import {
  applyEvaluationOverrides,
  buildDecision,
  getEvaluationFlags,
} from "@/lib/extraction/heuristics";
import {
  evaluationInstructions,
  extractionPrompt,
  systemPrompt,
} from "@/lib/extraction/prompts";
import type { ExtractionCandidate, LoggerFns, StepResult } from "@/lib/extraction/types";

function isRateLimitError(error: unknown): boolean {
  const anyError = error as {
    status?: number;
    code?: string;
    type?: string;
    message?: string;
    error?: { status?: number; code?: string; type?: string; message?: string };
  };
  const status = anyError?.status ?? anyError?.error?.status;
  const code = anyError?.code ?? anyError?.error?.code ?? anyError?.type ?? anyError?.error?.type;
  const message = anyError?.message ?? anyError?.error?.message ?? "";
  return (
    status === 429 ||
    code === "rate_limit_exceeded" ||
    code === "too_many_requests" ||
    code === "insufficient_quota" ||
    /rate limit/i.test(message)
  );
}

function getErrorStatus(error: unknown, fallback: number): number {
  const anyError = error as { status?: number; error?: { status?: number } };
  const status = anyError?.status ?? anyError?.error?.status;
  if (typeof status === "number") {
    return status;
  }
  return isRateLimitError(error) ? 429 : fallback;
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  const anyError = error as { error?: { message?: string } };
  return anyError?.error?.message ?? fallback;
}

const RATE_LIMIT_RETRIES = 4;
const RATE_LIMIT_INITIAL_DELAY_MS = 2000;
const RATE_LIMIT_MAX_DELAY_MS = 15000;

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

async function callWithModelFallback<T>(
  deployments: string[],
  log: LoggerFns["log"],
  label: string,
  runner: (deployment: string) => Promise<T>
): Promise<T> {
  let attempt = 0;
  let delayMs = RATE_LIMIT_INITIAL_DELAY_MS;

  while (attempt <= RATE_LIMIT_RETRIES) {
    let sawRateLimit = false;
    for (const deployment of deployments) {
      try {
        if (deployment !== deployments[0]) {
          log(`[extract-label] ${label} trying fallback model ${deployment}`);
        }
        return await runner(deployment);
      } catch (error) {
        if (isRateLimitError(error)) {
          sawRateLimit = true;
          log(`[extract-label] ${label} rate limited on ${deployment}`);
          continue;
        }
        throw error;
      }
    }

    if (!sawRateLimit || attempt === RATE_LIMIT_RETRIES) {
      break;
    }

    log(
      `[extract-label] ${label} rate limited on all models, waiting ${delayMs}ms before retry`
    );
    await sleep(delayMs);
    attempt += 1;
    delayMs = Math.min(delayMs * 2, RATE_LIMIT_MAX_DELAY_MS);
  }

  const waitError = new Error(
    "All models are at capacity. Please wait and try again."
  );
  (waitError as { status?: number }).status = 429;
  throw waitError;
}


//This files extracts the alochol label from the image using Azure OpenAI. We run two extraction passes in parallel to reduce variance. We then evaluate each extraction against expected data and return the evaluation results as an array of candidates.

// Run a single extraction pass and return the parsed label, if any.
/**
 * Executes a single extraction call to Azure OpenAI and parses the result.
 * Returns null if the response fails schema parsing.
 */
export async function runExtractionPass(
  client: OpenAI,
  deployments: string[],
  imageUrl: string,
  log: LoggerFns["log"],
  attempt: number
): Promise<ExtractedAlcoholLabel | null> {
  const start = performance.now();
  // Send both instruction text and the image URL to the model.
  const content: ResponseInputMessageContentList = [
    { type: "input_text", text: extractionPrompt },
  ];
  content.push({ type: "input_image", image_url: imageUrl, detail: "high" });

  // Parse directly into the expected schema so downstream code can trust types.
  const response = await callWithModelFallback(
    deployments,
    log,
    `attempt ${attempt}`,
    async (deployment) => {
      try {
        return await client.responses.parse({
          model: deployment,
          input: [
            { role: "system", content: systemPrompt },
            { role: "user", content },
          ],
          text: { format: zodTextFormat(extractedAlcoholLabelSchema, "label") },
        });
      } catch (error: any) {
        const code =
          error?.code ??
          error?.error?.code ??
          error?.error?.type ??
          error?.type ??
          "";
        if (code === "content_policy_violation") {
          log(
            `[extract-label] ${`attempt ${attempt}`} content policy violation, retrying once`
          );
          await new Promise((resolve) => setTimeout(resolve, 300));
          return await client.responses.parse({
            model: deployment,
            input: [
              { role: "system", content: systemPrompt },
              { role: "user", content },
            ],
            text: { format: zodTextFormat(extractedAlcoholLabelSchema, "label") },
          });
        }
        throw error;
      }
    }
  );

  const durationMs = Math.round(performance.now() - start);
  const attemptLabel = `attempt ${attempt}`;
  log(`[extract-label] ${attemptLabel} openai call duration (ms):`, durationMs);

  if (response.usage) {
    log(`[extract-label] ${attemptLabel} token usage:`, {
      input_tokens: response.usage.input_tokens,
      output_tokens: response.usage.output_tokens,
      total_tokens: response.usage.total_tokens,
    });
  } else {
    log(`[extract-label] ${attemptLabel} token usage not returned`);
  }

  log(`[extract-label] ${attemptLabel} raw output text`, response.output_text);
  log(`[extract-label] ${attemptLabel} parsed output`, response.output_parsed);

  return response.output_parsed
    ? (response.output_parsed as ExtractedAlcoholLabel)
    : null;
}

// Run three extraction passes in parallel and keep only valid candidates.
/**
 * Runs three extraction passes in parallel and returns only valid candidates.
 * Emits errors when both passes fail or return no parsed data.
 */
export async function runExtractionPasses(
  client: OpenAI,
  deployments: string[],
  imageUrl: string,
  logger: LoggerFns
): Promise<StepResult<ExtractionCandidate[]>> {
  // Run three passes to reduce variance and pick the best result.
  logger.log("[extract-label] running parallel extractions");
  let extractionResults: Array<ExtractedAlcoholLabel | null>;
  try {
    extractionResults = await Promise.all([
      runExtractionPass(client, deployments, imageUrl, logger.log, 1),
      runExtractionPass(client, deployments, imageUrl, logger.log, 2)
    ]);
  } catch (error) {
    return {
      ok: false,
      error: {
        ok: false,
        status: getErrorStatus(error, 502),
        error: getErrorMessage(
          error,
          "Extraction failed. Please wait and try again."
        ),
      },
    };
  }

  // Filter out any responses that failed schema parsing.
  const candidates: ExtractionCandidate[] = [];
  extractionResults.forEach((parsed, index) => {
    if (!parsed) {
      logger.warn(
        `[extract-label] extraction candidate ${index + 1} returned no data`
      );
      return;
    }
    candidates.push({ extracted: parsed, evaluation: null, index });
  });

  if (candidates.length === 0) {
    return { ok: false, error: { ok: false, status: 502, error: "No label data extracted" } };
  }

  return { ok: true, value: candidates };
}

// Evaluate a single extraction against expected data.
/**
 * The evaluation chooses which fields to compare based on the expected data provided. 
 * For instance, if a bottle of wine is imported we make sure to check the countryOfOrigin field, 
 * but if it's domestic we skip that field.
 * We evaluate one extraction against expected label data and return an evaluation object.  
 * If the value extracted from a label for a specific field is considered valid, it gets a score of 1; otherwise, 0.
 * We then return the object of field accuracies for all fields.
 * 
 */
export async function runEvaluationPass(
  client: OpenAI, 
  deployments: string[],
  expectedData: ExpectedAlcoholLabel,
  extracted: ExtractedAlcoholLabel
): Promise<AccuracyDecision | null> {
  // Only compare optional fields when the expected data says they matter.
  const flags = getEvaluationFlags(expectedData);
  const evaluationExpected = {
    brandName: expectedData.brandName,
    classType: expectedData.classType,
    netContents: expectedData.netContents,
    governmentWarning: expectedData.governmentWarning,
    bottlerProducer: expectedData.bottlerProducer,
    alcoholContent: flags.includeAlcohol ? expectedData.alcoholContent : null,
    countryOfOrigin: flags.includeCountry ? expectedData.countryOfOrigin : null,
    additivesDisclosed: flags.includeAdditives ? expectedData.additivesDetected : null,
  };

  const evaluationExtracted = {
    brandName: extracted.brandName,
    classType: extracted.classType,
    netContents: extracted.netContents,
    governmentWarning: extracted.governmentWarning,
    bottlerProducer: extracted.bottlerProducer,
    alcoholContent: flags.includeAlcohol ? extracted.alcoholContent : null,
    countryOfOrigin: flags.includeCountry ? extracted.countryOfOrigin : null,
    additivesDisclosed: flags.includeAdditives ? extracted.additivesDisclosed : null,
  };

  const evalResponse = await callWithModelFallback(
    deployments,
    console.log,
    "evaluation",
    (deployment) =>
      client.responses.parse({
        model: deployment,
        input: [
          {
            role: "system",
            content:
              "Compare expected vs extracted label data and decide if the extraction is accurate. Allow differences in wording or formattting.",
          },
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text:
                  evaluationInstructions +
                  "Expected:\n" +
                  JSON.stringify(evaluationExpected) +
                  "\n\nExtracted:\n" +
                  JSON.stringify(evaluationExtracted),
              },
            ],
          },
        ],
        text: { format: zodTextFormat(fieldAccuracySchema, "evaluation") },
      })
  );

  if (!evalResponse.output_parsed) {
    return null;
  }

  const adjusted = applyEvaluationOverrides(
    evalResponse.output_parsed as FieldAccuracy,
    flags
  );
  return buildDecision(adjusted);
}

// Evaluate each candidate when expected data exists.
/**
 * Runs evaluation for each candidate in parallel when expected data is provided.
 */
export async function evaluateCandidates(
  client: OpenAI,
  deployments: string[],
  expectedData: ExpectedAlcoholLabel | null,
  candidates: ExtractionCandidate[]
): Promise<ExtractionCandidate[]> {
  if (!expectedData) {
    return candidates;
  }

  const evaluations = await Promise.all(
    candidates.map((candidate) =>
      runEvaluationPass(client, deployments, expectedData, candidate.extracted)
    )
  );

  evaluations.forEach((evaluation, index) => {
    candidates[index].evaluation = evaluation;
  });

  return candidates;
}
