import { test, expect } from "@playwright/test";

test.describe("URL 입력 페이지", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("이메일").fill("admin@company.com");
    await page.getByLabel("비밀번호").fill("admin1234");
    await page.getByRole("button", { name: "로그인" }).click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 });
    await page.getByRole("button", { name: "새 공지 생성" }).click();
    await expect(page).toHaveURL(/\/notice\/new/, { timeout: 5000 });
  });

  test("기본 2개의 URL 입력 필드가 표시된다", async ({ page }) => {
    const inputs = page.getByPlaceholder(/jira/i);
    await expect(inputs).toHaveCount(2);
  });

  test("URL 추가 버튼을 클릭하면 필드가 추가된다", async ({ page }) => {
    await page.getByRole("button", { name: /URL 추가/i }).click();
    const inputs = page.getByPlaceholder(/jira/i);
    await expect(inputs).toHaveCount(3);
  });

  test("URL 삭제 버튼을 클릭하면 필드가 제거된다", async ({ page }) => {
    await page.getByRole("button", { name: /URL 추가/i }).click();
    const deleteButtons = page.getByRole("button", { name: "삭제" });
    await deleteButtons.first().click();
    const inputs = page.getByPlaceholder(/jira/i);
    await expect(inputs).toHaveCount(2);
  });

  test("빈 URL로 초안 생성 시 오류 메시지가 표시된다", async ({ page }) => {
    await page.getByRole("button", { name: "초안 생성" }).click();
    await expect(page.getByText("최소 1개의 URL을 입력해주세요")).toBeVisible();
  });

  test("잘못된 형식의 URL 입력 시 유효성 오류가 표시된다", async ({ page }) => {
    await page.getByPlaceholder(/jira/i).first().fill("invalid-url");
    await page.getByRole("button", { name: "초안 생성" }).click();
    await expect(page.getByText(/유효한 JIRA Release Note URL/)).toBeVisible();
  });
});
