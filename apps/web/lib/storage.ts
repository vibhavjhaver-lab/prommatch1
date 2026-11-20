import { randomUUID } from "node:crypto";
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import sharp from "sharp";
import { getEnv } from "./env.js";

function client() {
  const env = getEnv();
  return new S3Client({
    endpoint: env.S3_ENDPOINT,
    region: "auto",
    credentials: { accessKeyId: env.S3_ACCESS_KEY, secretAccessKey: env.S3_SECRET_KEY },
    forcePathStyle: true, // required for MinIO
  });
}

export async function getUploadUrl(userId: string, contentType: string) {
  const env = getEnv();
  const key = `uploads/${userId}/${randomUUID()}`;
  const url = await getSignedUrl(
    client(),
    new PutObjectCommand({ Bucket: env.S3_BUCKET, Key: key, ContentType: contentType }),
    { expiresIn: 300 },
  );
  return { uploadUrl: url, key };
}

/**
 * Downloads the just-uploaded raw file, strips EXIF (GPS included) by
 * re-encoding through sharp (which drops metadata unless you ask it to
 * keep it), resizes to 1080px and a 320px thumbnail, both WebP, and
 * deletes the raw original. Spec section 11, Moderation pipeline step 4.
 */
export async function confirmUpload(rawKey: string): Promise<{ finalKey: string; thumbKey: string }> {
  const env = getEnv();
  const s3 = client();

  const raw = await s3.send(new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: rawKey }));
  const bytes = await raw.Body?.transformToByteArray();
  if (!bytes) throw new Error(`Upload not found: ${rawKey}`);

  const full = await sharp(Buffer.from(bytes)).rotate().resize({ width: 1080, withoutEnlargement: true }).webp({ quality: 85 }).toBuffer();
  const thumb = await sharp(Buffer.from(bytes)).rotate().resize({ width: 320, withoutEnlargement: true }).webp({ quality: 80 }).toBuffer();

  const finalKey = rawKey.replace("uploads/", "photos/") + "-1080.webp";
  const thumbKey = rawKey.replace("uploads/", "photos/") + "-320.webp";

  await s3.send(new PutObjectCommand({ Bucket: env.S3_BUCKET, Key: finalKey, Body: full, ContentType: "image/webp" }));
  await s3.send(new PutObjectCommand({ Bucket: env.S3_BUCKET, Key: thumbKey, Body: thumb, ContentType: "image/webp" }));
  await s3.send(new DeleteObjectCommand({ Bucket: env.S3_BUCKET, Key: rawKey }));

  return { finalKey, thumbKey };
}

/** Signed GET URL, expires in 10 minutes — spec section 11, Security baseline. */
export async function getSignedPhotoUrl(key: string): Promise<string> {
  const env = getEnv();
  return getSignedUrl(client(), new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: key }), { expiresIn: 600 });
}

export async function deleteObject(key: string): Promise<void> {
  const env = getEnv();
  await client().send(new DeleteObjectCommand({ Bucket: env.S3_BUCKET, Key: key }));
}
