import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { config } from "../config";

export const s3Client = new S3Client({ region: config.aws.region });

/**
 * Upload a buffer to S3 under the configured bucket.
 * Key format: uploads/<documentId>.pdf
 */
export async function uploadToS3(
  key: string,
  body: Buffer,
  contentType: string
): Promise<void> {
  await s3Client.send(
    new PutObjectCommand({
      Bucket: config.s3.bucketName,
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  );
}

/**
 * Download an object from S3 and return it as a Buffer.
 * Used by claim extraction to re-read an already-uploaded PDF.
 *
 * @throws if the object does not exist or S3 returns an error.
 */
export async function getFromS3(key: string): Promise<Buffer> {
  const result = await s3Client.send(
    new GetObjectCommand({
      Bucket: config.s3.bucketName,
      Key: key,
    })
  );

  if (!result.Body) {
    throw new Error(`S3 object '${key}' returned empty body.`);
  }

  // result.Body is a ReadableStream in the AWS SDK v3 Node.js runtime.
  const chunks: Uint8Array[] = [];
  for await (const chunk of result.Body as AsyncIterable<Uint8Array>) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}
