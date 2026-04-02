import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const { email, code } = await request.json();
  if (!email || !code) {
    return NextResponse.json(
      { error: "MISSING_FIELDS", message: "이메일과 인증 코드를 입력해주세요." },
      { status: 400 }
    );
  }

  const normalizedEmail = email.trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });

  if (!user || user.verificationCode !== code.trim()) {
    return NextResponse.json(
      { error: "INVALID_CODE", message: "인증 코드가 올바르지 않습니다." },
      { status: 400 }
    );
  }

  await prisma.user.update({
    where: { email: normalizedEmail },
    data: { verified: true, verificationCode: null },
  });

  return NextResponse.json({ status: "VERIFIED" });
}
