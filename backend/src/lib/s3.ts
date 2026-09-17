import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
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
