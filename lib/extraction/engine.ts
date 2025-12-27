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

function applyEvaluationOverrides(
  fields: FieldAccuracy,
  flags: ReturnType<typeof getEvaluationFlags>
): FieldAccuracy {
  return {
    ...fields,
    alcoholContent: flags.includeAlcohol ? fields.alcoholContent : 1,
    countryOfOrigin: flags.includeCountry ? fields.countryOfOrigin : 1,
    additivesDisclosed: flags.includeAdditives ? fields.additivesDisclosed : 1,
  };
}

function buildDecision(fields: FieldAccuracy): AccuracyDecision {
  const passed = Object.values(fields).every((value) => value === 1);
  return { fields, passed };
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
  let response: Awaited<ReturnType<typeof client.responses.parse>>;
  try {
    response = await client.responses.parse({
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
      response = await client.responses.parse({
        model: deployment,
        input: [
          { role: "system", content: systemPrompt },
          { role: "user", content },
        ],
        text: { format: zodTextFormat(extractedAlcoholLabelSchema, "label") },
      });
    } else {
      throw error;
    }
  }

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
    text: { format: zodTextFormat(fieldAccuracySchema, "evaluation") },
  });

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
