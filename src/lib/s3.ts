import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";

const s3 = new S3Client({
  region: process.env.AWS_REGION || "ap-northeast-2",
});

const BUCKET = process.env.S3_BUCKET!;
const PREFIX = process.env.S3_PREFIX || "uploads";

export async function uploadToS3(
  key: string,
  body: Buffer,
  contentType: string
): Promise<string> {
  const objectKey = `${PREFIX}/${key}`;

  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: objectKey,
      Body: body,
      ContentType: contentType,
    })
  );

  return `https://${BUCKET}.s3.${process.env.AWS_REGION || "ap-northeast-2"}.amazonaws.com/${objectKey}`;
}

export async function deleteFromS3(url: string): Promise<void> {
  const objectKey = url.split(".amazonaws.com/")[1];
  if (!objectKey) return;

  await s3.send(
    new DeleteObjectCommand({
      Bucket: BUCKET,
      Key: objectKey,
    })
  );
}
