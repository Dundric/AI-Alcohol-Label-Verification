import { NextResponse } from "next/server";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { extractedAlcoholLabelSchema } from "@/lib/schemas";

const systemPrompt =
  "Extract alcohol label fields for TTB compliance. Return null for missing fields. " +
  "For each field, include text and two boolean flags: isBold and isAllCaps.";

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

  if (!(image instanceof File)) {
    return NextResponse.json(
      { error: "Image file is required" },
      { status: 400 }
    );
  }

  const buffer = Buffer.from(await image.arrayBuffer());
  const mimeType = image.type || "image/jpeg";
  const imageUrl = `data:${mimeType};base64,${buffer.toString("base64")}`;

  const client = new OpenAI({
    apiKey,
    baseURL: endpoint,
  });

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
              "Extract brandName, classType, alcoholContent, netContents, " +
              "bottlerProducer, countryOfOrigin, and governmentWarning from the label. " +
              "Infer isBold and isAllCaps from the typography.",
          },
          {
            type: "input_image",
            image_url: imageUrl,
            detail: "high"
          },
        ],
      },
    ],
    text: { format: zodTextFormat(extractedAlcoholLabelSchema, "label") },
  });

  console.log("[extract-label] raw output text", response.output_text);
  console.log("[extract-label] parsed output", response.output_parsed);

  if (!response.output_parsed) {
    return NextResponse.json(
      { error: "No label data extracted" },
      { status: 502 }
    );
  }

  return NextResponse.json({ label: response.output_parsed });
}
