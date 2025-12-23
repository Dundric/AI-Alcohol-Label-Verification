import { z } from "zod";

// Schema for alcohol label data
export const alcoholLabelSchema = z.object({
  brand: z.string().min(1, "Brand is required"),
  classType: z.string().min(1, "Class/Type is required"),
  abv: z.string().regex(/^\d+(\.\d+)?%?$/, "ABV must be a valid percentage"),
  netContents: z.string().regex(/^\d+(\.\d+)?\s*(ml|l|oz|gal)$/i, "Net contents must include a valid volume unit"),
  govWarning: z.string().min(1, "Government warning is required"),
});

export type AlcoholLabel = z.infer<typeof alcoholLabelSchema>;

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
  extractedData: alcoholLabelSchema,
  expectedData: alcoholLabelSchema,
  results: z.array(verificationResultSchema),
  overallStatus: z.enum(["✅", "⚠️", "❌"]),
});

export type LabelVerification = z.infer<typeof labelVerificationSchema>;
