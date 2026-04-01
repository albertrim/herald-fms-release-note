import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const session = await auth();
  if (!session) {
    return NextResponse.json(
      { error: "UNAUTHORIZED", message: "로그인이 필요합니다." },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q") || "";

  const recipients = await prisma.recipientHistory.findMany({
    where: query ? { email: { contains: query } } : undefined,
    orderBy: { usedCount: "desc" },
    take: 10,
    select: { email: true, usedCount: true },
  });

  return NextResponse.json({ recipients });
}
