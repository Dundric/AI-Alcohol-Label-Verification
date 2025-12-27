// System-level guidance for the extraction model.
export const systemPrompt =
  "Extract alcohol label fields for TTB compliance. Return null for missing fields. " +
  "Only governmentWarning includes isBold and isAllCaps, and those flags refer to the " +
  "\"GOVERNMENT WARNING\" header text only.";

// Main instruction block for extraction.
export const extractionPrompt =
  "Extract the following fields from the alcohol label image. " +
  "Return `null` for any field that is not present or cannot be confidently determined.\n\n" +
  "FIELDS TO EXTRACT\n" +
  "- brandName: the brand name only (no address or location). \n" +
  "- classType: the TTB class/type designation shown on the label\n" +
  "  - CRITICAL: classType MUST be a regulated alcohol category (e.g., 'Red Wine', 'Vodka', 'Straight Bourbon Whiskey', 'Ale').\n" +
  "  - Do NOT use fanciful names, proprietary names, or flavor names as classType.\n" +
  "  - Example: If label says 'Blue Ridge Moonlight' (Fanciful) and 'White Wine' (Class), classType is 'White Wine'.\n" +
  "- alcoholContent: the ABV as printed (e.g. \"13.5% ALC./VOL.\" or \"4% ABV\" )\n" +
  "  - If the label is beer/malt liquor, ABV might not be included.\n" +
  "  - If the label is a wine under 7% ABV, return null for alcoholContent.\n" +
  "- netContents: net contents in milliliters (e.g. \"750 ML\")\n" +
  "- bottlerProducer: full bottler/producer name AND address as printed usually prefixed by certain works like 'Imported by', 'Bottled by', 'Distilled by' 'Distributed by' 'Produced by' \n" +
  "  (e.g. \"F. KOBEL & BROS, INC., GUERNEVILLE, SONOMA CO, CALIFORNIA\")\n" +
  "- governmentWarning: include the full warning text including the \"GOVERNMENT WARNING:\" header\n" +
  "  - Use one of the standard forms if present.\n" +
  "- countryOfOrigin: only if an imported country is listed; otherwise null\n" +
  "- additivesDisclosed: object with boolean values for:\n" +
  "  - fdcYellowNo5\n" +
  "  - cochinealExtract\n" +
  "  - carmine\n" +
  "  - aspartame\n" +
  "  - sulfitesGe10ppm (Look for the words: 'Contains Sulfites'\n" +
  "  Return null if no additive disclosures are present.\n\n" +
  "TYPOGRAPHY RULES\n" +
  "- Only governmentWarning may include typography metadata.\n" +
  "- Include isBold and isAllCaps ONLY for the \"GOVERNMENT WARNING\" header text.\n" +
  "- Determine typography strictly from the image.\n" +
  "- Do NOT infer or guess typography for any other fields.\n\n" +
  "CONTENT RULES\n" +
  "- brandName and bottlerProducer should be textually similar, but:\n" +
  "  - brandName must NOT include addresses or locations\n" +
  "  - bottlerProducer MUST include address/location if present\n" +
  "- Use the exact capitalization and wording from the label whenever possible.\n\n" +
  "CLASS TYPE GUIDANCE (REFERENCE ONLY)\n" +
  "Choose the closest matching TTB class/type shown on the label.\n" +
  "Examples include (but are not limited to):\n" +
  "- STRAIGHT BOURBON WHISKEY\n" +
  "- BOURBON WHISKEY\n" +
  "- STRAIGHT RYE WHISKEY\n" +
  "- RYE WHISKEY\n" +
  "- TENNESSEE WHISKEY\n" +
  "- VODKA\n" +
  "- GIN\n" +
  "- LONDON DRY GIN\n" +
  "- RUM\n" +
  "- TEQUILA\n" +
  "- MEZCAL\n" +
  "- RED WINE\n" +
  "- ORANGE MUSCAT\n" +
  "- Malt Beer\n" +
  "- Light Lager\n" +
  "- Pale Ale \n" +
  "- CHAMPAGNE\n\n" +
  "- Malt Beverage \n\n" +
  "- CIDER\n\n";

// Rules for the evaluation model when comparing expected vs extracted data.
export const evaluationInstructions =
  "Compare expected vs extracted label data field-by-field. " +
  "For each field, return 1 if the extracted value is accurate enough, otherwise 0. " +
  "Only part of the Brand name has to be present; classType can be loosely similar but not a different category. " +
  "Alcohol content and net contents must match the numbers even if formatting differs. " +
  "For bottler/product as long as most of the name and address are present then it is valid." +
  "Government warning should match a standard form if present." +
  "If the expected value is null or empty, return 1 for that field.\n\n" +
  "Return ONLY a JSON object with these keys: " +
  "brandName, classType, alcoholContent, netContents, governmentWarning, " +
  "bottlerProducer, countryOfOrigin, additivesDisclosed.\n\n";
