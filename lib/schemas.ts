import { z } from "zod";

export const labelFieldSchema = z.object({
  text: z.string().min(1, "Field text is required"),
  isBold: z.boolean(),
  isAllCaps: z.boolean(),
});

const nullableLabelFieldSchema = labelFieldSchema.nullable();

// Schema for extracted alcohol label data (nullable for missing fields)
export const extractedAlcoholLabelSchema = z.object({
  brandName: nullableLabelFieldSchema,
  classType: nullableLabelFieldSchema,
  alcoholContent: nullableLabelFieldSchema,
  netContents: nullableLabelFieldSchema,
  governmentWarning: nullableLabelFieldSchema,
  bottlerProducer: nullableLabelFieldSchema,
  countryOfOrigin: nullableLabelFieldSchema,
});

// Schema for expected alcohol label data (required core fields)
export const expectedAlcoholLabelSchema = z.object({
  brandName: labelFieldSchema,
  classType: labelFieldSchema,
  alcoholContent: labelFieldSchema,
  netContents: labelFieldSchema,
  governmentWarning: labelFieldSchema,
  bottlerProducer: nullableLabelFieldSchema,
  countryOfOrigin: nullableLabelFieldSchema,
});

export type LabelField = z.infer<typeof labelFieldSchema>;
export type ExtractedAlcoholLabel = z.infer<typeof extractedAlcoholLabelSchema>;
export type ExpectedAlcoholLabel = z.infer<typeof expectedAlcoholLabelSchema>;

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
  results: z.array(verificationResultSchema),
  overallStatus: z.enum(["✅", "⚠️", "❌"]),
});

export type LabelVerification = z.infer<typeof labelVerificationSchema>;
