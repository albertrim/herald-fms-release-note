import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.json(
      { error: "UNAUTHORIZED", message: "로그인이 필요합니다." },
      { status: 401 }
    );
  }

  const histories = await prisma.sendHistory.findMany({
    orderBy: { sentAt: "desc" },
    select: {
      id: true,
      title: true,
      senderName: true,
      recipients: true,
      status: true,
      sentAt: true,
    },
  });

  const items = histories.map((h) => ({
    id: h.id,
    title: h.title,
    senderName: h.senderName,
    recipientCount: (JSON.parse(h.recipients) as string[]).length,
    status: h.status,
    sentAt: h.sentAt.toISOString(),
  }));

  // 가장 최근 성공 발송의 수신자 목록
  const latestSuccess = await prisma.sendHistory.findFirst({
    where: { status: "SUCCESS" },
    orderBy: { sentAt: "desc" },
    select: { recipients: true },
  });
  const lastRecipients: string[] = latestSuccess
    ? JSON.parse(latestSuccess.recipients)
    : [];

  return NextResponse.json({ items, lastRecipients });
}
