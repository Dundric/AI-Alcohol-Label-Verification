import { NextResponse } from "next/server";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import {
  accuracyDecisionSchema,
  extractedAlcoholLabelSchema,
  expectedAlcoholLabelSchema,
} from "@/lib/schemas";
import crypto from "crypto";
import { uploadAndGetSasUrl } from "@/lib/azureBlob";
import sharp from "sharp";

const systemPrompt =
  "Extract alcohol label fields for TTB compliance. Return null for missing fields. " +
  "Only governmentWarning includes isBold and isAllCaps, and those flags refer to the " +
  "\"GOVERNMENT WARNING\" header text only.";

export const runtime = "nodejs";

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

  let expectedData = null;
  if (typeof expectedRaw === "string") {
    try {
      const parsed = expectedAlcoholLabelSchema.safeParse(JSON.parse(expectedRaw));
      if (parsed.success) {
        expectedData = parsed.data;
      } else {
        console.warn("[extract-label] expected data failed validation", parsed.error.issues);
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
      .rotate()
      .resize({ width: 900, withoutEnlargement: true })
      .jpeg({ quality: 45 })
      .toBuffer();
    uploadBuffer = Buffer.from(compressed);
    uploadContentType = "image/jpeg";
    console.log("[extract-label] image bytes:", buffer.length);
    console.log("[extract-label] compressed bytes:", compressed.length);
  } catch (error) {
    console.warn("[extract-label] image compression failed, using original", error);
    console.log("[extract-label] image bytes:", buffer.length);
  }

  // 🔍 LOG IMAGE SIZE (helps explain vision latency)

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

  // 🔍 LOG SAS URL CREATION
  console.log("[extract-label] SAS URL created");

  const client = new OpenAI({
    apiKey,
    baseURL: endpoint,
  });

  // ⏱️ START TIMING THE OPENAI CALL
  const start = performance.now();

  const response = await client.responses.parse({
    model: deployment,
    input: [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text:
              "Extract the following fields from the alcohol label image:\n" +
              "- productType (beer, wine, whiskey, rum, other_spirits)\n" +
              "- brandName\n" +
              "- classType\n" +
              "- alcoholContent\n" +
              "- netContents\n" +
              "- bottlerProducer\n" +
              "- countryOfOrigin\n" +
              "- ageStatement\n" +
              "- youngestAgeDisclosed (boolean)\n" +
              "- additivesDisclosed (object with booleans: fdcYellowNo5, cochinealExtract, carmine, aspartame, sulfitesGe10ppm)\n" +
              "- governmentWarning\n\n" +
              "Expected values (for reference only):\n" +
              `${expectedData ? JSON.stringify(expectedData) : "none"}\n\n` +
              "For classType, choose the closest matching value based on common TTB class/type " +
              "designations. Examples include (but are not limited to):\n" +
              "- STRAIGHT BOURBON WHISKEY\n" +
              "- BOURBON WHISKEY\n" +
              "- STRAIGHT RYE WHISKEY\n" +
              "- RYE WHISKEY\n" +
              "- TENNESSEE WHISKEY\n" +
              "- VODKA\n" +
              "- GIN\n" +
              "- Orange Muscat\n" +
              "- LONDON DRY GIN\n" +
              "- RUM\n" +
              "- TEQUILA\n" +
              "- MEZCAL\n" +
              "Use the exact capitalization and wording as it appears on the label when possible.\n\n" +
              "Make sure to write the full text for governmentWarning. Only include isBold and isAllCaps for governmentWarning. " +
              "Set these based solely on the typography of the 'GOVERNMENT WARNING' header text. " +
              "Do not infer typography for any other fields.",
          },
          {
            type: "input_image",
            image_url: imageUrl,
            detail: "low",
          },
        ],
      },
    ],
    text: { format: zodTextFormat(extractedAlcoholLabelSchema, "label") },
  });

  // ⏱️ END TIMING
  const durationMs = Math.round(performance.now() - start);
  console.log("[extract-label] openai call duration (ms):", durationMs);

  // 🔢 TOKEN USAGE LOGGING (THIS IS THE KEY PART YOU ASKED FOR)
  if (response.usage) {
    console.log("[extract-label] token usage:", {
      input_tokens: response.usage.input_tokens,
      output_tokens: response.usage.output_tokens,
      total_tokens: response.usage.total_tokens,
    });
  } else {
    console.log("[extract-label] token usage not returned");
  }

  // 🧾 EXISTING OUTPUT LOGS
  console.log("[extract-label] raw output text", response.output_text);
  console.log("[extract-label] parsed output", response.output_parsed);

  if (!response.output_parsed) {
    return NextResponse.json(
      { error: "No label data extracted" },
      { status: 502 }
    );
  }

  let evaluation = null;
  if (expectedData) {
    const evalResponse = await client.responses.parse({
      model: deployment,
      input: [
        {
          role: "system",
          content:
            "Compare expected vs extracted label data and decide if the extraction is accurate.",
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text:
                "Expected:\n" +
                JSON.stringify(expectedData) +
                "\n\nExtracted:\n" +
                JSON.stringify(response.output_parsed),
            },
          ],
        },
      ],
      text: { format: zodTextFormat(accuracyDecisionSchema, "evaluation") },
    });

    evaluation = evalResponse.output_parsed ?? null;
  }

  return NextResponse.json({ label: response.output_parsed, evaluation });
}
