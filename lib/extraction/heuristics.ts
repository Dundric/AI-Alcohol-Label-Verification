// Domain heuristics and pure helpers for extraction scoring and selection.
// This module holds text normalization, similarity, and candidate ranking logic
// with no I/O or network dependencies.

import type {
  AdditiveDisclosure,
  ExpectedAlcoholLabel,
  ExtractedAlcoholLabel,
  FieldAccuracy,
  GovernmentWarningField,
  SimpleField,
} from "@/lib/schemas";
import type { ExtractionCandidate } from "@/lib/extraction/types";
import { normalizeForSimilarity, similarityRatio } from "@/lib/textSimilarity";

// Keywords used to infer beer class/type when product type is unknown.
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

// Fields we expect back from the extraction model.
export const FIELD_KEYS = [
  "brandName",
  "classType",
  "alcoholContent",
  "netContents",
  "governmentWarning",
  "bottlerProducer",
  "countryOfOrigin",
  "additivesDisclosed",
] as const;

export type FieldKey = (typeof FIELD_KEYS)[number];

/**
 * Returns true when a class/type string looks beer-related.
 * Used to skip alcoholContent evaluation for beer products.
 */
export function isBeerClassType(value?: string | null): boolean {
  if (!value) return false;
  const normalized = value.toLowerCase();
  return BEER_CLASS_KEYWORDS.some((keyword) => normalized.includes(keyword));
}

/**
 * Returns true when a class/type string suggests wine.
 * Used to skip alcoholContent evaluation for low-ABV wines.
 */
export function isWineClassType(value?: string | null): boolean {
  if (!value) return false;
  return value.toLowerCase().includes("wine");
}

/**
 * Parses the first numeric ABV value from a string; null if none found.
 */
export function parseAbv(text?: string | null): number | null {
  if (!text) return null;
  const match = text.match(/(\d+(\.\d+)?)/);
  if (!match) return null;
  return Number.parseFloat(match[1]);
}

/**
 * Determines whether to evaluate alcoholContent based on product type
 * and TTB exceptions (beer and low-ABV wine).
 */
export function shouldCheckAlcoholContent(expected: ExpectedAlcoholLabel): boolean {
  const isBeer =
    expected.productType === "beer" || isBeerClassType(expected.classType?.text);
  if (isBeer) {
    return false;
  }

  const isWine =
    expected.productType === "wine" || isWineClassType(expected.classType?.text);
  const abv = parseAbv(expected.alcoholContent?.text);
  if (isWine && abv !== null && abv < 7) {
    return false;
  }

  return Boolean(expected.alcoholContent?.text);
}

/**
 * Determines whether to evaluate countryOfOrigin (imports only).
 */
export function shouldCheckCountryOfOrigin(expected: ExpectedAlcoholLabel): boolean {
  return Boolean(expected.isImported && expected.countryOfOrigin?.text);
}

/**
 * Determines whether to evaluate additivesDisclosed (any expected flags).
 */
export function shouldCheckAdditives(expected: ExpectedAlcoholLabel): boolean {
  return Object.values(expected.additivesDetected).some(Boolean);
}

/**
 * Summarizes which optional fields are in scope for evaluation.
 */
export function getEvaluationFlags(expected: ExpectedAlcoholLabel) {
  return {
    includeAlcohol: shouldCheckAlcoholContent(expected),
    includeCountry: shouldCheckCountryOfOrigin(expected),
    includeAdditives: shouldCheckAdditives(expected),
  };
}

/**
 * Forces optional fields to pass when they are out of scope.
 */
export function applyEvaluationOverrides(
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

/**
 * Converts per-field scores into a single pass/fail decision.
 */
export function buildDecision(fields: FieldAccuracy) {
  const passed = Object.values(fields).every((value) => value === 1);
  return { fields, passed };
}

/**
 * Builds a FieldAccuracy object with defaults, honoring optional fields.
 */
export function buildDefaultFields(
  flags: ReturnType<typeof getEvaluationFlags>,
  defaultValue: 0 | 1
): FieldAccuracy {
  return {
    brandName: defaultValue,
    classType: defaultValue,
    alcoholContent: flags.includeAlcohol ? defaultValue : 1,
    netContents: defaultValue,
    governmentWarning: defaultValue,
    bottlerProducer: defaultValue,
    countryOfOrigin: flags.includeCountry ? defaultValue : 1,
    additivesDisclosed: flags.includeAdditives ? defaultValue : 1,
  };
}

/**
 * Extracts raw text from a field value, defaulting to empty string.
 */
export function getTextValue(
  value: SimpleField | GovernmentWarningField | null
): string {
  return value?.text ?? "";
}

/**
 * Maps a FieldKey to its expected value in the reference label.
 */
export function getExpectedValue(
  expected: ExpectedAlcoholLabel,
  key: FieldKey
): SimpleField | GovernmentWarningField | AdditiveDisclosure | null {
  switch (key) {
    case "brandName":
      return expected.brandName;
    case "classType":
      return expected.classType;
    case "alcoholContent":
      return expected.alcoholContent;
    case "netContents":
      return expected.netContents;
    case "governmentWarning":
      return expected.governmentWarning;
    case "bottlerProducer":
      return expected.bottlerProducer;
    case "countryOfOrigin":
      return expected.countryOfOrigin;
    case "additivesDisclosed":
      return expected.additivesDetected;
  }
}

/**
 * Computes a similarity score for a field (0..1). Text fields use
 * normalized string similarity; additives use boolean match rate.
 */
export function similarityScore(
  key: FieldKey,
  extracted: ExtractedAlcoholLabel[FieldKey],
  expected: SimpleField | GovernmentWarningField | AdditiveDisclosure | null
): number {
  if (!expected) return 0;

  if (key === "additivesDisclosed") {
    const expectedAdditives = expected as AdditiveDisclosure;
    const extractedAdditives = extracted as AdditiveDisclosure | null;
    if (!extractedAdditives) return 0;

    const keys = Object.keys(expectedAdditives) as Array<
      keyof AdditiveDisclosure
    >;
    const matches = keys.filter(
      (field) => expectedAdditives[field] === extractedAdditives[field]
    ).length;
    return matches / keys.length;
  }

  const expectedText = normalizeForSimilarity(
    getTextValue(expected as SimpleField | GovernmentWarningField | null)
  );
  const extractedText = normalizeForSimilarity(
    getTextValue(extracted as SimpleField | GovernmentWarningField | null)
  );

  if (!expectedText) return 0;
  return similarityRatio(extractedText, expectedText);
}

/**
 * Chooses the best candidate for a field based on accuracy, similarity, and presence.
 */
export function selectContender(
  contenders: Array<{
    index: number;
    score: 0 | 1;
    similarity: number;
    hasValue: boolean;
  }>,
  requireAccurate: boolean
) {
  const pool = requireAccurate
    ? contenders.filter((contender) => contender.score === 1)
    : contenders;

  return pool.reduce((best, current) => {
    if (current.similarity !== best.similarity) {
      return current.similarity > best.similarity ? current : best;
    }
    if (current.hasValue !== best.hasValue) {
      return current.hasValue ? current : best;
    }
    return current.index < best.index ? current : best;
  });
}

/**
 * Counts how many extracted fields are missing (null/undefined).
 */
export function countMissingFields(extracted: ExtractedAlcoholLabel): number {
  const record = extracted as Record<FieldKey, ExtractedAlcoholLabel[FieldKey]>;
  return FIELD_KEYS.reduce((count, field) => {
    const value = record[field];
    return value === null || value === undefined ? count + 1 : count;
  }, 0);
}