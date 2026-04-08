import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const PAGE_SIZE = 10;

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "UNAUTHORIZED", message: "로그인이 필요합니다." },
      { status: 401 }
    );
  }

  const { searchParams } = request.nextUrl;
  const page = Math.max(1, Number(searchParams.get("page")) || 1);

  const userId = session.user.id;

  const [histories, totalCount, latestSuccess] = await Promise.all([
    prisma.sendHistory.findMany({
      where: { userId },
      orderBy: { sentAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        title: true,
        senderName: true,
        recipients: true,
        status: true,
        sentAt: true,
      },
    }),
    prisma.sendHistory.count({ where: { userId } }),
    // 첫 페이지에서만 lastRecipients 조회
    page === 1
      ? prisma.sendHistory.findFirst({
          where: { userId, status: "SUCCESS" },
          orderBy: { sentAt: "desc" },
          select: { recipients: true },
        })
      : null,
  ]);

  const items = histories.map((h) => ({
    id: h.id,
    title: h.title,
    senderName: h.senderName,
    recipientCount: (JSON.parse(h.recipients) as string[]).length,
    status: h.status,
    sentAt: h.sentAt.toISOString(),
  }));

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
  const lastRecipients: string[] = latestSuccess
    ? JSON.parse(latestSuccess.recipients)
    : [];

  return NextResponse.json({
    items,
    lastRecipients,
    pagination: {
      page,
      pageSize: PAGE_SIZE,
      totalCount,
      totalPages,
    },
  });
}
