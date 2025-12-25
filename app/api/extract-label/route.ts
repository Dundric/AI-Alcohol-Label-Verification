import { NextResponse } from "next/server";
import OpenAI from "openai";
import type { ResponseInputMessageContentList } from "openai/resources/responses/responses";
import { zodTextFormat } from "openai/helpers/zod";
import {
  accuracyDecisionSchema,
  extractedAlcoholLabelSchema,
  expectedAlcoholLabelSchema,
  type AccuracyDecision,
  type ExtractedAlcoholLabel,
  type ExpectedAlcoholLabel,
} from "@/lib/schemas";
import crypto from "crypto";
import { uploadAndGetSasUrl } from "@/lib/azureBlob";
import sharp from "sharp";

const systemPrompt =
  "Extract alcohol label fields for TTB compliance. Return null for missing fields. " +
  "Only governmentWarning includes isBold and isAllCaps, and those flags refer to the " +
  "\"GOVERNMENT WARNING\" header text only.";

export const runtime = "nodejs";

const EXTRACTED_FIELD_KEYS = [
  "brandName",
  "classType",
  "alcoholContent",
  "netContents",
  "governmentWarning",
  "bottlerProducer",
  "countryOfOrigin",
  "additivesDisclosed",
] as const;

type ExtractedFieldKey = (typeof EXTRACTED_FIELD_KEYS)[number];

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

function isWineClassType(value?: string | null): boolean {
  if (!value) return false;
  return value.toLowerCase().includes("wine");
}

function parseAbv(text?: string | null): number | null {
  if (!text) return null;
  const match = text.match(/(\d+(\.\d+)?)/);
  if (!match) return null;
  return Number.parseFloat(match[1]);
}

function shouldCheckAlcoholContent(expected: ExpectedAlcoholLabel): boolean {
  const isBeer =
    expected.productType === "beer" || isBeerClassType(expected.classType?.text);
  if (isBeer) {
    return false;
  }

  const isWine =
    expected.productType === "wine" || isWineClassType(expected.classType?.text);
  const abv = parseAbv(expected.alcoholContent?.text);
  if (isWine && abv !== null && abv < 7) {
    return false;
  }

  return Boolean(expected.alcoholContent?.text);
}

function shouldCheckCountryOfOrigin(expected: ExpectedAlcoholLabel): boolean {
  return Boolean(expected.isImported && expected.countryOfOrigin?.text);
}

function shouldCheckAdditives(expected: ExpectedAlcoholLabel): boolean {
  return Object.values(expected.additivesDetected).some(Boolean);
}

type ExtractionCandidate = {
  extracted: ExtractedAlcoholLabel;
  evaluation: AccuracyDecision | null;
  index: number;
};

function countMissingFields(extracted: ExtractedAlcoholLabel): number {
  const record = extracted as Record<
    ExtractedFieldKey,
    ExtractedAlcoholLabel[ExtractedFieldKey]
  >;
  return EXTRACTED_FIELD_KEYS.reduce((count, field) => {
    const value = record[field];
    return value === null || value === undefined ? count + 1 : count;
  }, 0);
}

function isBetterCandidate(
  contender: ExtractionCandidate,
  current: ExtractionCandidate,
  expected: ExpectedAlcoholLabel | null
): boolean {
  if (expected) {
    const contenderAccuracy = contender.evaluation
      ? contender.evaluation.accurate
        ? 1
        : 0
      : -1;
    const currentAccuracy = current.evaluation
      ? current.evaluation.accurate
        ? 1
        : 0
      : -1;

    if (contenderAccuracy !== currentAccuracy) {
      return contenderAccuracy > currentAccuracy;
    }

    const contenderMismatches = contender.evaluation
      ? contender.evaluation.mismatchedFields.length
      : Number.POSITIVE_INFINITY;
    const currentMismatches = current.evaluation
      ? current.evaluation.mismatchedFields.length
      : Number.POSITIVE_INFINITY;

    if (contenderMismatches !== currentMismatches) {
      return contenderMismatches < currentMismatches;
    }
  }

  const contenderMissing = countMissingFields(contender.extracted);
  const currentMissing = countMissingFields(current.extracted);

  if (contenderMissing !== currentMissing) {
    return contenderMissing < currentMissing;
  }

  return contender.index < current.index;
}

export async function POST(request: Request) {
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const apiKey = process.env.AZURE_OPENAI_API_KEY;
  const deployment = process.env.AZURE_OPENAI_DEPLOYMENT;

  if (!endpoint || !apiKey || !deployment) {
    return NextResponse.json(
      { error: "Missing Azure OpenAI configuration" },
      { status: 500 }
    );
  }

  const formData = await request.formData();
  const image = formData.get("image");
  const expectedRaw = formData.get("expected");

  if (!(image instanceof File)) {
    return NextResponse.json(
      { error: "Image file is required" },
      { status: 400 }
    );
  }

  let expectedData: ExpectedAlcoholLabel | null = null;
  if (typeof expectedRaw === "string") {
    try {
      const parsed = expectedAlcoholLabelSchema.safeParse(JSON.parse(expectedRaw));
      if (parsed.success) {
        expectedData = parsed.data;
      } else {
        console.warn(
          "[extract-label] expected data failed validation",
          parsed.error.issues
        );
      }
    } catch (error) {
      console.warn("[extract-label] expected data parse failed", error);
    }
  }

  const buffer = Buffer.from(await image.arrayBuffer());
  const mimeType = image.type || "image/jpeg";

  let uploadBuffer = buffer;
  let uploadContentType = mimeType;

  try {
    const compressed = await sharp(buffer)
      .resize({ width: 1600, withoutEnlargement: true })
      .normalize()
      .sharpen()
      .jpeg({ quality: 70 })
      .toBuffer();
    uploadBuffer = Buffer.from(compressed);
    uploadContentType = "image/jpeg";
    console.log("[extract-label] image bytes:", buffer.length);
    console.log("[extract-label] preprocessed bytes:", compressed.length);
  } catch (error) {
    console.warn("[extract-label] image compression failed, using original", error);
    console.log("[extract-label] image bytes:", buffer.length);
  }

  const blobName = `labels/${crypto.randomUUID()}.jpg`;

  let imageUrl: string;
  try {
    imageUrl = await uploadAndGetSasUrl({
      buffer: uploadBuffer,
      contentType: uploadContentType,
      blobName,
    });
  } catch (error) {
    console.error("[extract-label] blob upload failed", error);
    return NextResponse.json(
      { error: "Failed to upload image to storage" },
      { status: 502 }
    );
  }

  console.log("[extract-label] SAS URL created");

  const client = new OpenAI({
    apiKey,
    baseURL: endpoint,
  });

  const extractionPrompt =
    "Extract the following fields from the alcohol label image. " +
    "Return `null` for any field that is not present or cannot be confidently determined.\n\n" +
    "FIELDS TO EXTRACT\n" +
    "- brandName: the brand name only (no address or location). \n" +
    "- classType: the TTB class/type designation shown on the label\n" +
    "  - CRITICAL: classType MUST be a regulated alcohol category (e.g., 'Red Wine', 'Vodka', 'Straight Bourbon Whiskey', 'Ale').\n" +
    "  - Do NOT use fanciful names, proprietary names, or flavor names as classType.\n" +
    "  - Example: If label says 'Blue Ridge Moonlight' (Fanciful) and 'White Wine' (Class), classType is 'White Wine'.\n" +
    "- alcoholContent: the ABV as printed (e.g. \"13.5% ALC./VOL.\" or \"4% ABV\" or \"ALC 10.5% BY VOL\" )\n" +
    "  - If the label is beer/malt liquor, return null for alcoholContent.\n" +
    "  - If the label is a wine under 7% ABV, return null for alcoholContent.\n" +
    "- netContents: net contents in milliliters (e.g. \"750 ML\")\n" +
    "- bottlerProducer: full bottler/producer name AND address as printed\n" +
    "  (e.g. \"F. KOBEL & BROS, INC., GUERNEVILLE, SONOMA CO, CALIFORNIA\")\n" +
    "- governmentWarning: include the full warning text including the \"GOVERNMENT WARNING:\" header\n" +
    "- There are two forms of valid government warnings:.\n" +
    "- GOVERNMENT WARNING: (1) ACCORDING TO THE SURGEON GENERAL, WOMEN SHOULD NOT DRINK ALCOHOLIC BEVERAGES DURING PREGNANCY BECAUSE OF THE RISK OF BIRTH DEFECTS. (2) CONSUMPTION OF ALCOHOLIC BEVERAGES IMPAIRS YOUR ABILITY TO DRIVE A CAR OR OPERATE MACHINERY, AND MAY CAUSE HEALTH PROBLEMS.\n" +
    "- GOVERNMENT WARNING: (1) According to the Surgeon General, women should not drink alcoholic beverages during pregnancy because of the risk of birth defects. (2) Consumption of alcoholic beverages impairs your ability to drive a car or operate machinery, and may cause health problems.\n\n" +
    "- countryOfOrigin: only if an imported country is listed; otherwise null\n" +
    "- additivesDisclosed: object with boolean values for:\n" +
    "  - fdcYellowNo5\n" +
    "  - cochinealExtract\n" +
    "  - carmine\n" +
    "  - aspartame\n" +
    "  - Contains Sulfites\n" +
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
    "- Light Lager\n"+
    "- Pale Ale \n" +
    "- CHAMPAGNE\n\n" +
    "- Malt Beverage \n\n" + 
    "- CIDER\n\n"

  const runExtraction = async (options: {
    feedback?: string | null;
    fields?: ReadonlyArray<ExtractedFieldKey>;
    attempt?: number;
  }) => {
    const { feedback, fields, attempt } = options;
    const start = performance.now();
    const content: ResponseInputMessageContentList = [
      { type: "input_text", text: extractionPrompt },
    ];
    if (fields && fields.length > 0) {
      content.push({
        type: "input_text",
        text:
          "Only re-extract these fields: " +
          fields.join(", ") +
          ". Return null for any field not listed above.",
      });
    }
    if (feedback) {
      content.push({
        type: "input_text",
        text:
          "Retry notes from evaluation:\n" +
          feedback +
          "\nRe-check those fields carefully using only visible text.",
      });
    }
    content.push({ type: "input_image", image_url: imageUrl, detail: "high" });

    const response = await client.responses.parse({
      model: deployment,
      input: [
        { role: "system", content: systemPrompt },
        { role: "user", content },
      ],
      text: { format: zodTextFormat(extractedAlcoholLabelSchema, "label") },
    });

    const durationMs = Math.round(performance.now() - start);
    const attemptLabel = attempt ? `attempt ${attempt}` : "attempt";
    console.log(
      `[extract-label] ${attemptLabel} openai call duration (ms):`,
      durationMs
    );

    if (response.usage) {
      console.log(`[extract-label] ${attemptLabel} token usage:`, {
        input_tokens: response.usage.input_tokens,
        output_tokens: response.usage.output_tokens,
        total_tokens: response.usage.total_tokens,
      });
    } else {
      console.log(`[extract-label] ${attemptLabel} token usage not returned`);
    }

    console.log(
      `[extract-label] ${attemptLabel} raw output text`,
      response.output_text
    );
    console.log(
      `[extract-label] ${attemptLabel} parsed output`,
      response.output_parsed
    );

    return response;
  };

  const runEvaluation = async (extracted: ExtractedAlcoholLabel) => {
    if (!expectedData) {
      return null;
    }

    const evaluationExpected = {
      brandName: expectedData.brandName,
      classType: expectedData.classType,
      netContents: expectedData.netContents,
      governmentWarning: expectedData.governmentWarning,
      bottlerProducer: expectedData.bottlerProducer,
      ...(shouldCheckAlcoholContent(expectedData)
        ? { alcoholContent: expectedData.alcoholContent }
        : {}),
      ...(shouldCheckCountryOfOrigin(expectedData)
        ? { countryOfOrigin: expectedData.countryOfOrigin }
        : {}),
      ...(shouldCheckAdditives(expectedData)
        ? { additivesDisclosed: expectedData.additivesDetected }
        : {}),
    };

    const evaluationExtracted = {
      brandName: extracted.brandName,
      classType: extracted.classType,
      netContents: extracted.netContents,
      governmentWarning: extracted.governmentWarning,
      bottlerProducer: extracted.bottlerProducer,
      ...(shouldCheckAlcoholContent(expectedData)
        ? { alcoholContent: extracted.alcoholContent }
        : {}),
      ...(shouldCheckCountryOfOrigin(expectedData)
        ? { countryOfOrigin: extracted.countryOfOrigin }
        : {}),
      ...(shouldCheckAdditives(expectedData)
        ? { additivesDisclosed: extracted.additivesDisclosed }
        : {}),
    };

    const evalResponse = await client.responses.parse({
      model: deployment,
      input: [
        {
          role: "system",
          content:
            "Compare expected vs extracted label data and decide if the extraction is accurate. Allow differences in wording or formattting.",
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text:
                "For brandname only part of the brand has to be present not the full brandname. classType can be vaguely similar, just no large differencesa like wine vs beer. alcohol and netcontents must have the same numbers but the text can come in many forms. The government warning must match one of the two standard forms if present.\n\n" +
                "Always return mismatchedFields as an array of field keys that are incorrect or missing. " +
                "If everything matches, return an empty array. " +
                "Valid keys: brandName, classType, alcoholContent, netContents, governmentWarning, bottlerProducer, countryOfOrigin, additivesDisclosed.\n\n" +
                "Expected:\n" +
                JSON.stringify(evaluationExpected) +
                "\n\nExtracted:\n" +
                JSON.stringify(evaluationExtracted),
            },
          ],
        },
      ],
      text: { format: zodTextFormat(accuracyDecisionSchema, "evaluation") },
    });

    return evalResponse.output_parsed ?? null;
  };

  console.log("[extract-label] running parallel extractions");
  const extractionResponses = await Promise.all([
    runExtraction({ attempt: 1 }),
    runExtraction({ attempt: 2 }),
    runExtraction({ attempt: 3 }),
  ]);

  const candidates: ExtractionCandidate[] = [];
  extractionResponses.forEach((response, index) => {
    if (!response.output_parsed) {
      console.warn(
        `[extract-label] extraction candidate ${index + 1} returned no data`
      );
      return;
    }
    candidates.push({
      extracted: response.output_parsed as ExtractedAlcoholLabel,
      evaluation: null,
      index,
    });
  });

  if (candidates.length === 0) {
    return NextResponse.json(
      { error: "No label data extracted" },
      { status: 502 }
    );
  }

  const evaluations = await Promise.all(
    candidates.map((candidate) => runEvaluation(candidate.extracted))
  );

  evaluations.forEach((evaluation, index) => {
    candidates[index].evaluation = evaluation;
  });

  const bestCandidate = candidates.reduce((current, contender) =>
    isBetterCandidate(contender, current, expectedData) ? contender : current
  );

  return NextResponse.json({
    label: bestCandidate.extracted,
    evaluation: bestCandidate.evaluation,
  });
}
