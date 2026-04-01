import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isValidJiraReleaseUrl } from "@/lib/utils";
import { JiraService, JiraError } from "@/services/jira.service";
import { AiTransformService } from "@/services/ai-transform.service";
import type { AnalyzeRequest } from "@/types";

export async function POST(request: Request) {
  const session = await auth();
  if (!session) {
    return NextResponse.json(
      { error: "UNAUTHORIZED", message: "로그인이 필요합니다." },
      { status: 401 }
    );
  }

  try {
    const body: AnalyzeRequest = await request.json();

    if (!body.urls || body.urls.length === 0) {
      return NextResponse.json(
        { error: "MISSING_URLS", message: "JIRA Release Note URL을 입력해주세요." },
        { status: 400 }
      );
    }

    const invalidUrls = body.urls
      .map((url, i) => (!isValidJiraReleaseUrl(url) ? `urls[${i}]: 잘못된 형식` : null))
      .filter(Boolean);

    if (invalidUrls.length > 0) {
      return NextResponse.json(
        {
          error: "INVALID_URL",
          message: "유효한 JIRA Release Note URL을 입력해주세요.",
          details: invalidUrls,
        },
        { status: 400 }
      );
    }

    const uniqueUrls = [...new Set(body.urls)];
    if (uniqueUrls.length !== body.urls.length) {
      return NextResponse.json(
        { error: "DUPLICATE_URL", message: "동일한 URL이 중복 입력되었습니다." },
        { status: 400 }
      );
    }

    const jiraService = new JiraService();
    const tickets = await jiraService.fetchReleaseTickets(uniqueUrls);

    console.log(`[Analyze] Fetched ${tickets.length} tickets from JIRA`);
    for (const t of tickets) {
      console.log(`[Analyze] Ticket ${t.key}: slack=${t.slackLink || "none"}, slackAuthor=${t.slackAuthor || "none"}`);
    }

    const aiService = new AiTransformService();
    const items = await aiService.transformTickets(tickets);

    // AI가 반환한 category 이름을 DB category ID로 매핑
    const categories = await prisma.category.findMany();
    const categoryMap = new Map(categories.map((c) => [c.name, c.id]));

    for (const item of items) {
      if (item.categoryId && !item.categoryId.includes("-")) {
        // categoryId에 카테고리 이름이 들어있으면 DB ID로 변환
        const dbId = categoryMap.get(item.categoryId);
        item.categoryId = dbId || null;
      }
    }

    const aiSuccessCount = items.filter((i) => !i.isOriginalText).length;
    console.log(`[Analyze] AI transform: ${aiSuccessCount}/${items.length} succeeded`);
    for (const item of items) {
      console.log(`[Analyze] Item ${item.jiraTicketId}: slackLink=${item.slackLink ? "yes" : "none"}, slackAuthor=${item.slackAuthor || "none"}`);
    }

    return NextResponse.json({ items });
  } catch (error) {
    if (error instanceof JiraError) {
      const statusMap: Record<string, number> = {
        RELEASE_NOT_FOUND: 404,
        INVALID_URL: 400,
        NO_TICKETS: 404,
        JIRA_CONNECTION_FAILED: 502,
      };
      return NextResponse.json(
        { error: error.code, message: error.message },
        { status: statusMap[error.code] || 500 }
      );
    }
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요." },
      { status: 500 }
    );
  }
}
