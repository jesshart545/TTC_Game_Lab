import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export const ASSET_BUCKET = "ttcgamelab";

export function getAssetStorage() {
  const endpoint = process.env.AWS_ENDPOINT_URL_S3;
  const region = process.env.AWS_REGION;
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  if (!endpoint || !region || !accessKeyId || !secretAccessKey) {
    throw new Error("Neon Object Storage is not configured.");
  }
  return new S3Client({
    endpoint,
    region,
    forcePathStyle: true,
    credentials: { accessKeyId, secretAccessKey },
  });
}

export async function putAsset(key: string, body: Uint8Array, contentType: string) {
  await getAssetStorage().send(new PutObjectCommand({
    Bucket: ASSET_BUCKET,
    Key: key,
    Body: body,
    ContentType: contentType || "application/octet-stream",
  }));
}

export async function getAssetUrl(key: string, expiresIn = 60 * 60 * 24 * 7) {
  return getSignedUrl(
    getAssetStorage(),
    new GetObjectCommand({ Bucket: ASSET_BUCKET, Key: key }),
    { expiresIn },
  );
}
