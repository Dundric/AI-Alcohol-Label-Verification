import {
  AdditiveDisclosure,
  AccuracyDecision,
  extractedAlcoholLabelSchema,
  ExtractedAlcoholLabel,
  ExpectedAlcoholLabel,
  GovernmentWarningField,
  SimpleField,
} from "./schemas";

type ExtractLabelResponse = {
  label: ExtractedAlcoholLabel;
  evaluation: AccuracyDecision | null;
};

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
    brandName: makeSimpleField("Fireball"),
    classType: makeSimpleField("Cinnamon Whisky"),
    alcoholContent: makeSimpleField("ALC. 33% BY VOL."),
    netContents: makeSimpleField("100ML"),
    governmentWarning: makeGovernmentWarningField(
      "GOVERNMENT WARNING: (1) ACCORDING TO THE SURGEON GENERAL, WOMEN SHOULD NOT DRINK ALCOHOLIC BEVERAGES DURING PREGNANCY BECAUSE OF THE RISK OF BIRTH DEFECTS. (2) CONSUMPTION OF ALCOHOLIC BEVERAGES IMPAIRS YOUR ABILITY TO DRIVE A CAR OR OPERATE MACHINERY, AND MAY CAUSE HEALTH PROBLEMS.",
      { isBold: true, isAllCaps: true }
    ),
    bottlerProducer: null,
    countryOfOrigin: null,
    additivesDisclosed: emptyAdditives(),
  },
  wine: {
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
    additivesDisclosed: emptyAdditives(),
  },
  beer: {
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
    additivesDisclosed: emptyAdditives(),
  },
  vodka: {
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
    additivesDisclosed: emptyAdditives(),
  },
  rum: {
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
    additivesDisclosed: emptyAdditives(),
  },
};

async function requestStructuredLabelData(
  imageFile: File,
  expectedData?: ExpectedAlcoholLabel
): Promise<ExtractLabelResponse> {
  const uploadResponse = await fetch("/api/blob-upload", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      fileName: imageFile.name,
      contentType: imageFile.type,
    }),
  });

  if (!uploadResponse.ok) {
    throw new Error("Failed to create upload URL");
  }

  const uploadPayload = (await uploadResponse.json()) as {
    uploadUrl?: string;
    blobName?: string;
  };

  if (!uploadPayload.uploadUrl || !uploadPayload.blobName) {
    throw new Error("Invalid upload URL response");
  }

  const uploadResult = await fetch(uploadPayload.uploadUrl, {
    method: "PUT",
    headers: {
      "x-ms-blob-type": "BlockBlob",
      "Content-Type": imageFile.type || "application/octet-stream",
    },
    body: imageFile,
  });

  if (!uploadResult.ok) {
    throw new Error("Failed to upload image to blob storage");
  }

  const response = await fetch("/api/extract-label", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      blobName: uploadPayload.blobName,
      imageName: imageFile.name,
      expected: expectedData ?? null,
    }),
  });

  if (!response.ok) {
    throw new Error("Failed to extract label data");
  }

  const data = await response.json();
  const parsed = extractedAlcoholLabelSchema.safeParse(data?.label ?? data);

  if (!parsed.success) {
    throw new Error("Invalid label response");
  }

  return {
    label: parsed.data,
    evaluation: data?.evaluation ?? null,
  };
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
): Promise<ExtractLabelResponse> {
  if (!imageFile) {
    return { label: getMockLabelData(imageName), evaluation: null };
  }

  try {
    return await requestStructuredLabelData(imageFile, expectedData);
  } catch (error) {
    console.error("Falling back to mock OCR data:", error);
    return { label: getMockLabelData(imageName), evaluation: null };
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
): Promise<Array<{ name: string; data: ExtractLabelResponse }>> {
  const results = await Promise.all(
    files.map(async (file) => ({
      name: file.name,
      data: await extractLabelData(file, file.name, expectedData),
    }))
  );

  return results;
}
