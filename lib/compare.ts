import {
  AccuracyDecision,
  AdditiveDisclosure,
  ExtractedAlcoholLabel,
  ExpectedAlcoholLabel,
  GovernmentWarningField,
  ProductType,
  SimpleField,
  VerificationResult,
} from "./schemas";
import { normalizeForSimilarity, similarityRatio } from "./textSimilarity";

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function normalizeGovWarning(text: string): string {
  return normalizeWhitespace(text).toUpperCase();
}

const STANDARD_GOV_WARNINGS = [
  "GOVERNMENT WARNING: (1) ACCORDING TO THE SURGEON GENERAL, WOMEN SHOULD NOT DRINK ALCOHOLIC BEVERAGES DURING PREGNANCY BECAUSE OF THE RISK OF BIRTH DEFECTS. (2) CONSUMPTION OF ALCOHOLIC BEVERAGES IMPAIRS YOUR ABILITY TO DRIVE A CAR OR OPERATE MACHINERY, AND MAY CAUSE HEALTH PROBLEMS.",
  "GOVERNMENT WARNING: (1) According to the Surgeon General, women should not drink alcoholic beverages during pregnancy because of the risk of birth defects. (2) Consumption of alcoholic beverages impairs your ability to drive a car or operate machinery, and may cause health problems.",
].map(normalizeGovWarning);

const BEER_CLASS_KEYWORDS = [
  "beer",
  "ale",
  "lager",
  "porter",
  "stout",
  "malt liquor",
  "cereal beverage",
  "near beer",
  "wheat beer",
  "rye beer",
  "ice beer",
  "barley wine",
  "half and half",
  "black and tan",
];

const WHISKEY_KEYWORDS = [
  "whiskey",
  "whisky",
  "bourbon",
  "rye whisky",
  "rye whiskey",
  "malt whisky",
  "malt whiskey",
  "straight whisky",
  "straight whiskey",
  "scotch",
  "irish",
  "canadian whisky",
  "canadian whiskey",
];

const RUM_KEYWORDS = ["rum"];

const WINE_KEYWORDS = [
  "wine",
  "champagne",
  "sparkling",
  "carbonated",
  "cider",
  "perry",
  "sake",
  "vermouth",
  "sherry",
  "port",
  "madeira",
  "muscatel",
  "muscat",
  "retsina",
];

const OTHER_SPIRITS_KEYWORDS = [
  "vodka",
  "gin",
  "brandy",
  "cognac",
  "armagnac",
  "pisco",
  "grappa",
  "applejack",
  "tequila",
  "mezcal",
  "liqueur",
  "cordial",
  "schnapps",
  "amaretto",
  "triple sec",
  "flavored",
  "ouzo",
  "cachaça",
  "neutral spirits",
  "grain spirits",
];

function deriveProductTypeFromClassType(
  classType?: string | null
): ProductType | null {
  if (!classType) return null;
  const normalized = classType.toLowerCase();

  if (WHISKEY_KEYWORDS.some((keyword) => normalized.includes(keyword))) {
    return "whiskey";
  }
  if (RUM_KEYWORDS.some((keyword) => normalized.includes(keyword))) {
    return "rum";
  }
  if (BEER_CLASS_KEYWORDS.some((keyword) => normalized.includes(keyword))) {
    return "beer";
  }
  if (WINE_KEYWORDS.some((keyword) => normalized.includes(keyword))) {
    return "wine";
  }
  if (OTHER_SPIRITS_KEYWORDS.some((keyword) => normalized.includes(keyword))) {
    return "other_spirits";
  }

  return null;
}

/**
 * Fuzzy match brand names with normalization
 * Returns ✅ if similarity > 0.85, ⚠️ if > 0.6, otherwise ❌
 */
function compareBrand(
  extracted: SimpleField | null,
  expected: SimpleField
): VerificationResult {
  const extractedText = extracted?.text ?? "";
  const normalizedExtracted = normalizeForSimilarity(extractedText);
  const normalizedExpected = normalizeForSimilarity(expected.text);
  const similarity = similarityRatio(normalizedExtracted, normalizedExpected);

  let status: "✅" | "⚠️" | "❌";
  let message: string;

  if (similarity > 0.85) {
    status = "✅";
    message = "Brand matches";
  } else if (similarity > 0.6) {
    status = "⚠️";
    message = `Partial match (${Math.round(similarity * 100)}% similar)`;
  } else {
    status = "❌";
    message = "Brand does not match";
  }

  return {
    field: "Brand",
    extracted: extractedText,
    expected: expected.text,
    status,
    message,
  };
}

/**
 * Compare class/type with fuzzy matching
 */
function compareClassType(
  extracted: SimpleField | null,
  expected: SimpleField
): VerificationResult {
  const extractedText = extracted?.text ?? "";
  const normalizedExtracted = normalizeForSimilarity(extractedText);
  const normalizedExpected = normalizeForSimilarity(expected.text);
  const similarity = similarityRatio(normalizedExtracted, normalizedExpected);

  let status: "✅" | "⚠️" | "❌";
  let message: string;

  if (similarity > 0.85) {
    status = "✅";
    message = "Class/Type matches";
  } else if (similarity > 0.6) {
    status = "⚠️";
    message = `Partial match (${Math.round(similarity * 100)}% similar)`;
  } else {
    status = "❌";
    message = "Class/Type does not match";
  }

  return {
    field: "Class/Type",
    extracted: extractedText,
    expected: expected.text,
    status,
    message,
  };
}

/**
 * Compare alcohol content
 * Extracts numeric values and compares with tolerance
 */
function compareAlcoholContent(
  extracted: SimpleField | null,
  expected: SimpleField
): VerificationResult {
  const extractedText = extracted?.text ?? "";
  const extractedNum = parseFloat(extractedText.replace(/[^\d.]/g, ""));
  const expectedNum = parseFloat(expected.text.replace(/[^\d.]/g, ""));

  let status: "✅" | "⚠️" | "❌";
  let message: string;

  if (Math.abs(extractedNum - expectedNum) < 0.1) {
    status = "✅";
    message = "ABV matches";
  } else if (Math.abs(extractedNum - expectedNum) < 1) {
    status = "⚠️";
    message = `ABV close (difference: ${Math.abs(extractedNum - expectedNum).toFixed(1)}%)`;
  } else {
    status = "❌";
    message = "ABV does not match";
  }

  return {
    field: "Alcohol Content",
    extracted: extractedText,
    expected: expected.text,
    status,
    message,
  };
}

/**
 * Compare net contents
 * Normalizes units and compares values
 */
function compareNetContents(
  extracted: SimpleField | null,
  expected: SimpleField
): VerificationResult {
  const extractedText = extracted?.text ?? "";
  const extractedNum = parseFloat(extractedText.replace(/[^\d.]/g, ""));
  const expectedNum = parseFloat(expected.text.replace(/[^\d.]/g, ""));
  
  const extractedUnit = extractedText.replace(/[\d.\s]/g, "").toLowerCase();
  const expectedUnit = expected.text.replace(/[\d.\s]/g, "").toLowerCase();

  let status: "✅" | "⚠️" | "❌";
  let message: string;

  // Check if units match
  if (extractedUnit !== expectedUnit) {
    status = "❌";
    message = "Units do not match";
  } else if (Math.abs(extractedNum - expectedNum) < 0.1) {
    status = "✅";
    message = "Net contents match";
  } else if (Math.abs(extractedNum - expectedNum) < expectedNum * 0.05) {
    status = "⚠️";
    message = "Net contents close (within 5%)";
  } else {
    status = "❌";
    message = "Net contents do not match";
  }

  return {
    field: "Net Contents",
    extracted: extractedText,
    expected: expected.text,
    status,
    message,
  };
}

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

  let status: "✅" | "❌";
  let message: string;

  const expectedIsStandard = STANDARD_GOV_WARNINGS.includes(normalizedExpected);
  const extractedIsStandard = STANDARD_GOV_WARNINGS.includes(normalizedExtracted);

  if (
    normalizedExtracted === normalizedExpected ||
    (normalizedExpected.length > 0 &&
      normalizedExtracted.includes(normalizedExpected))
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

function evaluateRegulatoryRules(
  extracted: ExtractedAlcoholLabel,
  expected: ExpectedAlcoholLabel
): VerificationResult[] {
  const results: VerificationResult[] = [];

  const additivesDetected = expected.additivesDetected;
  const additivesDisclosed: AdditiveDisclosure | null =
    extracted.additivesDisclosed ?? null;

  const additiveRules: Array<[keyof AdditiveDisclosure, string]> = [
    ["fdcYellowNo5", "FD&C Yellow No. 5"],
    ["cochinealExtract", "cochineal extract"],
    ["carmine", "carmine"],
    ["aspartame", "aspartame"],
    ["sulfitesGe10ppm", "Contains Sulfites"],
  ];

  additiveRules.forEach(([key, label]) => {
    if (additivesDetected[key] && !additivesDisclosed?.[key]) {
      results.push({
        field: "Rule: Additive Disclosure",
        extracted: "Not disclosed",
        expected: label,
        status: "❌",
        message: `Required additive disclosure missing: ${label}`,
      });
    }
  });

  if (expected.isImported) {
    if (!extracted.countryOfOrigin?.text) {
      results.push({
        field: "Rule: Import Country",
        extracted: "Not found",
        expected: "Country of origin required",
        status: "❌",
        message: "Imported spirits must declare country of origin",
      });
    }
  }

  return results;
}

function compareBottlerProducer(
  extracted: SimpleField | null,
  expected: SimpleField
): VerificationResult {
  const extractedText = extracted?.text ?? "";
  const normalizedExtracted = normalizeForSimilarity(extractedText);
  const normalizedExpected = normalizeForSimilarity(expected.text);
  const similarity = similarityRatio(normalizedExtracted, normalizedExpected);

  let status: "✅" | "⚠️" | "❌";
  let message: string;

  if (similarity > 0.85) {
    status = "✅";
    message = "Bottler/Producer matches";
  } else if (similarity > 0.6) {
    status = "⚠️";
    message = `Partial match (${Math.round(similarity * 100)}% similar)`;
  } else {
    status = "❌";
    message = "Bottler/Producer does not match";
  }

  return {
    field: "Bottler/Producer",
    extracted: extractedText,
    expected: expected.text,
    status,
    message,
  };
}

function compareCountryOfOrigin(
  extracted: SimpleField | null,
  expected: SimpleField
): VerificationResult {
  const extractedText = extracted?.text ?? "";
  const normalizedExtracted = normalizeForSimilarity(extractedText);
  const normalizedExpected = normalizeForSimilarity(expected.text);
  const cleanedExtracted = normalizedExtracted
    .replace(/\b(produced in|made in|product of|imported from|origin)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();

  let status: "✅" | "⚠️" | "❌";
  let message: string;

  if (
    normalizedExtracted === normalizedExpected ||
    cleanedExtracted === normalizedExpected ||
    normalizedExtracted.includes(normalizedExpected) ||
    cleanedExtracted.includes(normalizedExpected)
  ) {
    status = "✅";
    message = "Country of origin matches";
  } else {
    const similarity = similarityRatio(normalizedExtracted, normalizedExpected);
    if (similarity > 0.9) {
      status = "⚠️";
      message = "Country of origin nearly matches";
    } else {
      status = "❌";
      message = "Country of origin does not match";
    }
  }

  return {
    field: "Country of Origin",
    extracted: extractedText,
    expected: expected.text,
    status,
    message,
  };
}

function applyAIEvaluationStatus(
  results: VerificationResult[],
  evaluation?: AccuracyDecision | null
): VerificationResult[] {
  if (!evaluation) {
    return results.map((result) =>
      result.field === "Government Warning"
        ? result
        : { ...result, status: "⚠️" }
    );
  }

  const fieldMap: Record<string, keyof AccuracyDecision["fields"]> = {
    Brand: "brandName",
    "Class/Type": "classType",
    "Alcohol Content": "alcoholContent",
    "Net Contents": "netContents",
    "Bottler/Producer": "bottlerProducer",
    "Country of Origin": "countryOfOrigin",
  };

  return results.map((result) => {
    const key = fieldMap[result.field];
    if (!key) {
      return result;
    }
    const status: "✅" | "❌" =
      evaluation.fields[key] === 1 ? "✅" : "❌";
    return { ...result, status };
  });
}

/**
 * Compare all fields of alcohol labels
 */
export function compareLabels(
  extracted: ExtractedAlcoholLabel,
  expected: ExpectedAlcoholLabel,
  evaluation?: AccuracyDecision | null
): VerificationResult[] {
  const results = [
    compareBrand(extracted.brandName, expected.brandName),
    compareClassType(extracted.classType, expected.classType),
    compareNetContents(extracted.netContents, expected.netContents),
    compareBottlerProducer(extracted.bottlerProducer, expected.bottlerProducer),
  ];

  if (expected.governmentWarning) {
    results.push(
      compareGovernmentWarning(
        extracted.governmentWarning,
        expected.governmentWarning
      )
    );
  }

  if (expected.alcoholContent) {
    results.push(
      compareAlcoholContent(extracted.alcoholContent, expected.alcoholContent)
    );
  }

  if (expected.countryOfOrigin) {
    results.push(
      compareCountryOfOrigin(extracted.countryOfOrigin, expected.countryOfOrigin)
    );
  }

  results.push(...evaluateRegulatoryRules(extracted, expected));

  return applyAIEvaluationStatus(results, evaluation);
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
