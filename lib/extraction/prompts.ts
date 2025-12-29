// ===============================
// EXTRACTION PHASE PROMPTS (FINAL)
// ===============================

// System-level guidance for the extraction model.
export const systemPrompt =
  "You are performing STRICT OCR-style extraction for alcohol label compliance analysis. " +
  "You MUST transcribe text EXACTLY as it appears on the label image. " +
  "DO NOT correct spelling, grammar, spacing, capitalization, or punctuation. " +
  "DO NOT normalize text to legal/standard forms. " +
  "If text appears incorrect, incomplete, or malformed, extract it AS WRITTEN. " +
  "If you are unsure of a character, make your best visual guess rather than fixing it. " +
  "Return null only if text is not visible at all. " +
  "Only governmentWarning includes isBold and isAllCaps, and those flags refer to the " +
  "\"GOVERNMENT WARNING\" header text only.";


// Main instruction block for extraction.
export const extractionPrompt =
  "Extract the following fields from the alcohol label image. " +
  "Return `null` for any field that is not present or cannot be confidently determined.\n\n" +

  "CRITICAL TRANSCRIPTION RULES\n" +
  "- This is a transcription task, NOT a validation task.\n" +
  "- Use ONLY what is visibly printed on the label.\n" +
  "- NEVER fix typos, missing words, duplicated words, or malformed phrases.\n" +
  "- NEVER replace label text with legally correct or commonly known text.\n" +
  "- The presence of spelling mistakes is IMPORTANT SIGNAL; preserve them exactly.\n" +
  "- Preserve visible punctuation, capitalization, and spacing as best as possible.\n\n" +

  "FIELDS TO EXTRACT\n" +
  "- brandName: the brand name only (no address or location).\n" +
  "- classType: the TTB class/type designation shown on the label.\n" +
  "  - CRITICAL: classType MUST be a regulated alcohol category shown on the label (e.g., 'Red Wine', 'Vodka', 'Straight Bourbon Whiskey', 'Ale').\n" +
  "  - Do NOT use fanciful names, proprietary names, or flavor names as classType.\n" +
  "  - If multiple regulated types appear, choose the most specific one printed.\n" +
  "- alcoholContent: the ABV as printed (e.g. \"13.5% ALC./VOL.\" or \"4% ABV\").\n" +
  "  - If the label is beer/malt beverage and ABV is not shown, return null.\n" +
  "  - If the label is a wine under 7% ABV, return null.\n" +
  "- netContents: net contents in milliliters as printed (e.g. \"750 ML\").\n" +
  "- bottlerProducer: full bottler/producer name AND address as printed.\n" +
  "  - Often prefixed by: 'Imported by', 'Bottled by', 'Distilled by', 'Distributed by', 'Produced by'.\n" +
  "  - Include address/location if present.\n" +
  "- governmentWarning: VERBATIM transcription of the government warning EXACTLY as printed on the label.\n" +
  "  - Include the \"GOVERNMENT WARNING:\" header if present.\n" +
  "  - Preserve ALL spelling errors, missing words, incorrect words, spacing, and punctuation.\n" +
  "  - DO NOT correct or normalize the text.\n" +
  "  - DO NOT substitute a standard government warning even if the text is similar.\n" +
  "  - If only part of the warning is present/visible, extract only what is visible.\n" +
  "  - EXAMPLE (DO NOT NORMALIZE):\n" +
  "    - Label: \"... IMPAIRS YOUR ABILITY TITY TO DRIVE ...\"\n" +
  "    - Extract: \"... IMPAIRS YOUR ABILITY TITY TO DRIVE ...\"\n" +
  "    - NOT: \"... IMPAIRS YOUR ABILITY TO DRIVE ...\"\n" +
  "- countryOfOrigin: only if an imported country is explicitly listed; otherwise null.\n" +
  "- additivesDisclosed: object with boolean values for:\n" +
  "  - fdcYellowNo5\n" +
  "  - cochinealExtract\n" +
  "  - carmine\n" +
  "  - aspartame\n" +
  "  - sulfitesGe10ppm (look for phrases like 'Contains Sulfites').\n" +
  "  - Return null if no additive disclosures are present.\n\n" +

  "TYPOGRAPHY RULES\n" +
  "- Only governmentWarning may include typography metadata.\n" +
  "- Include isBold and isAllCaps ONLY for the \"GOVERNMENT WARNING\" header text.\n" +
  "- Determine typography strictly from the image.\n" +
  "- Do NOT infer or guess typography for any other fields.\n\n" +

  "CONTENT RULES\n" +
  "- brandName must NOT include addresses or locations.\n" +
  "- bottlerProducer MUST include address/location if present.\n" +
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
  "- BRANDY\n" +
  "- COGNAC\n" +
  "- RED WINE\n" +
  "- WHITE WINE\n" +
  "- ROSE WINE\n" +
  "- CHAMPAGNE\n" +
  "- SPARKLING WINE\n" +
  "- ORANGE MUSCAT\n" +
  "- MALT BEVERAGE\n" +
  "- BEER\n" +
  "- LAGER\n" +
  "- PALE ALE\n" +
  "- STOUT\n" +
  "- CIDER\n";


// Rules for the evaluation model when comparing expected vs extracted data.
export const evaluationInstructions =
  "Compare expected vs extracted label data field-by-field. " +
  "For each field, return 1 if the extracted value is accurate enough, otherwise 0. " +
  "Only part of the Brand name has to be present; classType can be loosely similar but not a different category. " +
  "Alcohol content and net contents must match the numbers even if formatting differs. " +
  "For bottler/product as long as most of the name and address are present then it is valid." +
  "The Government warning has to exactly match a standard form." +
  "If the expected value is null or empty, return 1 for that field.\n\n" +
  "Return ONLY a JSON object with these keys: " +
  "brandName, classType, alcoholContent, netContents, governmentWarning, " +
  "bottlerProducer, countryOfOrigin, additivesDisclosed.\n\n";
