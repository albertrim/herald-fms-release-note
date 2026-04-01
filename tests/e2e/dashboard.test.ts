import { test, expect } from "@playwright/test";

test.describe("대시보드", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("이메일").fill("admin@company.com");
    await page.getByLabel("비밀번호").fill("admin1234");
    await page.getByRole("button", { name: "로그인" }).click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 });
  });

  test("대시보드 페이지가 표시된다", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "대시보드" })).toBeVisible();
    await expect(page.getByRole("button", { name: "새 공지 생성" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "발송 이력" })).toBeVisible();
  });

  test("'새 공지 생성' 클릭 시 URL 입력 페이지로 이동한다", async ({ page }) => {
    await page.getByRole("button", { name: "새 공지 생성" }).click();
    await expect(page).toHaveURL(/\/notice\/new/, { timeout: 5000 });
  });

  test("헤더에 사용자 정보와 로그아웃 버튼이 표시된다", async ({ page }) => {
    await expect(page.getByText("관리자")).toBeVisible();
    await expect(page.getByText("[관리자]")).toBeVisible();
    await expect(page.getByRole("button", { name: "로그아웃" })).toBeVisible();
  });

  test("로그아웃하면 로그인 페이지로 이동한다", async ({ page }) => {
    await page.getByRole("button", { name: "로그아웃" }).click();
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
  });
});
