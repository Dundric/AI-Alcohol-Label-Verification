import {
  ExtractedAlcoholLabel,
  ExpectedAlcoholLabel,
  LabelField,
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
function compareBrand(
  extracted: LabelField | null,
  expected: LabelField
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
  extracted: LabelField | null,
  expected: LabelField
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
  extracted: LabelField | null,
  expected: LabelField
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
  extracted: LabelField | null,
  expected: LabelField
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
  extracted: LabelField | null,
  expected: LabelField
): VerificationResult {
  const extractedText = extracted?.text ?? "";
  const normalizedExtracted = normalizeText(extractedText);
  const normalizedExpected = normalizeText(expected.text);

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
    extracted: extractedText,
    expected: expected.text,
    status,
    message,
  };
}

function compareBottlerProducer(
  extracted: LabelField | null,
  expected: LabelField
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
  extracted: LabelField | null,
  expected: LabelField
): VerificationResult {
  const extractedText = extracted?.text ?? "";
  const normalizedExtracted = normalizeText(extractedText);
  const normalizedExpected = normalizeText(expected.text);

  let status: "✅" | "⚠️" | "❌";
  let message: string;

  if (normalizedExtracted === normalizedExpected) {
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

/**
 * Compare all fields of alcohol labels
 */
export function compareLabels(
  extracted: ExtractedAlcoholLabel,
  expected: ExpectedAlcoholLabel
): VerificationResult[] {
  const results = [
    compareBrand(extracted.brandName, expected.brandName),
    compareClassType(extracted.classType, expected.classType),
    compareAlcoholContent(extracted.alcoholContent, expected.alcoholContent),
    compareNetContents(extracted.netContents, expected.netContents),
    compareGovernmentWarning(extracted.governmentWarning, expected.governmentWarning),
  ];

  if (expected.bottlerProducer) {
    results.push(
      compareBottlerProducer(extracted.bottlerProducer, expected.bottlerProducer)
    );
  }

  if (expected.countryOfOrigin) {
    results.push(
      compareCountryOfOrigin(extracted.countryOfOrigin, expected.countryOfOrigin)
    );
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
