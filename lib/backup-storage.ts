import { GetObjectCommand, ListObjectsV2Command, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

// Off-site backup storage: a SECOND S3-compatible store, separate from the
// live asset bucket, that holds the full backup — snapshot data plus a copy
// of every media file — so a loss of the database or the live bucket does
// not take the backups with it. Configured for Oracle Cloud Object Storage
// (Always Free tier) via environment variables; when they are absent the
// backup simply runs without the off-site copy, exactly as before.
//
//   BACKUP_S3_ENDPOINT         e.g. https://<namespace>.compat.objectstorage.us-chicago-1.oraclecloud.com
//   BACKUP_S3_REGION           e.g. us-chicago-1
//   BACKUP_S3_ACCESS_KEY_ID    the storage access key id (a Customer Secret Key on Oracle)
//   BACKUP_S3_SECRET_ACCESS_KEY
//   BACKUP_S3_BUCKET           e.g. ttc-gamelab-backups

export type BackupMediaStorage = {
  listKeys: (prefix: string) => Promise<string[]>;
  put: (key: string, body: string | Uint8Array, contentType: string) => Promise<void>;
  get: (key: string) => Promise<{ bytes: Uint8Array; contentType: string } | null>;
};

export const BACKUP_ASSET_PREFIX = "backups/assets/";

export function backupAssetKey(storageKey: string) {
  return BACKUP_ASSET_PREFIX + storageKey;
}

export function getBackupMediaStorage(): BackupMediaStorage | null {
  const endpoint = process.env.BACKUP_S3_ENDPOINT;
  const region = process.env.BACKUP_S3_REGION;
  const accessKeyId = process.env.BACKUP_S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.BACKUP_S3_SECRET_ACCESS_KEY;
  const bucket = process.env.BACKUP_S3_BUCKET;
  if (!endpoint || !region || !accessKeyId || !secretAccessKey || !bucket) return null;
  const client = new S3Client({
    endpoint,
    region,
    forcePathStyle: true,
    credentials: { accessKeyId, secretAccessKey },
  });
  return {
    listKeys: async prefix => {
      const keys: string[] = [];
      let continuationToken: string | undefined;
      do {
        const listed = await client.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix, ContinuationToken: continuationToken }));
        for (const item of listed.Contents ?? []) if (item.Key) keys.push(item.Key);
        continuationToken = listed.IsTruncated ? listed.NextContinuationToken : undefined;
      } while (continuationToken);
      return keys;
    },
    put: async (key, body, contentType) => {
      await client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: contentType || "application/octet-stream" }));
    },
    get: async key => {
      try {
        const out = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
        const bytes = out.Body ? await out.Body.transformToByteArray() : new Uint8Array();
        return { bytes, contentType: out.ContentType || "application/octet-stream" };
      } catch {
        return null;
      }
    },
  };
}
