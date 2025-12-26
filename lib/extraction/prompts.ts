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
  "  - If the label is beer/malt liquor, return null for alcoholContent.\n" +
  "  - If the label is a wine under 7% ABV, return null for alcoholContent.\n" +
  "- netContents: net contents in milliliters (e.g. \"750 ML\")\n" +
  "- bottlerProducer: full bottler/producer name AND address as printed\n" +
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
  "For brandname: only part of the brand has to be present not the full brandname. " +
  "classType can be vaguely similar, just no large differencesa like wine vs beer. " +
  "alcohol and netcontents must have the same numbers as the expected but the text can come in many forms. " +
  "The government warning must match one of the two standard forms if present.\n\n" +
  "Always return mismatchedFields as an array of field keys that are incorrect or missing. " +
  "If everything matches, return an empty array. " +
  "Valid keys: brandName, classType, alcoholContent, netContents, governmentWarning, " +
  "bottlerProducer, countryOfOrigin, additivesDisclosed.\n\n";
