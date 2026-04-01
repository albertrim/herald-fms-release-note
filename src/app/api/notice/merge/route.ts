import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { AiTransformService } from "@/services/ai-transform.service";

export async function POST(request: Request) {
  const session = await auth();
  if (!session) {
    return NextResponse.json(
      { error: "UNAUTHORIZED", message: "로그인이 필요합니다." },
      { status: 401 }
    );
  }

  try {
    const { items } = await request.json();

    if (!items || items.length < 2) {
      return NextResponse.json(
        { error: "INVALID_REQUEST", message: "2개 이상의 항목이 필요합니다." },
        { status: 400 }
      );
    }

    const aiService = new AiTransformService();
    const merged = await aiService.mergeItems(items);

    return NextResponse.json(merged);
  } catch {
    return NextResponse.json(
      { error: "MERGE_FAILED", message: "병합에 실패했습니다." },
      { status: 500 }
    );
  }
}
