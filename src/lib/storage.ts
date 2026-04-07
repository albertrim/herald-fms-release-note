import { put, del } from "@vercel/blob";

export async function upload(
  key: string,
  body: Buffer,
  contentType: string,
): Promise<string> {
  const { url } = await put(`uploads/${key}`, body, {
    access: "public",
    contentType,
  });
  return url;
}

export async function deleteFile(url: string): Promise<void> {
  await del(url);
}
