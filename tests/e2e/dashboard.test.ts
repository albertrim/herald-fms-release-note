import { test, expect } from "@playwright/test";
import { injectSession, cleanupSession } from "./helpers/auth-helper";

test.describe("대시보드", () => {
  let sessionToken: string;

  test.beforeEach(async ({ page }) => {
    sessionToken = await injectSession(page);
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 });
  });

  test.afterEach(async () => {
    await cleanupSession(sessionToken);
  });

  test("대시보드 페이지가 표시된다", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "대시보드" })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "새 공지 생성" })
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "발송 이력" })
    ).toBeVisible();
  });

  test("'새 공지 생성' 클릭 시 URL 입력 페이지로 이동한다", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "새 공지 생성" }).click();
    await expect(page).toHaveURL(/\/notice\/new/, { timeout: 5000 });
  });

  test("헤더에 사용자 이름과 로그아웃 버튼이 표시된다", async ({ page }) => {
    await expect(page.getByText("Albert Rim")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "로그아웃" })
    ).toBeVisible();
  });

  test("로그아웃하면 로그인 페이지로 이동한다", async ({ page }) => {
    await page.getByRole("button", { name: "로그아웃" }).click();
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
  });
});
