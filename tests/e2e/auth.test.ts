import { test, expect } from "@playwright/test";

test.describe("인증 플로우", () => {
  test("미인증 사용자는 로그인 페이지로 리다이렉트된다", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
  });

  test("회원가입 페이지가 표시된다", async ({ page }) => {
    await page.goto("/signup");
    await expect(page.getByText("회원가입", { exact: true }).first()).toBeVisible();
    await expect(page.getByLabel("이름")).toBeVisible();
    await expect(page.getByLabel("이메일")).toBeVisible();
    await expect(page.getByLabel("비밀번호", { exact: true })).toBeVisible();
    await expect(page.getByLabel("비밀번호 확인")).toBeVisible();
  });

  test("로그인 페이지가 표시된다", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByText("로그인", { exact: true }).first()).toBeVisible();
    await expect(page.getByLabel("이메일")).toBeVisible();
    await expect(page.getByLabel("비밀번호")).toBeVisible();
  });

  test("잘못된 인증 정보로 로그인하면 오류 메시지가 표시된다", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("이메일").fill("wrong@example.com");
    await page.getByLabel("비밀번호").fill("wrongpassword");
    await page.getByRole("button", { name: "로그인" }).click();

    await expect(
      page.getByText("이메일 또는 비밀번호가 올바르지 않습니다")
    ).toBeVisible({ timeout: 10000 });
  });

  test("시드된 관리자 계정으로 로그인하면 대시보드로 이동한다", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("이메일").fill("admin@company.com");
    await page.getByLabel("비밀번호").fill("admin1234");
    await page.getByRole("button", { name: "로그인" }).click();

    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 });
    await expect(page.getByText("대시보드")).toBeVisible();
  });

  test("회원가입 후 로그인 페이지로 이동한다", async ({ page }) => {
    const email = `test-${Date.now()}@example.com`;

    await page.goto("/signup");
    await page.getByLabel("이름").fill("테스트 사용자");
    await page.getByLabel("이메일").fill(email);
    await page.getByLabel("비밀번호", { exact: true }).fill("testpass1234");
    await page.getByLabel("비밀번호 확인").fill("testpass1234");
    await page.getByRole("button", { name: "회원가입" }).click();

    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
  });
});
