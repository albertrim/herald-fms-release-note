import path from "path";
import { writeFile, mkdir } from "fs/promises";

const useS3 = !!process.env.S3_BUCKET;

async function uploadLocal(
  key: string,
  body: Buffer,
): Promise<string> {
  const uploadDir = path.join(process.cwd(), "public", "uploads");
  await mkdir(uploadDir, { recursive: true });
  await writeFile(path.join(uploadDir, key), body);
  return `/uploads/${key}`;
}

async function uploadS3(
  key: string,
  body: Buffer,
  contentType: string,
): Promise<string> {
  const { uploadToS3 } = await import("@/lib/s3");
  return uploadToS3(key, body, contentType);
}

export async function upload(
  key: string,
  body: Buffer,
  contentType: string,
): Promise<string> {
  if (useS3) {
    return uploadS3(key, body, contentType);
  }
  return uploadLocal(key, body);
}
