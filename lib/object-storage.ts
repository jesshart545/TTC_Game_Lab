import { DeleteObjectCommand, DeleteObjectsCommand, GetObjectCommand, HeadObjectCommand, ListObjectsV2Command, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
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

export async function putAsset(key: string, body: string | Uint8Array, contentType: string) {
  await getAssetStorage().send(new PutObjectCommand({
    Bucket: ASSET_BUCKET,
    Key: key,
    Body: body,
    ContentType: contentType || "application/octet-stream",
  }));
}

export async function deleteAsset(key: string) {
  await getAssetStorage().send(new DeleteObjectCommand({
    Bucket: ASSET_BUCKET,
    Key: key,
  }));
}

export async function getAssetUploadUrl(key: string, contentType: string, expiresIn = 60 * 10) {
  return getSignedUrl(
    getAssetStorage(),
    new PutObjectCommand({ Bucket: ASSET_BUCKET, Key: key, ContentType: contentType || "application/octet-stream" }),
    { expiresIn },
  );
}

export async function getAssetUrl(key: string, expiresIn = 60 * 60 * 24 * 7) {
  return getSignedUrl(
    getAssetStorage(),
    new GetObjectCommand({ Bucket: ASSET_BUCKET, Key: key }),
    { expiresIn },
  );
}


export async function deleteAssetsByPrefix(prefix: string) {
  const storage = getAssetStorage();
  let continuationToken: string | undefined;
  let deleted = 0;
  do {
    const listed = await storage.send(new ListObjectsV2Command({
      Bucket: ASSET_BUCKET,
      Prefix: prefix,
      ContinuationToken: continuationToken,
    }));
    const objects = (listed.Contents || []).flatMap(item => item.Key ? [{ Key: item.Key }] : []);
    if (objects.length) {
      await storage.send(new DeleteObjectsCommand({
        Bucket: ASSET_BUCKET,
        Delete: { Objects: objects, Quiet: true },
      }));
      deleted += objects.length;
    }
    continuationToken = listed.IsTruncated ? listed.NextContinuationToken : undefined;
  } while (continuationToken);
  return deleted;
}

export async function getAssetBytes(key: string): Promise<{ bytes: Uint8Array; contentType: string }> {
  const out = await getAssetStorage().send(new GetObjectCommand({ Bucket: ASSET_BUCKET, Key: key }));
  const bytes = out.Body ? await out.Body.transformToByteArray() : new Uint8Array();
  return { bytes, contentType: out.ContentType || "application/octet-stream" };
}

export async function assetExists(key: string): Promise<boolean> {
  try {
    await getAssetStorage().send(new HeadObjectCommand({ Bucket: ASSET_BUCKET, Key: key }));
    return true;
  } catch {
    return false;
  }
}
