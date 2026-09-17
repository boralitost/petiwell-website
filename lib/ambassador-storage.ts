import { createHash, randomBytes } from "crypto";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import {
  del as deleteBlob,
  issueSignedToken,
  presignUrl,
  put as putBlob
} from "@vercel/blob";
import { ambassadorConfig } from "@/lib/ambassador-config";
import { scanAmbassadorFile } from "@/lib/ambassador-scanner";

const ALLOWED_TYPES = new Map([
  ["application/pdf", "pdf"],
  ["image/jpeg", "jpg"],
  ["image/png", "png"]
]);

function storageConfig() {
  const endpoint = (process.env.AMBASSADOR_STORAGE_ENDPOINT || "").trim();
  const region = (process.env.AMBASSADOR_STORAGE_REGION || "auto").trim();
  const bucket = (process.env.AMBASSADOR_STORAGE_BUCKET || "").trim();
  const accessKeyId = (process.env.AMBASSADOR_STORAGE_ACCESS_KEY_ID || "").trim();
  const secretAccessKey = (
    process.env.AMBASSADOR_STORAGE_SECRET_ACCESS_KEY || ""
  ).trim();
  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) {
    throw new Error("ambassador_storage_not_configured");
  }
  return { endpoint, region, bucket, accessKeyId, secretAccessKey };
}

function client() {
  const config = storageConfig();
  return {
    bucket: config.bucket,
    s3: new S3Client({
      endpoint: config.endpoint,
      region: config.region,
      forcePathStyle: process.env.AMBASSADOR_STORAGE_FORCE_PATH_STYLE === "true",
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey
      }
    })
  };
}

function storageProvider() {
  const configured = (
    process.env.AMBASSADOR_STORAGE_PROVIDER || ""
  ).toLowerCase();
  if (configured === "vercel_blob" || configured === "s3") return configured;
  if (process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID) {
    return "vercel_blob";
  }
  return "s3";
}

function fileSignatureOk(buffer: Buffer, mimeType: string): boolean {
  if (mimeType === "application/pdf") {
    return buffer.subarray(0, 5).toString("ascii") === "%PDF-";
  }
  if (mimeType === "image/png") {
    return buffer.subarray(0, 8).equals(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    );
  }
  if (mimeType === "image/jpeg") {
    return (
      buffer.length >= 3 &&
      buffer[0] === 0xff &&
      buffer[1] === 0xd8 &&
      buffer[2] === 0xff
    );
  }
  return false;
}

function safeFileName(raw: string): string {
  return raw
    .normalize("NFKD")
    .replace(/[^\w.-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
}

export function validateAmbassadorFile(file: {
  name: string;
  type: string;
  size: number;
  buffer: Buffer;
}) {
  const extension = ALLOWED_TYPES.get(file.type);
  if (!extension) throw new Error("document_type_not_allowed");
  if (file.size < 1 || file.size > ambassadorConfig().maxDocumentBytes) {
    throw new Error("document_size_invalid");
  }
  if (!fileSignatureOk(file.buffer, file.type)) {
    throw new Error("document_signature_invalid");
  }
  return { extension, safeName: safeFileName(file.name) || `document.${extension}` };
}

export async function uploadPrivateAmbassadorFile(input: {
  ambassadorId: string;
  file: File;
  category: string;
}) {
  const buffer = Buffer.from(await input.file.arrayBuffer());
  const valid = validateAmbassadorFile({
    name: input.file.name,
    type: input.file.type,
    size: input.file.size,
    buffer
  });
  await scanAmbassadorFile(buffer, input.file.type);
  const key = [
    "ambassadors",
    input.ambassadorId,
    input.category.toLowerCase(),
    `${Date.now()}-${randomBytes(12).toString("hex")}.${valid.extension}`
  ].join("/");
  if (storageProvider() === "vercel_blob") {
    await putBlob(key, buffer, {
      access: "private",
      addRandomSuffix: false,
      contentType: input.file.type,
      cacheControlMaxAge: 60
    });
  } else {
    const { s3, bucket } = client();
    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: buffer,
        ContentType: input.file.type,
        ContentDisposition: `attachment; filename="${valid.safeName}"`,
        ServerSideEncryption: "AES256",
        Metadata: {
          sha256: createHash("sha256").update(buffer).digest("hex")
        }
      })
    );
  }
  return {
    storageKey: key,
    originalName: valid.safeName,
    mimeType: input.file.type,
    sizeBytes: buffer.length,
    sha256: createHash("sha256").update(buffer).digest("hex")
  };
}

export async function signedAmbassadorDocumentUrl(
  storageKey: string,
  expiresInSeconds = 300
) {
  if (storageProvider() === "vercel_blob") {
    const validUntil =
      Date.now() + Math.min(900, Math.max(30, expiresInSeconds)) * 1000;
    const token = await issueSignedToken({
      pathname: storageKey,
      operations: ["get"],
      validUntil
    });
    const result = await presignUrl(token, {
      pathname: storageKey,
      operation: "get",
      access: "private",
      validUntil
    });
    return result.presignedUrl;
  }
  const { s3, bucket } = client();
  return getSignedUrl(
    s3,
    new GetObjectCommand({ Bucket: bucket, Key: storageKey }),
    { expiresIn: Math.min(900, Math.max(30, expiresInSeconds)) }
  );
}

export async function deleteAmbassadorDocument(storageKey: string) {
  if (storageProvider() === "vercel_blob") {
    await deleteBlob(storageKey);
    return;
  }
  const { s3, bucket } = client();
  await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: storageKey }));
}
