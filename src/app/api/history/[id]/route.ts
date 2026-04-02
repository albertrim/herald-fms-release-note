import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json(
      { error: "UNAUTHORIZED", message: "로그인이 필요합니다." },
      { status: 401 }
    );
  }

  const { id } = await params;

  const history = await prisma.sendHistory.findUnique({ where: { id } });
  if (!history) {
    return NextResponse.json(
      { error: "NOT_FOUND", message: "발송 이력을 찾을 수 없습니다." },
      { status: 404 }
    );
  }

  await prisma.sendHistory.delete({ where: { id } });

  return NextResponse.json({ message: "삭제되었습니다." });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json(
      { error: "UNAUTHORIZED", message: "로그인이 필요합니다." },
      { status: 401 }
    );
  }

  const { id } = await params;

  const history = await prisma.sendHistory.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      senderName: true,
      recipients: true,
      status: true,
      sentAt: true,
      sourceUrls: true,
      contentSnapshot: true,
    },
  });

  if (!history) {
    return NextResponse.json(
      { error: "NOT_FOUND", message: "발송 이력을 찾을 수 없습니다." },
      { status: 404 }
    );
  }

  return NextResponse.json({
    id: history.id,
    title: history.title,
    senderName: history.senderName,
    recipients: JSON.parse(history.recipients),
    status: history.status,
    sentAt: history.sentAt.toISOString(),
    sourceUrls: JSON.parse(history.sourceUrls),
    contentSnapshot: JSON.parse(history.contentSnapshot),
  });
}
