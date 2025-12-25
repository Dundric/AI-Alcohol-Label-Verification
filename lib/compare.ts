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

/**
 * Normalize text for comparison by converting to lowercase and removing punctuation
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function normalizeGovWarning(text: string): string {
  return normalizeWhitespace(text).toUpperCase();
}

const STANDARD_GOV_WARNINGS = [
  "GOVERNMENT WARNING: (1) ACCORDING TO THE SURGEON GENERAL, WOMEN SHOULD NOT DRINK ALCOHOLIC BEVERAGES.",
  "GOVERNMENT WARNING: (1) According to the Surgeon General, women should not drink alcoholic beverages during pregnancy because of the risk of birth defects. (2) Consumption of alcoholic beverages impairs your ability to drive a car or operate machinery, and may cause health problems.",
].map(normalizeGovWarning);

/**
 * Calculate Levenshtein distance between two strings for fuzzy matching
 */
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
        matrix[i - 1][j] + 1, // deletion
        matrix[i][j - 1] + 1, // insertion
        matrix[i - 1][j - 1] + cost // substitution
      );
    }
  }

  return matrix[len1][len2];
}

/**
 * Calculate similarity ratio between two strings (0-1)
 */
function similarityRatio(str1: string, str2: string): number {
  const distance = levenshteinDistance(str1, str2);
  const maxLength = Math.max(str1.length, str2.length);
  if (maxLength === 0) return 1;
  return 1 - distance / maxLength;
}

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

function resolveProductType(
  extracted: ExtractedAlcoholLabel,
  expected: ExpectedAlcoholLabel
): ProductType | null {
  return (
    expected.productType ??
    deriveProductTypeFromClassType(expected.classType?.text) ??
    deriveProductTypeFromClassType(extracted.classType?.text)
  );
}

function parseAbv(text?: string | null): number | null {
  if (!text) return null;
  const match = text.match(/(\d+(\.\d+)?)/);
  if (!match) return null;
  return Number.parseFloat(match[1]);
}

function compareOptionalField(
  label: string,
  extracted: SimpleField | null,
  expected: SimpleField
): VerificationResult {
  const extractedText = extracted?.text ?? "";
  const normalizedExtracted = normalizeText(extractedText);
  const normalizedExpected = normalizeText(expected.text);
  const similarity = similarityRatio(normalizedExtracted, normalizedExpected);

  let status: "✅" | "⚠️" | "❌";
  let message: string;

  if (similarity > 0.9) {
    status = "✅";
    message = `${label} matches`;
  } else if (similarity > 0.7) {
    status = "⚠️";
    message = `Partial match (${Math.round(similarity * 100)}% similar)`;
  } else {
    status = "❌";
    message = `${label} does not match`;
  }

  return {
    field: label,
    extracted: extractedText,
    expected: expected.text,
    status,
    message,
  };
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
  const normalizedExtracted = normalizeText(extractedText);
  const normalizedExpected = normalizeText(expected.text);
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
  const normalizedExtracted = normalizeText(extractedText);
  const normalizedExpected = normalizeText(expected.text);
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

  if (normalizedExtracted === normalizedExpected) {
    status = "✅";
    message = "Government warning matches exactly";
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
  const normalizedExtracted = normalizeText(extractedText);
  const normalizedExpected = normalizeText(expected.text);
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
  const normalizedExtracted = normalizeText(extractedText);
  const normalizedExpected = normalizeText(expected.text);
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

  const status: "✅" | "❌" = evaluation.accurate ? "✅" : "❌";
  return results.map((result) =>
    result.field === "Government Warning"
      ? result
      : { ...result, status }
  );
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
    compareGovernmentWarning(extracted.governmentWarning, expected.governmentWarning),
    compareBottlerProducer(extracted.bottlerProducer, expected.bottlerProducer),
  ];

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
