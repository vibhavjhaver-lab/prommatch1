import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getEnv } from "../env.js";

function client() {
  const env = getEnv();
  return new S3Client({
    endpoint: env.S3_ENDPOINT,
    region: "auto",
    credentials: { accessKeyId: env.S3_ACCESS_KEY, secretAccessKey: env.S3_SECRET_KEY },
    forcePathStyle: true,
  });
}

/** Uploads a data-export zip and returns a signed download link, valid for 24h. */
export async function uploadExportAndSign(key: string, body: Buffer): Promise<string> {
  const env = getEnv();
  await client().send(
    new PutObjectCommand({ Bucket: env.S3_BUCKET, Key: key, Body: body, ContentType: "application/zip" }),
  );
  return getSignedUrl(client(), new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: key }), {
    expiresIn: 60 * 60 * 24,
  });
}
