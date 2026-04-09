import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { v4 as uuidv4 } from "uuid";
import { upload } from "@/lib/storage";

const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"];
const MAX_SIZE = 4 * 1024 * 1024; // 4MB

export async function POST(request: Request) {
  const session = await auth();
  if (!session) {
    return NextResponse.json(
      { error: "UNAUTHORIZED", message: "로그인이 필요합니다." },
      { status: 401 }
    );
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "NO_FILE", message: "파일을 선택해주세요." },
        { status: 400 }
      );
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "INVALID_TYPE", message: "PNG, JPG, GIF, WEBP 형식만 지원합니다." },
        { status: 400 }
      );
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: "TOO_LARGE", message: "파일 크기는 최대 4MB입니다." },
        { status: 400 }
      );
    }

    const ext = file.name.split(".").pop() || "png";
    const key = `${uuidv4()}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const url = await upload(key, buffer, file.type);

    return NextResponse.json({ url });
  } catch (error) {
    console.error("[UPLOAD_FAILED]", error);
    return NextResponse.json(
      { error: "UPLOAD_FAILED", message: "파일 업로드에 실패했습니다." },
      { status: 500 }
    );
  }
}
