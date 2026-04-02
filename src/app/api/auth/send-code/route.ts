import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import nodemailer from "nodemailer";

export async function POST(request: Request) {
  const { email } = await request.json();
  if (!email || !email.trim().toLowerCase().endsWith("@fassto.com")) {
    return NextResponse.json(
      { error: "INVALID_EMAIL", message: "@fassto.com 이메일만 사용할 수 있습니다." },
      { status: 400 }
    );
  }

  const normalizedEmail = email.trim().toLowerCase();

  // 이미 인증된 사용자면 바로 통과
  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (existing?.verified) {
    return NextResponse.json({ status: "ALREADY_VERIFIED" });
  }

  // 6자리 인증 코드 생성
  const code = String(Math.floor(100000 + Math.random() * 900000));

  // 사용자 생성 또는 업데이트
  await prisma.user.upsert({
    where: { email: normalizedEmail },
    update: { verificationCode: code },
    create: {
      email: normalizedEmail,
      name: normalizedEmail.split("@")[0],
      verified: false,
      verificationCode: code,
    },
  });

  // 이메일로 인증 코드 발송
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });

  await transporter.sendMail({
    from: `FASSTO Herald <${process.env.SMTP_USER}>`,
    to: normalizedEmail,
    subject: "[FASSTO Herald] 이메일 인증 코드",
    html: `
      <div style="font-family:sans-serif;max-width:400px;margin:0 auto;padding:32px;">
        <h2 style="color:#1e293b;margin-bottom:16px;">이메일 인증</h2>
        <p style="color:#475569;margin-bottom:24px;">아래 인증 코드를 입력해주세요.</p>
        <div style="background:#f1f5f9;border-radius:12px;padding:20px;text-align:center;font-size:32px;font-weight:700;letter-spacing:8px;color:#2563eb;">
          ${code}
        </div>
        <p style="color:#94a3b8;font-size:13px;margin-top:16px;">이 코드는 최초 1회만 필요합니다.</p>
      </div>
    `,
  });

  return NextResponse.json({ status: "CODE_SENT" });
}
