import { createLocalStorage } from "@/lib/storage/localStorage";
import { createS3Storage } from "@/lib/storage/s3Storage";

// Driver-agnostic file store. Keys are produced only by the attachments
// service (`<tenantId>/<entity>/<entityId>/<uuid>-<name>`), never by a client.
export interface FileStorage {
  put(key: string, bytes: Uint8Array, contentType: string): Promise<void>;
  get(key: string): Promise<Uint8Array>;
}

// STORAGE_DRIVER=local (default): files on disk under STORAGE_LOCAL_DIR —
// a Docker volume in docker-compose. STORAGE_DRIVER=s3: any S3-compatible
// bucket (AWS S3, MinIO, Cloudflare R2). The S3 driver uses
// bucket-scoped S3 access keys, never the database owner credentials
// (non-negotiable rule 4: privileged roles are for migrations only).
export function getStorage(env: NodeJS.ProcessEnv = process.env): FileStorage {
  const driver = env.STORAGE_DRIVER ?? "local";
  if (driver === "local") {
    return createLocalStorage(env.STORAGE_LOCAL_DIR);
  }
  if (driver === "s3") {
    const endpoint = env.S3_ENDPOINT;
    const bucket = env.S3_BUCKET;
    const accessKeyId = env.S3_ACCESS_KEY_ID;
    const secretAccessKey = env.S3_SECRET_ACCESS_KEY;
    if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) {
      throw new Error("STORAGE_DRIVER=s3 requiere S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY_ID y S3_SECRET_ACCESS_KEY");
    }
    return createS3Storage({ endpoint, bucket, accessKeyId, secretAccessKey, region: env.S3_REGION ?? "us-east-1" });
  }
  throw new Error(`STORAGE_DRIVER desconocido: ${driver}`);
}
