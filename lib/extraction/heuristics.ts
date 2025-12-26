import type { ExpectedAlcoholLabel, ExtractedAlcoholLabel } from "@/lib/schemas";
import type { ExtractionCandidate } from "@/lib/extraction/types";

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
const EXTRACTED_FIELD_KEYS = [
  "brandName",
  "classType",
  "alcoholContent",
  "netContents",
  "governmentWarning",
  "bottlerProducer",
  "countryOfOrigin",
  "additivesDisclosed",
] as const;

type ExtractedFieldKey = (typeof EXTRACTED_FIELD_KEYS)[number];

/**
 * Returns true when a class/type string looks like a beer-related category.
 * Used to decide whether alcohol content should be evaluated.
 */
export function isBeerClassType(value?: string | null): boolean {
  if (!value) return false;
  const normalized = value.toLowerCase();
  return BEER_CLASS_KEYWORDS.some((keyword) => normalized.includes(keyword));
}

/**
 * Returns true when the class/type string suggests a wine product.
 * Used to apply wine-specific alcohol-content rules.
 */
export function isWineClassType(value?: string | null): boolean {
  if (!value) return false;
  return value.toLowerCase().includes("wine");
}

/**
 * Parses the first numeric ABV value from a string; returns null when absent.
 */
export function parseAbv(text?: string | null): number | null {
  if (!text) return null;
  const match = text.match(/(\d+(\.\d+)?)/);
  if (!match) return null;
  return Number.parseFloat(match[1]);
}

/**
 * Determines if alcoholContent should be included in evaluation based on
 * product type and TTB rules (beer and low-ABV wine exceptions).
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
 * Determines if countryOfOrigin should be evaluated based on import status.
 */
export function shouldCheckCountryOfOrigin(expected: ExpectedAlcoholLabel): boolean {
  return Boolean(expected.isImported && expected.countryOfOrigin?.text);
}

/**
 * Determines if additivesDisclosed should be evaluated based on expected flags.
 */
export function shouldCheckAdditives(expected: ExpectedAlcoholLabel): boolean {
  return Object.values(expected.additivesDetected).some(Boolean);
}

/**
 * Counts how many extracted fields are missing (null/undefined) for tie-breaking.
 */
export function countMissingFields(extracted: ExtractedAlcoholLabel): number {
  const record = extracted as Record<
    ExtractedFieldKey,
    ExtractedAlcoholLabel[ExtractedFieldKey]
  >;
  return EXTRACTED_FIELD_KEYS.reduce((count, field) => {
    const value = record[field];
    return value === null || value === undefined ? count + 1 : count;
  }, 0);
}

/**
 * Returns true when the contender is a stronger candidate than the current one.
 * Preference order: accuracy, fewer mismatches, fewer missing fields, then index.
 */
export function isBetterCandidate(
  contender: ExtractionCandidate,
  current: ExtractionCandidate,
  expected: ExpectedAlcoholLabel | null
): boolean {
  // Rank by accuracy, then fewer mismatches, then fewer missing fields.
  if (expected) {
    const contenderAccuracy = contender.evaluation
      ? contender.evaluation.accurate
        ? 1
        : 0
      : -1;
    const currentAccuracy = current.evaluation
      ? current.evaluation.accurate
        ? 1
        : 0
      : -1;

    if (contenderAccuracy !== currentAccuracy) {
      return contenderAccuracy > currentAccuracy;
    }

    const contenderMismatches = contender.evaluation
      ? contender.evaluation.mismatchedFields.length
      : Number.POSITIVE_INFINITY;
    const currentMismatches = current.evaluation
      ? current.evaluation.mismatchedFields.length
      : Number.POSITIVE_INFINITY;

    if (contenderMismatches !== currentMismatches) {
      return contenderMismatches < currentMismatches;
    }
  }

  const contenderMissing = countMissingFields(contender.extracted);
  const currentMissing = countMissingFields(current.extracted);

  if (contenderMissing !== currentMissing) {
    return contenderMissing < currentMissing;
  }

  return contender.index < current.index;
}
