import { AlcoholLabel, VerificationResult } from "./schemas";

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

/**
 * Fuzzy match brand names with normalization
 * Returns ✅ if similarity > 0.85, ⚠️ if > 0.6, otherwise ❌
 */
function compareBrand(extracted: string, expected: string): VerificationResult {
  const normalizedExtracted = normalizeText(extracted);
  const normalizedExpected = normalizeText(expected);
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
    extracted,
    expected,
    status,
    message,
  };
}

/**
 * Compare class/type with fuzzy matching
 */
function compareClassType(extracted: string, expected: string): VerificationResult {
  const normalizedExtracted = normalizeText(extracted);
  const normalizedExpected = normalizeText(expected);
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
    extracted,
    expected,
    status,
    message,
  };
}

/**
 * Compare ABV (Alcohol by Volume)
 * Extracts numeric values and compares with tolerance
 */
function compareABV(extracted: string, expected: string): VerificationResult {
  const extractedNum = parseFloat(extracted.replace(/[^\d.]/g, ""));
  const expectedNum = parseFloat(expected.replace(/[^\d.]/g, ""));

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
    field: "ABV",
    extracted,
    expected,
    status,
    message,
  };
}

/**
 * Compare net contents
 * Normalizes units and compares values
 */
function compareNetContents(extracted: string, expected: string): VerificationResult {
  const extractedNum = parseFloat(extracted.replace(/[^\d.]/g, ""));
  const expectedNum = parseFloat(expected.replace(/[^\d.]/g, ""));
  
  const extractedUnit = extracted.replace(/[\d.\s]/g, "").toLowerCase();
  const expectedUnit = expected.replace(/[\d.\s]/g, "").toLowerCase();

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
    extracted,
    expected,
    status,
    message,
  };
}

/**
 * Compare government warning - exact match required
 */
function compareGovWarning(extracted: string, expected: string): VerificationResult {
  const normalizedExtracted = normalizeText(extracted);
  const normalizedExpected = normalizeText(expected);

  let status: "✅" | "⚠️" | "❌";
  let message: string;

  if (normalizedExtracted === normalizedExpected) {
    status = "✅";
    message = "Government warning matches exactly";
  } else {
    const similarity = similarityRatio(normalizedExtracted, normalizedExpected);
    if (similarity > 0.95) {
      status = "⚠️";
      message = "Government warning nearly matches (minor differences)";
    } else {
      status = "❌";
      message = "Government warning does not match";
    }
  }

  return {
    field: "Government Warning",
    extracted,
    expected,
    status,
    message,
  };
}

/**
 * Compare all fields of alcohol labels
 */
export function compareLabels(
  extracted: AlcoholLabel,
  expected: AlcoholLabel
): VerificationResult[] {
  return [
    compareBrand(extracted.brand, expected.brand),
    compareClassType(extracted.classType, expected.classType),
    compareABV(extracted.abv, expected.abv),
    compareNetContents(extracted.netContents, expected.netContents),
    compareGovWarning(extracted.govWarning, expected.govWarning),
  ];
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
