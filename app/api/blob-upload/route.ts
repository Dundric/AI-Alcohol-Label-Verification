import { NextResponse } from "next/server";
import crypto from "crypto";
import { createUploadSasUrl } from "@/lib/azureBlob";

export const runtime = "nodejs";

const EXTENSION_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
};

function resolveExtension(fileName?: string, contentType?: string): string {
  if (fileName && fileName.includes(".")) {
    const raw = fileName.split(".").pop() ?? "";
    const cleaned = raw.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (cleaned) {
      return `.${cleaned}`;
    }
  }

  if (contentType) {
    const mapped = EXTENSION_BY_TYPE[contentType.toLowerCase()];
    if (mapped) {
      return `.${mapped}`;
    }
  }

  return "";
}

export async function POST(request: Request) {
  let payload: { fileName?: string; contentType?: string } = {};
  try {
    payload = (await request.json()) ?? {};
  } catch {
    payload = {};
  }

  const extension = resolveExtension(payload.fileName, payload.contentType);
  const blobName = `uploads/${crypto.randomUUID()}${extension}`;

  try {
    const { uploadUrl, blobUrl } = await createUploadSasUrl({ blobName });
    return NextResponse.json({ uploadUrl, blobUrl, blobName });
  } catch (error) {
    console.error("[blob-upload] failed to create SAS", error);
    return NextResponse.json(
      { error: "Failed to create upload URL" },
      { status: 500 }
    );
  }
}
