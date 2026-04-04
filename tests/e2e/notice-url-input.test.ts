import { test, expect } from "@playwright/test";
import { injectSession, cleanupSession } from "./helpers/auth-helper";

test.describe("URL 입력 페이지", () => {
  let sessionToken: string;

  test.beforeEach(async ({ page }) => {
    sessionToken = await injectSession(page);
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 });
    await page.getByRole("button", { name: "새 공지 생성" }).click();
    await expect(page).toHaveURL(/\/notice\/new/, { timeout: 5000 });
  });

  test.afterEach(async () => {
    await cleanupSession(sessionToken);
  });

  test("기본 2개의 URL 입력 필드가 표시된다", async ({ page }) => {
    const inputs = page.getByRole("textbox");
    await expect(inputs).toHaveCount(2);
  });

  test("URL 추가 버튼을 클릭하면 필드가 추가된다", async ({ page }) => {
    await page.getByRole("button", { name: /URL 추가/i }).click();
    const inputs = page.getByRole("textbox");
    await expect(inputs).toHaveCount(3);
  });

  test("URL이 비어있으면 초안 생성 버튼이 비활성화된다", async ({ page }) => {
    await expect(
      page.getByRole("button", { name: "초안 생성" })
    ).toBeDisabled();
  });

  test("잘못된 형식의 URL 입력 시 유효성 오류가 표시된다", async ({ page }) => {
    await page.getByRole("textbox").first().fill("invalid-url");
    await page.getByRole("button", { name: "초안 생성" }).click();
    await expect(
      page.getByText(/유효한 JIRA Release Note URL/)
    ).toBeVisible();
  });
});
