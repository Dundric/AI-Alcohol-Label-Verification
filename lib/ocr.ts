import { AlcoholLabel } from "./schemas";

// Simulated OCR data for different alcohol types
const mockOCRData: Record<string, AlcoholLabel> = {
  whiskey: {
    brand: "Jack Daniel's",
    classType: "Tennessee Whiskey",
    abv: "40%",
    netContents: "750ml",
    govWarning:
      "GOVERNMENT WARNING: (1) ACCORDING TO THE SURGEON GENERAL, WOMEN SHOULD NOT DRINK ALCOHOLIC BEVERAGES DURING PREGNANCY BECAUSE OF THE RISK OF BIRTH DEFECTS. (2) CONSUMPTION OF ALCOHOLIC BEVERAGES IMPAIRS YOUR ABILITY TO DRIVE A CAR OR OPERATE MACHINERY, AND MAY CAUSE HEALTH PROBLEMS.",
  },
  wine: {
    brand: "Chateau Margaux",
    classType: "Red Wine",
    abv: "13.5%",
    netContents: "750ml",
    govWarning:
      "GOVERNMENT WARNING: (1) ACCORDING TO THE SURGEON GENERAL, WOMEN SHOULD NOT DRINK ALCOHOLIC BEVERAGES DURING PREGNANCY BECAUSE OF THE RISK OF BIRTH DEFECTS. (2) CONSUMPTION OF ALCOHOLIC BEVERAGES IMPAIRS YOUR ABILITY TO DRIVE A CAR OR OPERATE MACHINERY, AND MAY CAUSE HEALTH PROBLEMS.",
  },
  beer: {
    brand: "Budweiser",
    classType: "Lager Beer",
    abv: "5%",
    netContents: "355ml",
    govWarning:
      "GOVERNMENT WARNING: (1) ACCORDING TO THE SURGEON GENERAL, WOMEN SHOULD NOT DRINK ALCOHOLIC BEVERAGES DURING PREGNANCY BECAUSE OF THE RISK OF BIRTH DEFECTS. (2) CONSUMPTION OF ALCOHOLIC BEVERAGES IMPAIRS YOUR ABILITY TO DRIVE A CAR OR OPERATE MACHINERY, AND MAY CAUSE HEALTH PROBLEMS.",
  },
  vodka: {
    brand: "Grey Goose",
    classType: "Vodka",
    abv: "40%",
    netContents: "1l",
    govWarning:
      "GOVERNMENT WARNING: (1) ACCORDING TO THE SURGEON GENERAL, WOMEN SHOULD NOT DRINK ALCOHOLIC BEVERAGES DURING PREGNANCY BECAUSE OF THE RISK OF BIRTH DEFECTS. (2) CONSUMPTION OF ALCOHOLIC BEVERAGES IMPAIRS YOUR ABILITY TO DRIVE A CAR OR OPERATE MACHINERY, AND MAY CAUSE HEALTH PROBLEMS.",
  },
  rum: {
    brand: "Captain Morgan",
    classType: "Spiced Rum",
    abv: "35%",
    netContents: "700ml",
    govWarning:
      "GOVERNMENT WARNING: (1) ACCORDING TO THE SURGEON GENERAL, WOMEN SHOULD NOT DRINK ALCOHOLIC BEVERAGES DURING PREGNANCY BECAUSE OF THE RISK OF BIRTH DEFECTS. (2) CONSUMPTION OF ALCOHOLIC BEVERAGES IMPAIRS YOUR ABILITY TO DRIVE A CAR OR OPERATE MACHINERY, AND MAY CAUSE HEALTH PROBLEMS.",
  },
};

/**
 * Mocked OCR function that extracts alcohol label data from an image
 * Returns data quickly to simulate fast OCR processing
 * 
 * @param imageFile - The image file to process (not actually used in mock)
 * @param imageName - The name of the image file
 * @returns Promise<AlcoholLabel> - Extracted label data
 */
export async function extractLabelData(
  imageFile: File | null,
  imageName: string
): Promise<AlcoholLabel> {
  // Simulate processing delay (100-300ms)
  await new Promise((resolve) => setTimeout(resolve, Math.random() * 200 + 100));

  // Determine which mock data to return based on filename
  const lowerName = imageName.toLowerCase();
  
  if (lowerName.includes("whiskey") || lowerName.includes("whisky")) {
    return mockOCRData.whiskey;
  } else if (lowerName.includes("wine")) {
    return mockOCRData.wine;
  } else if (lowerName.includes("beer")) {
    return mockOCRData.beer;
  } else if (lowerName.includes("vodka")) {
    return mockOCRData.vodka;
  } else if (lowerName.includes("rum")) {
    return mockOCRData.rum;
  }

  // Default to whiskey if no match
  return mockOCRData.whiskey;
}

/**
 * Batch process multiple images
 * 
 * @param files - Array of image files to process
 * @returns Promise<Array<{name: string, data: AlcoholLabel}>> - Array of extracted data
 */
export async function batchExtractLabelData(
  files: File[]
): Promise<Array<{ name: string; data: AlcoholLabel }>> {
  const results = await Promise.all(
    files.map(async (file) => ({
      name: file.name,
      data: await extractLabelData(file, file.name),
    }))
  );

  return results;
}
