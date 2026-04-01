import { NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { isValidEmail } from "@/lib/utils";

export async function POST(request: Request) {
  try {
    const { email, password, name } = await request.json();

    if (!email || !password || !name) {
      return NextResponse.json(
        { error: "MISSING_FIELDS", message: "모든 필드를 입력해주세요." },
        { status: 400 }
      );
    }

    if (!isValidEmail(email)) {
      return NextResponse.json(
        { error: "INVALID_EMAIL", message: "유효한 이메일 주소를 입력해주세요." },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "WEAK_PASSWORD", message: "비밀번호는 최소 8자 이상이어야 합니다." },
        { status: 400 }
      );
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json(
        { error: "EMAIL_EXISTS", message: "이미 등록된 이메일 주소입니다." },
        { status: 409 }
      );
    }

    const passwordHash = await hash(password, 12);
    await prisma.user.create({
      data: { email, passwordHash, name, role: "USER" },
    });

    return NextResponse.json({ message: "회원가입이 완료되었습니다." }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
