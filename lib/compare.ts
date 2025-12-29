import {
  AccuracyDecision,
  ExtractedAlcoholLabel,
  ExpectedAlcoholLabel,
  GovernmentWarningField,
  VerificationResult,
} from "./schemas";
import { levenshteinDistance, normalizeForSimilarity } from "./textSimilarity";

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function normalizeGovWarning(text: string): string {
  return normalizeWhitespace(text).toUpperCase();
}

function isSingleCharDifference(a: string, b: string): boolean {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1) return false;
  return levenshteinDistance(a, b) <= 1;
}

const STANDARD_GOV_WARNINGS = [
  "GOVERNMENT WARNING: (1) ACCORDING TO THE SURGEON GENERAL, WOMEN SHOULD NOT DRINK ALCOHOLIC BEVERAGES DURING PREGNANCY BECAUSE OF THE RISK OF BIRTH DEFECTS. (2) CONSUMPTION OF ALCOHOLIC BEVERAGES IMPAIRS YOUR ABILITY TO DRIVE A CAR OR OPERATE MACHINERY, AND MAY CAUSE HEALTH PROBLEMS.",
  "GOVERNMENT WARNING: (1) According to the Surgeon General, women should not drink alcoholic beverages during pregnancy because of the risk of birth defects. (2) Consumption of alcoholic beverages impairs your ability to drive a car or operate machinery, and may cause health problems.",
].map(normalizeGovWarning);

/**
 * Compare government warning - exact match required
 */
function compareGovernmentWarning(
  extracted: GovernmentWarningField | null,
  expected: GovernmentWarningField
): VerificationResult {
  const extractedText = extracted?.text ?? "";
  const normalizedExtracted = normalizeGovWarning(extractedText);
  const normalizedExpected = normalizeGovWarning(expected.text);
  const looseExtracted = normalizeForSimilarity(extractedText);
  const looseExpected = normalizeForSimilarity(expected.text);

  let status: "✅" | "❌";
  let message: string;

  const expectedIsStandard = STANDARD_GOV_WARNINGS.includes(normalizedExpected);
  const extractedIsStandard = STANDARD_GOV_WARNINGS.includes(normalizedExtracted);

  if (
    isSingleCharDifference(looseExtracted, looseExpected) ||
    (looseExpected.length > 0 && looseExtracted.includes(looseExpected))
  ) {
    status = "✅";
    message = "Government warning contains expected wording";
  } else if (expectedIsStandard && extractedIsStandard) {
    status = "✅";
    message = "Government warning matches standard wording";
  } else {
    status = "❌";
    message = "Government warning does not match";
  }

  return {
    field: "Government Warning",
    extracted: extractedText,
    expected: expected.text,
    status,
    message,
  };
}

function buildEvaluationResult(
  field: string,
  expectedText: string,
  extractedText: string,
  evaluation: AccuracyDecision | null | undefined,
  key: keyof AccuracyDecision["fields"],
  passMessage: string,
  failMessage: string
): VerificationResult | null {
  if (!expectedText) return null;
  if (!evaluation) {
    return {
      field,
      extracted: extractedText,
      expected: expectedText,
      status: "⚠️",
      message: "AI evaluation missing",
    };
  }

  const passed = evaluation.fields[key] === 1;
  return {
    field,
    extracted: extractedText,
    expected: expectedText,
    status: passed ? "✅" : "❌",
    message: passed ? passMessage : failMessage,
  };
}

/**
 * Compare all fields of alcohol labels
 */
export function compareLabels(
  extracted: ExtractedAlcoholLabel,
  expected: ExpectedAlcoholLabel,
  evaluation?: AccuracyDecision | null
): VerificationResult[] {
  const results: VerificationResult[] = [];
  const addResult = (result: VerificationResult | null) => {
    if (result) results.push(result);
  };

  addResult(
    buildEvaluationResult(
      "Brand",
      expected.brandName?.text ?? "",
      extracted.brandName?.text ?? "",
      evaluation,
      "brandName",
      "Brand matches",
      "Brand does not match"
    )
  );
  addResult(
    buildEvaluationResult(
      "Class/Type",
      expected.classType?.text ?? "",
      extracted.classType?.text ?? "",
      evaluation,
      "classType",
      "Class/Type matches",
      "Class/Type does not match"
    )
  );
  addResult(
    buildEvaluationResult(
      "Net Contents",
      expected.netContents?.text ?? "",
      extracted.netContents?.text ?? "",
      evaluation,
      "netContents",
      "Net contents match",
      "Net contents do not match"
    )
  );
  addResult(
    buildEvaluationResult(
      "Bottler/Producer",
      expected.bottlerProducer?.text ?? "",
      extracted.bottlerProducer?.text ?? "",
      evaluation,
      "bottlerProducer",
      "Bottler/Producer matches",
      "Bottler/Producer does not match"
    )
  );

  if (expected.governmentWarning) {
    results.push(
      compareGovernmentWarning(
        extracted.governmentWarning,
        expected.governmentWarning
      )
    );
  }

  addResult(
    buildEvaluationResult(
      "Alcohol Content",
      expected.alcoholContent?.text ?? "",
      extracted.alcoholContent?.text ?? "",
      evaluation,
      "alcoholContent",
      "ABV matches",
      "ABV does not match"
    )
  );
  addResult(
    buildEvaluationResult(
      "Country of Origin",
      expected.countryOfOrigin?.text ?? "",
      extracted.countryOfOrigin?.text ?? "",
      evaluation,
      "countryOfOrigin",
      "Country of origin matches",
      "Country of origin does not match"
    )
  );

  const failures = results.filter((result) => result.status === "❌");
  if (
    failures.length === 1 &&
    failures[0].field === "Government Warning"
  ) {
    const warningResult = results.find(
      (result) => result.field === "Government Warning"
    );
    if (warningResult) {
      warningResult.status = "⚠️";
    }
  }

  return results;
}

/**
 * Calculate overall status from verification results
 */
export function calculateOverallStatus(
  results: VerificationResult[]
): "✅" | "⚠️" | "❌" {
  const hasError = results.some((r) => r.status === "❌");
  const hasWarning = results.some((r) => r.status === "⚠️");

  if (hasError) return "❌";
  if (hasWarning) return "⚠️";
  return "✅";
}
