import { NextResponse } from "next/server";
import {
  extractLabelFromFormData,
  extractLabelFromImageDataUrl,
} from "@/lib/extraction";
import { expectedAlcoholLabelSchema } from "@/lib/schemas";

export const runtime = "nodejs";

function getVerifyImageUrl(): string | null {
  return process.env.AZURE_FUNCTION_VERIFY_IMAGE_URL ?? null;
}

// Handles label extraction requests. Accepts either JSON with a data URL or
// multipart form data, runs the extraction pipeline locally when configured,
// or forwards the payload to the external verify service when enabled.
export async function POST(request: Request) {
  const verifyImageUrl = getVerifyImageUrl();

  if (!verifyImageUrl) {
    const contentType = request.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      let payload: unknown = null;
      try {
        payload = await request.json();
      } catch {
        return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
      }
      const body = (payload ?? {}) as {
        imageDataUrl?: unknown;
        expected?: unknown;
        imageName?: unknown;
      };
      const imageDataUrl =
        typeof body.imageDataUrl === "string" ? body.imageDataUrl : null;
      if (!imageDataUrl) {
        return NextResponse.json(
          { error: "imageDataUrl is required" },
          { status: 400 }
        );
      }

      const expectedParsed = expectedAlcoholLabelSchema.safeParse(body.expected);
      const expected = expectedParsed.success ? expectedParsed.data : null;
      const imageName = typeof body.imageName === "string" ? body.imageName : undefined;

      const result = await extractLabelFromImageDataUrl(imageDataUrl, expected, {
        logger: console,
        imageName,
      });
      if (!result.ok) {
        return NextResponse.json(
          { error: result.error },
          { status: result.status }
        );
      }
      return NextResponse.json({
        label: result.label,
        evaluation: result.evaluation,
      });
    }

    const formData = await request.formData();
    const result = await extractLabelFromFormData(formData, { logger: console });
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status }
      );
    }
    return NextResponse.json({ label: result.label, evaluation: result.evaluation });
  }

  const requestContentType =
    request.headers.get("content-type") ?? "application/octet-stream";
  const body = await request.arrayBuffer();
  const response = await fetch(verifyImageUrl, {
    method: "POST",
    headers: { "content-type": requestContentType },
    body,
  });

  const responseContentType = response.headers.get("content-type") ?? "";
  if (responseContentType.includes("application/json")) {
    const payload = await response.json();
    return NextResponse.json(payload, { status: response.status });
  }

  const text = await response.text();
  return new NextResponse(text, {
    status: response.status,
    headers: { "content-type": responseContentType || "text/plain" },
  });
}
