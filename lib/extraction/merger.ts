import type {
  AccuracyDecision,
  ExtractedAlcoholLabel,
  ExpectedAlcoholLabel,
} from "@/lib/schemas";
import type { ExtractionCandidate, LoggerFns } from "@/lib/extraction/types";
import {
  buildDefaultFields,
  FIELD_KEYS,
  getEvaluationFlags,
  getExpectedValue,
  similarityScore,
  selectContender,
} from "@/lib/extraction/heuristics";




/**
 * Chooses a single merged label from multiple extraction candidates by scoring
 * each field against expected data and selecting the best contender per field.
 * It builds a merged label from those winners, then marks a field as accurate
 * only if at least one candidate scored that field as accurate. The returned
 * evaluation reflects these merged field scores and overall pass/fail.
 */
export function mergeCandidates(
  candidates: ExtractionCandidate[],
  expected: ExpectedAlcoholLabel,
  logger: LoggerFns
): { label: ExtractedAlcoholLabel; evaluation: AccuracyDecision } {
  const flags = getEvaluationFlags(expected);
  const fallbackFields = buildDefaultFields(flags, 0);
  const candidateFields = candidates.map(
    (candidate) => candidate.evaluation?.fields ?? fallbackFields
  );

  const mergedFields = buildDefaultFields(flags, 0);
  const mergedLabel: ExtractedAlcoholLabel = {
    brandName: null,
    classType: null,
    alcoholContent: null,
    netContents: null,
    governmentWarning: null,
    bottlerProducer: null,
    countryOfOrigin: null,
    additivesDisclosed: null,
  };

  FIELD_KEYS.forEach((key) => {
    const expectedValue = getExpectedValue(expected, key);
    const contenders = candidates.map((candidate, index) => {
      const value = candidate.extracted[key];
      return {
        index,
        score: candidateFields[index][key],
        similarity: similarityScore(key, value, expectedValue),
        hasValue: value !== null && value !== undefined,
      };
    });

    const hasAccurate = contenders.some((contender) => contender.score === 1);
    const best = selectContender(contenders, hasAccurate);
    const selected = candidates[best.index].extracted;
    switch (key) {
      case "brandName":
        mergedLabel.brandName = selected.brandName;
        break;
      case "classType":
        mergedLabel.classType = selected.classType;
        break;
      case "alcoholContent":
        mergedLabel.alcoholContent = selected.alcoholContent;
        break;
      case "netContents":
        mergedLabel.netContents = selected.netContents;
        break;
      case "governmentWarning":
        mergedLabel.governmentWarning = selected.governmentWarning;
        break;
      case "bottlerProducer":
        mergedLabel.bottlerProducer = selected.bottlerProducer;
        break;
      case "countryOfOrigin":
        mergedLabel.countryOfOrigin = selected.countryOfOrigin;
        break;
      case "additivesDisclosed":
        mergedLabel.additivesDisclosed = selected.additivesDisclosed;
        break;
    }
    mergedFields[key] = hasAccurate ? 1 : 0;
  });

  const passed = Object.values(mergedFields).every((value) => value === 1);
  logger.log("[extract-label] merged evaluation", mergedFields, { passed });

  return {
    label: mergedLabel,
    evaluation: { fields: mergedFields, passed },
  };
}
