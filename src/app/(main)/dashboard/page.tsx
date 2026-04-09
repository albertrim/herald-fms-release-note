import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DashboardClient } from "./dashboard-client";
import type { SendHistoryListItem } from "@/types";

const PAGE_SIZE = 10;

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const [, params] = await Promise.all([auth(), searchParams]);
  const page = Math.max(1, Number(params.page) || 1);

  const [histories, totalCount] = await Promise.all([
    prisma.sendHistory.findMany({
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
    prisma.sendHistory.count(),
  ]);

  const items: SendHistoryListItem[] = histories.map((h) => ({
    id: h.id,
    title: h.title,
    senderName: h.senderName,
    recipientCount: (JSON.parse(h.recipients) as string[]).length,
    status: h.status as "SUCCESS" | "FAILED",
    sentAt: h.sentAt.toISOString(),
  }));

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  return (
    <DashboardClient
      items={items}
      pagination={{ page, pageSize: PAGE_SIZE, totalCount, totalPages }}
    />
  );
}
