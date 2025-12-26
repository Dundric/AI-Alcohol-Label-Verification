import {
  BlobServiceClient,
  StorageSharedKeyCredential,
  generateBlobSASQueryParameters,
  BlobSASPermissions,
} from "@azure/storage-blob";
import { Readable } from "stream";

export const runtime = "nodejs";

const RETRYABLE = new Set(["EPIPE", "ECONNRESET", "ETIMEDOUT", "ESOCKETTIMEDOUT"]);
const BLOCK_SIZE = 1024 * 1024; // 1MB
const MAX_CONCURRENCY = 2;

function getStorageAccountCredentials(conn: string) {
  const accountName = conn.match(/AccountName=([^;]+)/)?.[1];
  const accountKey = conn.match(/AccountKey=([^;]+)/)?.[1];
  if (!accountName || !accountKey) {
    throw new Error("Invalid Azure Storage connection string");
  }
  return { accountName, accountKey };
}

async function uploadDataRobust(blockBlob: any, buffer: Buffer, contentType: string) {
  let attempt = 0;
  let lastErr: any;

  while (attempt < 4) {
    try {
      const stream = Readable.from(buffer);
      return await blockBlob.uploadStream(stream, BLOCK_SIZE, MAX_CONCURRENCY, {
        blobHTTPHeaders: { blobContentType: contentType },
      });
    } catch (err: any) {
      lastErr = err;
      const code = err?.code ?? err?.name;
      if (!RETRYABLE.has(code)) throw err;

      attempt++;
      await new Promise((r) => setTimeout(r, 250 * attempt * attempt));
    }
  }

  throw lastErr;
}

export async function uploadAndGetSasUrl({
  buffer,
  contentType,
  blobName,
  expiresInMinutes = 3,
}: {
  buffer: Buffer;
  contentType: string;
  blobName: string;
  expiresInMinutes?: number;
}) {
  const conn = process.env.AZURE_STORAGE_CONNECTION_STRING!;
  const containerName = process.env.AZURE_STORAGE_CONTAINER_NAME!;

  const blobServiceClient = BlobServiceClient.fromConnectionString(conn, {
    retryOptions: {
      maxTries: 4,
      tryTimeoutInMs: 30000,
    },
  });
  const containerClient = blobServiceClient.getContainerClient(containerName);
  await containerClient.createIfNotExists();

  const blockBlob = containerClient.getBlockBlobClient(blobName);

  // ✅ robust upload
  await uploadDataRobust(blockBlob, buffer, contentType);

  // credentials from connection string (your current approach is fine)
  const { accountName, accountKey } = getStorageAccountCredentials(conn);
  const sharedKey = new StorageSharedKeyCredential(accountName, accountKey);

  const sas = generateBlobSASQueryParameters(
    {
      containerName,
      blobName,
      permissions: BlobSASPermissions.parse("r"),
      expiresOn: new Date(Date.now() + expiresInMinutes * 60 * 1000),
    },
    sharedKey
  ).toString();

  return `${blockBlob.url}?${sas}`;
}

export async function createUploadSasUrl({
  blobName,
  expiresInMinutes = 10,
}: {
  blobName: string;
  expiresInMinutes?: number;
}) {
  const conn = process.env.AZURE_STORAGE_CONNECTION_STRING!;
  const containerName = process.env.AZURE_STORAGE_CONTAINER_NAME!;

  const blobServiceClient = BlobServiceClient.fromConnectionString(conn, {
    retryOptions: {
      maxTries: 4,
      tryTimeoutInMs: 30000,
    },
  });
  const containerClient = blobServiceClient.getContainerClient(containerName);
  await containerClient.createIfNotExists();

  const blockBlob = containerClient.getBlockBlobClient(blobName);

  const { accountName, accountKey } = getStorageAccountCredentials(conn);
  const sharedKey = new StorageSharedKeyCredential(accountName, accountKey);

  const sas = generateBlobSASQueryParameters(
    {
      containerName,
      blobName,
      permissions: BlobSASPermissions.parse("cw"),
      expiresOn: new Date(Date.now() + expiresInMinutes * 60 * 1000),
    },
    sharedKey
  ).toString();

  return { uploadUrl: `${blockBlob.url}?${sas}`, blobUrl: blockBlob.url };
}
