import {
  extractedAlcoholLabelSchema,
  ExtractedAlcoholLabel,
  LabelField,
} from "./schemas";

function inferAllCaps(text: string): boolean {
  const trimmed = text.trim();
  return trimmed.length > 0 && trimmed === trimmed.toUpperCase();
}

function makeLabelField(
  text: string,
  options: Partial<Pick<LabelField, "isBold" | "isAllCaps">> = {}
): LabelField {
  return {
    text,
    isBold: options.isBold ?? false,
    isAllCaps: options.isAllCaps ?? inferAllCaps(text),
  };
}

// Simulated OCR data for different alcohol types
const mockOCRData: Record<string, ExtractedAlcoholLabel> = {
  whiskey: {
    brandName: makeLabelField("Jack Daniel's", { isBold: true }),
    classType: makeLabelField("Tennessee Whiskey"),
    alcoholContent: makeLabelField("40%"),
    netContents: makeLabelField("750ml"),
    governmentWarning: makeLabelField(
      "GOVERNMENT WARNING: (1) ACCORDING TO THE SURGEON GENERAL, WOMEN SHOULD NOT DRINK ALCOHOLIC BEVERAGES DURING PREGNANCY BECAUSE OF THE RISK OF BIRTH DEFECTS. (2) CONSUMPTION OF ALCOHOLIC BEVERAGES IMPAIRS YOUR ABILITY TO DRIVE A CAR OR OPERATE MACHINERY, AND MAY CAUSE HEALTH PROBLEMS.",
      { isAllCaps: true }
    ),
    bottlerProducer: null,
    countryOfOrigin: null,
  },
  wine: {
    brandName: makeLabelField("Chateau Margaux", { isBold: true }),
    classType: makeLabelField("Red Wine"),
    alcoholContent: makeLabelField("13.5%"),
    netContents: makeLabelField("750ml"),
    governmentWarning: makeLabelField(
      "GOVERNMENT WARNING: (1) ACCORDING TO THE SURGEON GENERAL, WOMEN SHOULD NOT DRINK ALCOHOLIC BEVERAGES DURING PREGNANCY BECAUSE OF THE RISK OF BIRTH DEFECTS. (2) CONSUMPTION OF ALCOHOLIC BEVERAGES IMPAIRS YOUR ABILITY TO DRIVE A CAR OR OPERATE MACHINERY, AND MAY CAUSE HEALTH PROBLEMS.",
      { isAllCaps: true }
    ),
    bottlerProducer: null,
    countryOfOrigin: null,
  },
  beer: {
    brandName: makeLabelField("Budweiser", { isBold: true }),
    classType: makeLabelField("Lager Beer"),
    alcoholContent: makeLabelField("5%"),
    netContents: makeLabelField("355ml"),
    governmentWarning: makeLabelField(
      "GOVERNMENT WARNING: (1) ACCORDING TO THE SURGEON GENERAL, WOMEN SHOULD NOT DRINK ALCOHOLIC BEVERAGES DURING PREGNANCY BECAUSE OF THE RISK OF BIRTH DEFECTS. (2) CONSUMPTION OF ALCOHOLIC BEVERAGES IMPAIRS YOUR ABILITY TO DRIVE A CAR OR OPERATE MACHINERY, AND MAY CAUSE HEALTH PROBLEMS.",
      { isAllCaps: true }
    ),
    bottlerProducer: null,
    countryOfOrigin: null,
  },
  vodka: {
    brandName: makeLabelField("Grey Goose", { isBold: true }),
    classType: makeLabelField("Vodka"),
    alcoholContent: makeLabelField("40%"),
    netContents: makeLabelField("1l"),
    governmentWarning: makeLabelField(
      "GOVERNMENT WARNING: (1) ACCORDING TO THE SURGEON GENERAL, WOMEN SHOULD NOT DRINK ALCOHOLIC BEVERAGES DURING PREGNANCY BECAUSE OF THE RISK OF BIRTH DEFECTS. (2) CONSUMPTION OF ALCOHOLIC BEVERAGES IMPAIRS YOUR ABILITY TO DRIVE A CAR OR OPERATE MACHINERY, AND MAY CAUSE HEALTH PROBLEMS.",
      { isAllCaps: true }
    ),
    bottlerProducer: null,
    countryOfOrigin: null,
  },
  rum: {
    brandName: makeLabelField("Captain Morgan", { isBold: true }),
    classType: makeLabelField("Spiced Rum"),
    alcoholContent: makeLabelField("35%"),
    netContents: makeLabelField("700ml"),
    governmentWarning: makeLabelField(
      "GOVERNMENT WARNING: (1) ACCORDING TO THE SURGEON GENERAL, WOMEN SHOULD NOT DRINK ALCOHOLIC BEVERAGES DURING PREGNANCY BECAUSE OF THE RISK OF BIRTH DEFECTS. (2) CONSUMPTION OF ALCOHOLIC BEVERAGES IMPAIRS YOUR ABILITY TO DRIVE A CAR OR OPERATE MACHINERY, AND MAY CAUSE HEALTH PROBLEMS.",
      { isAllCaps: true }
    ),
    bottlerProducer: null,
    countryOfOrigin: null,
  },
};

async function requestStructuredLabelData(
  imageFile: File
): Promise<ExtractedAlcoholLabel> {
  const formData = new FormData();
  formData.append("image", imageFile);

  const response = await fetch("/api/extract-label", {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new Error("Failed to extract label data");
  }

  const data = await response.json();
  const parsed = extractedAlcoholLabelSchema.safeParse(data?.label ?? data);

  if (!parsed.success) {
    throw new Error("Invalid label response");
  }

  return parsed.data;
}

function getMockLabelData(imageName: string): ExtractedAlcoholLabel {
  const lowerName = imageName.toLowerCase();
  
  if (lowerName.includes("whiskey") || lowerName.includes("whisky")) {
    return mockOCRData.whiskey;
  }
  if (lowerName.includes("wine")) {
    return mockOCRData.wine;
  }
  if (lowerName.includes("beer")) {
    return mockOCRData.beer;
  }
  if (lowerName.includes("vodka")) {
    return mockOCRData.vodka;
  }
  if (lowerName.includes("rum")) {
    return mockOCRData.rum;
  }

  // Default to whiskey if no match
  return mockOCRData.whiskey;
}

/**
 * Extract alcohol label data from an image using the API, with mock fallback.
 * 
 * @param imageFile - The image file to process
 * @param imageName - The name of the image file
 * @returns Promise<ExtractedAlcoholLabel> - Extracted label data
 */
export async function extractLabelData(
  imageFile: File | null,
  imageName: string
): Promise<ExtractedAlcoholLabel> {
  if (!imageFile) {
    return getMockLabelData(imageName);
  }

  try {
    return await requestStructuredLabelData(imageFile);
  } catch (error) {
    console.error("Falling back to mock OCR data:", error);
    return getMockLabelData(imageName);
  }
}

/**
 * Batch process multiple images
 * 
 * @param files - Array of image files to process
 * @returns Promise<Array<{name: string, data: ExtractedAlcoholLabel}>> - Array of extracted data
 */
export async function batchExtractLabelData(
  files: File[]
): Promise<Array<{ name: string; data: ExtractedAlcoholLabel }>> {
  const results = await Promise.all(
    files.map(async (file) => ({
      name: file.name,
      data: await extractLabelData(file, file.name),
    }))
  );

  return results;
}
