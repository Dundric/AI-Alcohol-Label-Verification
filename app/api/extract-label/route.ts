import { NextResponse } from "next/server";
import { extractLabelFromFormData } from "@/lib/extraction";

export const runtime = "nodejs";

function getVerifyImageUrl(): string | null {
  return process.env.AZURE_FUNCTION_VERIFY_IMAGE_URL ?? null;
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const verifyImageUrl = getVerifyImageUrl();

  if (!verifyImageUrl) {
    const result = await extractLabelFromFormData(formData, { logger: console });
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status }
      );
    }
    return NextResponse.json({ label: result.label, evaluation: result.evaluation });
  }

  const response = await fetch(verifyImageUrl, {
    method: "POST",
    body: formData,
  });

  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const payload = await response.json();
    return NextResponse.json(payload, { status: response.status });
  }

  const text = await response.text();
  return new NextResponse(text, {
    status: response.status,
    headers: { "content-type": contentType || "text/plain" },
  });
}
