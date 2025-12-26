import OpenAI from "openai";
import type { ResponseInputMessageContentList } from "openai/resources/responses/responses";
import { zodTextFormat } from "openai/helpers/zod";
import {
  accuracyDecisionSchema,
  extractedAlcoholLabelSchema,
} from "@/lib/schemas";
import type {
  AccuracyDecision,
  ExtractedAlcoholLabel,
  ExpectedAlcoholLabel,
} from "@/lib/schemas";
import {
  shouldCheckAdditives,
  shouldCheckAlcoholContent,
  shouldCheckCountryOfOrigin,
} from "@/lib/extraction/heuristics";
import {
  evaluationInstructions,
  extractionPrompt,
  systemPrompt,
} from "@/lib/extraction/prompts";
import type { ExtractionCandidate, LoggerFns, StepResult } from "@/lib/extraction/types";

// Determine which optional fields should be included in evaluation.
/**
 * Computes which optional fields should be included when evaluating accuracy.
 */
function getEvaluationFlags(expected: ExpectedAlcoholLabel) {
  return {
    includeAlcohol: shouldCheckAlcoholContent(expected),
    includeCountry: shouldCheckCountryOfOrigin(expected),
    includeAdditives: shouldCheckAdditives(expected),
  };
}

// Run a single extraction pass and return the parsed label, if any.
/**
 * Executes a single extraction call to Azure OpenAI and parses the result.
 * Returns null if the response fails schema parsing.
 */
export async function runExtractionPass(
  client: OpenAI,
  deployment: string,
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
  const response = await client.responses.parse({
    model: deployment,
    input: [
      { role: "system", content: systemPrompt },
      { role: "user", content },
    ],
    text: { format: zodTextFormat(extractedAlcoholLabelSchema, "label") },
  });

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

// Run two extraction passes in parallel and keep only valid candidates.
/**
 * Runs two extraction passes in parallel and returns only valid candidates.
 * Emits errors when both passes fail or return no parsed data.
 */
export async function runExtractionPasses(
  client: OpenAI,
  deployment: string,
  imageUrl: string,
  logger: LoggerFns
): Promise<StepResult<ExtractionCandidate[]>> {
  // Run two passes to reduce variance and pick the best result.
  logger.log("[extract-label] running parallel extractions");
  const extractionResults = await Promise.all([
    runExtractionPass(client, deployment, imageUrl, logger.log, 1),
    runExtractionPass(client, deployment, imageUrl, logger.log, 2)
  ]);

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
 * Evaluates one extraction against expected label data and returns accuracy info.
 */
export async function runEvaluationPass(
  client: OpenAI,
  deployment: string,
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
    ...(flags.includeAlcohol ? { alcoholContent: expectedData.alcoholContent } : {}),
    ...(flags.includeCountry ? { countryOfOrigin: expectedData.countryOfOrigin } : {}),
    ...(flags.includeAdditives
      ? { additivesDisclosed: expectedData.additivesDetected }
      : {}),
  };

  const evaluationExtracted = {
    brandName: extracted.brandName,
    classType: extracted.classType,
    netContents: extracted.netContents,
    governmentWarning: extracted.governmentWarning,
    bottlerProducer: extracted.bottlerProducer,
    ...(flags.includeAlcohol ? { alcoholContent: extracted.alcoholContent } : {}),
    ...(flags.includeCountry ? { countryOfOrigin: extracted.countryOfOrigin } : {}),
    ...(flags.includeAdditives
      ? { additivesDisclosed: extracted.additivesDisclosed }
      : {}),
  };

  const evalResponse = await client.responses.parse({
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
    text: { format: zodTextFormat(accuracyDecisionSchema, "evaluation") },
  });

  return evalResponse.output_parsed ?? null;
}

// Evaluate each candidate when expected data exists.
/**
 * Runs evaluation for each candidate when expected data is provided.
 */
export async function evaluateCandidates(
  client: OpenAI,
  deployment: string,
  expectedData: ExpectedAlcoholLabel | null,
  candidates: ExtractionCandidate[]
): Promise<ExtractionCandidate[]> {
  if (!expectedData) {
    return candidates;
  }

  const evaluations = await Promise.all(
    candidates.map((candidate) =>
      runEvaluationPass(client, deployment, expectedData, candidate.extracted)
    )
  );

  evaluations.forEach((evaluation, index) => {
    candidates[index].evaluation = evaluation;
  });

  return candidates;
}
