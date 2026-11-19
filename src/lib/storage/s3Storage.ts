import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import type { FileStorage } from "@/lib/storage/storage";
import { assertSafeKey } from "@/lib/storage/storageKey";

export type S3StorageConfig = {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
};

export function createS3Storage(config: S3StorageConfig): FileStorage {
  // Path-style addressing: required by Supabase Storage's S3 endpoint and
  // MinIO; AWS S3 accepts it too.
  const client = new S3Client({
    endpoint: config.endpoint,
    region: config.region,
    forcePathStyle: true,
    credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
  });

  return {
    async put(key, bytes, contentType) {
      assertSafeKey(key);
      await client.send(
        new PutObjectCommand({ Bucket: config.bucket, Key: key, Body: bytes, ContentType: contentType }),
      );
    },
    async get(key) {
      assertSafeKey(key);
      const response = await client.send(new GetObjectCommand({ Bucket: config.bucket, Key: key }));
      if (!response.Body) {
        throw new Error(`Objeto vacío en almacenamiento: ${key}`);
      }
      return response.Body.transformToByteArray();
    },
  };
}
