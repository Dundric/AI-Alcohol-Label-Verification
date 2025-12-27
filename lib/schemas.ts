import { z } from "zod";

export const simpleFieldSchema = z.object({
  text: z.string().min(1, "Field text is required"),
});

const nullableSimpleFieldSchema = simpleFieldSchema.nullable();

const governmentWarningSchema = z.object({
  text: z.string().min(1, "Government warning is required"),
  isBold: z.boolean(),
  isAllCaps: z.boolean(),
});

const nullableGovernmentWarningSchema = governmentWarningSchema.nullable();

export const additiveDisclosureSchema = z.object({
  fdcYellowNo5: z.boolean(),
  cochinealExtract: z.boolean(),
  carmine: z.boolean(),
  aspartame: z.boolean(),
  sulfitesGe10ppm: z.boolean(),
});

export const productTypeSchema = z.enum([
  "beer",
  "wine",
  "whiskey",
  "rum",
  "other_spirits",
]);

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

function isBeerClassType(value?: string | null): boolean {
  if (!value) return false;
  const normalized = value.toLowerCase();
  return BEER_CLASS_KEYWORDS.some((keyword) => normalized.includes(keyword));
}

// Schema for extracted alcohol label data (nullable for missing fields)
export const extractedAlcoholLabelSchema = z.object({
  brandName: nullableSimpleFieldSchema,
  classType: nullableSimpleFieldSchema,
  alcoholContent: nullableSimpleFieldSchema,
  netContents: nullableSimpleFieldSchema,
  governmentWarning: nullableGovernmentWarningSchema,
  bottlerProducer: nullableSimpleFieldSchema,
  countryOfOrigin: nullableSimpleFieldSchema,
  additivesDisclosed: additiveDisclosureSchema.nullable(),
});

export const partialLabel = extractedAlcoholLabelSchema.partial();

// Schema for expected alcohol label data (required core fields)
export const expectedAlcoholLabelSchema = z.object({
  productType: productTypeSchema.nullable(),
  brandName: simpleFieldSchema,
  classType: simpleFieldSchema,
  alcoholContent: nullableSimpleFieldSchema,
  netContents: simpleFieldSchema,
  governmentWarning: governmentWarningSchema,
  bottlerProducer: simpleFieldSchema,
  countryOfOrigin: nullableSimpleFieldSchema,
  ageYears: z.number().min(0).nullable(),
  isImported: z.boolean(),
  beerHasAddedFlavorsWithAlcohol: z.boolean(),
  additivesDetected: additiveDisclosureSchema,
});

export type SimpleField = z.infer<typeof simpleFieldSchema>;
export type GovernmentWarningField = z.infer<typeof governmentWarningSchema>;
export type AdditiveDisclosure = z.infer<typeof additiveDisclosureSchema>;
export type ProductType = z.infer<typeof productTypeSchema>;
export type ExtractedAlcoholLabel = z.infer<typeof extractedAlcoholLabelSchema>;
export type ExpectedAlcoholLabel = z.infer<typeof expectedAlcoholLabelSchema>;

const fieldScoreSchema = z.union([z.literal(0), z.literal(1)]);

export const fieldAccuracySchema = z.object({
  brandName: fieldScoreSchema,
  classType: fieldScoreSchema,
  alcoholContent: fieldScoreSchema,
  netContents: fieldScoreSchema,
  governmentWarning: fieldScoreSchema,
  bottlerProducer: fieldScoreSchema,
  countryOfOrigin: fieldScoreSchema,
  additivesDisclosed: fieldScoreSchema,
});

export type FieldAccuracy = z.infer<typeof fieldAccuracySchema>;

export const accuracyDecisionSchema = z.object({
  fields: fieldAccuracySchema,
  passed: z.boolean(),
});

export type AccuracyDecision = z.infer<typeof accuracyDecisionSchema>;

// Schema for verification result
export const verificationResultSchema = z.object({
  field: z.string(),
  extracted: z.string(),
  expected: z.string(),
  status: z.enum(["✅", "⚠️", "❌"]),
  message: z.string().optional(),
});

export type VerificationResult = z.infer<typeof verificationResultSchema>;

// Schema for complete verification
export const labelVerificationSchema = z.object({
  imageId: z.string(),
  imageName: z.string(),
  extractedData: extractedAlcoholLabelSchema,
  expectedData: expectedAlcoholLabelSchema,
  evaluation: accuracyDecisionSchema.nullable().optional(),
  results: z.array(verificationResultSchema),
  overallStatus: z.enum(["✅", "⚠️", "❌"]),
});

export type LabelVerification = z.infer<typeof labelVerificationSchema>;
