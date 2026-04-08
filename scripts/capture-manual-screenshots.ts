/**
 * 사용자 매뉴얼용 스크린샷 캡처 스크립트
 * Usage: npx tsx scripts/capture-manual-screenshots.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { chromium } from "playwright";
import { PrismaClient } from "@prisma/client";
import path from "path";

const BASE_URL = "http://localhost:3100";
const OUTPUT_DIR = path.join(process.cwd(), "public", "manual");

const prisma = new PrismaClient();

const MOCK_DRAFT_NOTICE = {
  sourceUrls: [
    "https://jira.fassto.ai/projects/FMS/versions/10234",
    "https://jira.fassto.ai/projects/OMS/versions/10235",
  ],
  items: [
    {
      id: "item-1",
      title: "주문 일괄 처리 기능 추가",
      description:
        "여러 주문을 선택하여 한 번에 처리할 수 있는 기능이 추가되었습니다. **주문 목록** 화면에서 체크박스로 여러 주문을 선택한 후 '일괄 처리' 버튼을 클릭하면 됩니다.",
      categoryId: null,
      sortOrder: 0,
      jiraTicketId: "FMS-1234",
      jiraTicketUrl: "https://jira.fassto.ai/browse/FMS-1234",
      slackLink: null,
      slackAuthor: null,
      screenshots: [],
      isOriginalText: false,
    },
    {
      id: "item-2",
      title: "재고 현황 대시보드 개선",
      description:
        "재고 현황 대시보드에 **실시간 그래프**가 추가되었습니다. 날짜별 입출고 추이를 한눈에 확인할 수 있으며, 필터를 적용하여 특정 상품군만 조회할 수 있습니다.",
      categoryId: null,
      sortOrder: 1,
      jiraTicketId: "FMS-1235",
      jiraTicketUrl: "https://jira.fassto.ai/browse/FMS-1235",
      slackLink: null,
      slackAuthor: null,
      screenshots: [],
      isOriginalText: false,
    },
    {
      id: "item-3",
      title: "배송 상태 알림 오류 수정",
      description:
        "일부 주문에서 배송 완료 알림이 중복 발송되던 문제가 수정되었습니다. 이제 배송 상태가 변경될 때 정확히 1회만 알림이 발송됩니다.",
      categoryId: null,
      sortOrder: 2,
      jiraTicketId: "FMS-1236",
      jiraTicketUrl: "https://jira.fassto.ai/browse/FMS-1236",
      slackLink: null,
      slackAuthor: null,
      screenshots: [],
      isOriginalText: false,
    },
    {
      id: "item-4",
      title: "출고 요청서 양식 변경",
      description:
        "출고 요청서의 양식이 새로운 디자인으로 변경되었습니다. 필수 항목이 상단에 배치되어 입력 편의성이 향상되었습니다.",
      categoryId: null,
      sortOrder: 3,
      jiraTicketId: "OMS-567",
      jiraTicketUrl: "https://jira.fassto.ai/browse/OMS-567",
      slackLink: null,
      slackAuthor: null,
      screenshots: [],
      isOriginalText: false,
    },
  ],
  createdAt: new Date().toISOString(),
};

async function injectSession(
  context: Awaited<ReturnType<typeof chromium.launch>>["contexts"][0]
) {
  const sessionToken = `manual-screenshot-${Date.now()}`;
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);

  const user = await prisma.user.upsert({
    where: { email: "albert.rim@fassto.com" },
    update: { name: "Albert Rim" },
    create: { email: "albert.rim@fassto.com", name: "Albert Rim" },
  });

  await prisma.session.create({
    data: { sessionToken, userId: user.id, expires },
  });

  await context.addCookies([
    {
      name: "authjs.session-token",
      value: sessionToken,
      domain: "localhost",
      path: "/",
      expires: Math.floor(expires.getTime() / 1000),
      httpOnly: true,
      sameSite: "Lax",
    },
    {
      name: "__Secure-authjs.session-token",
      value: sessionToken,
      domain: "localhost",
      path: "/",
      expires: Math.floor(expires.getTime() / 1000),
      httpOnly: true,
      secure: true,
      sameSite: "Lax",
    },
  ]);

  return { sessionToken, userId: user.id };
}

async function seedCategories() {
  const categories = [
    { name: "신규 기능", sortOrder: 0 },
    { name: "기능 개선", sortOrder: 1 },
    { name: "UI/UX 변경", sortOrder: 2 },
    { name: "버그 수정", sortOrder: 3 },
  ];

  const result: { id: string; name: string }[] = [];
  for (const cat of categories) {
    const c = await prisma.category.upsert({
      where: { name: cat.name },
      update: { sortOrder: cat.sortOrder },
      create: cat,
    });
    result.push({ id: c.id, name: c.name });
  }
  return result;
}

async function seedHistory(userId: string) {
  // 기존 테스트 이력 정리
  await prisma.sendHistory.deleteMany({
    where: { userId, title: { startsWith: "[공지]" } },
  });

  const histories = [
    {
      userId,
      title: "[공지] 2026년 4월 7일, FMS 업데이트 안내",
      senderName: "IT개발본부",
      recipients: JSON.stringify([
        "ops-team@fassto.com",
        "cs-team@fassto.com",
      ]),
      status: "SUCCESS",
      contentSnapshot: JSON.stringify([
        {
          title: "주문 일괄 처리 기능 추가",
          description: "여러 주문을 선택하여 한 번에 처리할 수 있는 기능이 추가되었습니다.",
          categoryName: "신규 기능",
          screenshots: [],
          slackLink: null,
          slackAuthor: null,
        },
      ]),
      sourceUrls: JSON.stringify([
        "https://jira.fassto.ai/projects/FMS/versions/10234",
      ]),
      sentAt: new Date("2026-04-07T10:30:00Z"),
    },
    {
      userId,
      title: "[공지] 2026년 4월 4일, FMS 업데이트 안내",
      senderName: "IT개발본부",
      recipients: JSON.stringify([
        "ops-team@fassto.com",
        "cs-team@fassto.com",
        "wh-team@fassto.com",
      ]),
      status: "SUCCESS",
      contentSnapshot: JSON.stringify([
        {
          title: "재고 현황 대시보드 개선",
          description: "재고 현황 대시보드에 실시간 그래프가 추가되었습니다.",
          categoryName: "기능 개선",
          screenshots: [],
          slackLink: null,
          slackAuthor: null,
        },
      ]),
      sourceUrls: JSON.stringify([
        "https://jira.fassto.ai/projects/FMS/versions/10233",
      ]),
      sentAt: new Date("2026-04-04T14:00:00Z"),
    },
    {
      userId,
      title: "[공지] 2026년 4월 1일, FMS 업데이트 안내",
      senderName: "IT개발본부",
      recipients: JSON.stringify(["all-staff@fassto.com"]),
      status: "FAILED",
      contentSnapshot: JSON.stringify([
        {
          title: "배송 상태 알림 오류 수정",
          description: "배송 완료 알림 중복 발송 문제가 수정되었습니다.",
          categoryName: "버그 수정",
          screenshots: [],
          slackLink: null,
          slackAuthor: null,
        },
      ]),
      sourceUrls: JSON.stringify([
        "https://jira.fassto.ai/projects/FMS/versions/10232",
      ]),
      sentAt: new Date("2026-04-01T09:00:00Z"),
    },
  ];

  const created: string[] = [];
  for (const h of histories) {
    const record = await prisma.sendHistory.create({ data: h });
    created.push(record.id);
  }
  return created;
}

async function main() {
  console.log("📸 매뉴얼 스크린샷 캡처 시작...\n");

  const categories = await seedCategories();
  console.log("✅ 카테고리 시드 완료");

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    locale: "ko-KR",
  });

  async function navigateAndCapture(
    page: Awaited<ReturnType<typeof context.newPage>>,
    url: string,
    filename: string,
  ) {
    await page.goto(url, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
    const currentUrl = page.url();
    console.log(`  → URL: ${currentUrl}`);
    await page.screenshot({ path: `${OUTPUT_DIR}/${filename}`, fullPage: true });
  }

  // 단일 페이지 사용 (sessionStorage 및 쿠키 유지)
  const page = await context.newPage();

  // ── 1. 로그인 페이지 ──
  console.log("📸 1/6 로그인 페이지...");
  await navigateAndCapture(page, `${BASE_URL}/login`, "01-login.png");

  // ── 인증 세션 주입 ──
  const { sessionToken, userId } = await injectSession(context);
  console.log("✅ 세션 주입 완료");

  // ── 히스토리 시드 ──
  const historyIds = await seedHistory(userId);
  console.log("✅ 히스토리 시드 완료");

  // ── 2. 대시보드 ──
  console.log("📸 2/6 대시보드...");
  await navigateAndCapture(page, `${BASE_URL}/dashboard`, "02-dashboard.png");

  // ── 3. JIRA URL 입력 ──
  console.log("📸 3/6 JIRA URL 입력...");
  await page.goto(`${BASE_URL}/notice/new`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);
  if (page.url().includes("/login")) {
    console.log("  ⚠️  세션 만료됨, 재주입...");
    await injectSession(context);
    await page.goto(`${BASE_URL}/notice/new`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
  }
  console.log(`  → URL: ${page.url()}`);
  await page.locator('input[type="text"]').first().fill(
    "https://jira.fassto.ai/projects/FMS/versions/10234"
  );
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUTPUT_DIR}/03-url-input.png`, fullPage: true });

  // ── sessionStorage에 mock data 주입 ──
  const draftWithCategories = {
    ...MOCK_DRAFT_NOTICE,
    items: MOCK_DRAFT_NOTICE.items.map((item, i) => ({
      ...item,
      categoryId: categories[i % categories.length].id,
    })),
  };
  await page.evaluate((draft) => {
    sessionStorage.setItem("draftNotice", JSON.stringify(draft));
  }, draftWithCategories);

  // ── 4. 초안 편집 ──
  console.log("📸 4/6 초안 편집...");
  await navigateAndCapture(page, `${BASE_URL}/notice/draft/edit`, "04-draft-edit.png");

  // ── 5. 발송 준비 (이메일 미리보기) ──
  console.log("📸 5/6 발송 준비...");
  await page.evaluate((draft) => {
    sessionStorage.setItem("draftNotice", JSON.stringify(draft));
  }, draftWithCategories);
  await navigateAndCapture(page, `${BASE_URL}/notice/draft/send`, "05-send-preview.png");

  // ── 6. 발송 이력 상세 ──
  console.log("📸 6/6 발송 이력 상세...");
  await page.goto(`${BASE_URL}/history/${historyIds[0]}`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("text=발송 이력 상세", { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(2000);
  console.log(`  → URL: ${page.url()}`);
  await page.screenshot({ path: `${OUTPUT_DIR}/06-history-detail.png`, fullPage: true });

  await page.close();

  // ── 정리 ──
  await browser.close();
  await prisma.session.deleteMany({ where: { sessionToken } });
  // 시드된 히스토리는 남겨둬도 무방 (실제 데이터 아님)
  for (const id of historyIds) {
    await prisma.sendHistory.delete({ where: { id } }).catch(() => {});
  }
  await prisma.$disconnect();

  console.log("\n✅ 모든 스크린샷 캡처 완료! public/manual/ 폴더를 확인하세요.");
}

main().catch((e) => {
  console.error("❌ 캡처 실패:", e);
  prisma.$disconnect();
  process.exit(1);
});
