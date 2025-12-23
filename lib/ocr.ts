import {
  AdditiveDisclosure,
  extractedAlcoholLabelSchema,
  ExtractedAlcoholLabel,
  ExpectedAlcoholLabel,
  GovernmentWarningField,
  SimpleField,
} from "./schemas";

function makeSimpleField(text: string): SimpleField {
  return { text };
}

function makeGovernmentWarningField(
  text: string,
  options: Partial<Pick<GovernmentWarningField, "isBold" | "isAllCaps">> = {}
): GovernmentWarningField {
  return {
    text,
    isBold: options.isBold ?? true,
    isAllCaps: options.isAllCaps ?? true,
  };
}

function emptyAdditives(): AdditiveDisclosure {
  return {
    fdcYellowNo5: false,
    cochinealExtract: false,
    carmine: false,
    aspartame: false,
    sulfitesGe10ppm: false,
  };
}

// Simulated OCR data for different alcohol types
const mockOCRData: Record<string, ExtractedAlcoholLabel> = {
  whiskey: {
    productType: "whiskey",
    brandName: makeSimpleField("Jack Daniel's"),
    classType: makeSimpleField("Tennessee Whiskey"),
    alcoholContent: makeSimpleField("40%"),
    netContents: makeSimpleField("750ml"),
    governmentWarning: makeGovernmentWarningField(
      "GOVERNMENT WARNING: (1) ACCORDING TO THE SURGEON GENERAL, WOMEN SHOULD NOT DRINK ALCOHOLIC BEVERAGES DURING PREGNANCY BECAUSE OF THE RISK OF BIRTH DEFECTS. (2) CONSUMPTION OF ALCOHOLIC BEVERAGES IMPAIRS YOUR ABILITY TO DRIVE A CAR OR OPERATE MACHINERY, AND MAY CAUSE HEALTH PROBLEMS.",
      { isBold: true, isAllCaps: true }
    ),
    bottlerProducer: null,
    countryOfOrigin: null,
    ageStatement: null,
    youngestAgeDisclosed: null,
    additivesDisclosed: emptyAdditives(),
  },
  wine: {
    productType: "wine",
    brandName: makeSimpleField("Chateau Margaux"),
    classType: makeSimpleField("Red Wine"),
    alcoholContent: makeSimpleField("13.5%"),
    netContents: makeSimpleField("750ml"),
    governmentWarning: makeGovernmentWarningField(
      "GOVERNMENT WARNING: (1) ACCORDING TO THE SURGEON GENERAL, WOMEN SHOULD NOT DRINK ALCOHOLIC BEVERAGES DURING PREGNANCY BECAUSE OF THE RISK OF BIRTH DEFECTS. (2) CONSUMPTION OF ALCOHOLIC BEVERAGES IMPAIRS YOUR ABILITY TO DRIVE A CAR OR OPERATE MACHINERY, AND MAY CAUSE HEALTH PROBLEMS.",
      { isBold: true, isAllCaps: true }
    ),
    bottlerProducer: null,
    countryOfOrigin: null,
    ageStatement: null,
    youngestAgeDisclosed: null,
    additivesDisclosed: emptyAdditives(),
  },
  beer: {
    productType: "beer",
    brandName: makeSimpleField("Budweiser"),
    classType: makeSimpleField("Lager Beer"),
    alcoholContent: makeSimpleField("5%"),
    netContents: makeSimpleField("355ml"),
    governmentWarning: makeGovernmentWarningField(
      "GOVERNMENT WARNING: (1) ACCORDING TO THE SURGEON GENERAL, WOMEN SHOULD NOT DRINK ALCOHOLIC BEVERAGES DURING PREGNANCY BECAUSE OF THE RISK OF BIRTH DEFECTS. (2) CONSUMPTION OF ALCOHOLIC BEVERAGES IMPAIRS YOUR ABILITY TO DRIVE A CAR OR OPERATE MACHINERY, AND MAY CAUSE HEALTH PROBLEMS.",
      { isBold: true, isAllCaps: true }
    ),
    bottlerProducer: null,
    countryOfOrigin: null,
    ageStatement: null,
    youngestAgeDisclosed: null,
    additivesDisclosed: emptyAdditives(),
  },
  vodka: {
    productType: "other_spirits",
    brandName: makeSimpleField("Grey Goose"),
    classType: makeSimpleField("Vodka"),
    alcoholContent: makeSimpleField("40%"),
    netContents: makeSimpleField("1l"),
    governmentWarning: makeGovernmentWarningField(
      "GOVERNMENT WARNING: (1) ACCORDING TO THE SURGEON GENERAL, WOMEN SHOULD NOT DRINK ALCOHOLIC BEVERAGES DURING PREGNANCY BECAUSE OF THE RISK OF BIRTH DEFECTS. (2) CONSUMPTION OF ALCOHOLIC BEVERAGES IMPAIRS YOUR ABILITY TO DRIVE A CAR OR OPERATE MACHINERY, AND MAY CAUSE HEALTH PROBLEMS.",
      { isBold: true, isAllCaps: true }
    ),
    bottlerProducer: null,
    countryOfOrigin: null,
    ageStatement: null,
    youngestAgeDisclosed: null,
    additivesDisclosed: emptyAdditives(),
  },
  rum: {
    productType: "rum",
    brandName: makeSimpleField("Captain Morgan"),
    classType: makeSimpleField("Spiced Rum"),
    alcoholContent: makeSimpleField("35%"),
    netContents: makeSimpleField("700ml"),
    governmentWarning: makeGovernmentWarningField(
      "GOVERNMENT WARNING: (1) ACCORDING TO THE SURGEON GENERAL, WOMEN SHOULD NOT DRINK ALCOHOLIC BEVERAGES DURING PREGNANCY BECAUSE OF THE RISK OF BIRTH DEFECTS. (2) CONSUMPTION OF ALCOHOLIC BEVERAGES IMPAIRS YOUR ABILITY TO DRIVE A CAR OR OPERATE MACHINERY, AND MAY CAUSE HEALTH PROBLEMS.",
      { isBold: true, isAllCaps: true }
    ),
    bottlerProducer: null,
    countryOfOrigin: null,
    ageStatement: null,
    youngestAgeDisclosed: null,
    additivesDisclosed: emptyAdditives(),
  },
};

async function requestStructuredLabelData(
  imageFile: File,
  expectedData?: ExpectedAlcoholLabel
): Promise<ExtractedAlcoholLabel> {
  const formData = new FormData();
  formData.append("image", imageFile);
  if (expectedData) {
    formData.append("expected", JSON.stringify(expectedData));
  }

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
  imageName: string,
  expectedData?: ExpectedAlcoholLabel
): Promise<ExtractedAlcoholLabel> {
  if (!imageFile) {
    return getMockLabelData(imageName);
  }

  try {
    return await requestStructuredLabelData(imageFile, expectedData);
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
  files: File[],
  expectedData?: ExpectedAlcoholLabel
): Promise<Array<{ name: string; data: ExtractedAlcoholLabel }>> {
  const results = await Promise.all(
    files.map(async (file) => ({
      name: file.name,
      data: await extractLabelData(file, file.name, expectedData),
    }))
  );

  return results;
}
