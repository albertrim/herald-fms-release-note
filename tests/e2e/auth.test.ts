import { test, expect } from "@playwright/test";
import { injectSession, cleanupSession } from "./helpers/auth-helper";

test.describe("인증 플로우 (Google SSO)", () => {
  test("미인증 사용자는 로그인 페이지로 리다이렉트된다", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
  });

  test("로그인 페이지에 Google 버튼이 표시된다", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByText("FASSTO Herald")).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Google 계정으로 로그인/ })
    ).toBeVisible();
    await expect(
      page.getByText("@fassto.com 계정으로만 로그인할 수 있습니다")
    ).toBeVisible();
    // 이메일/비밀번호 폼이 없어야 함
    await expect(page.getByLabel("이메일")).not.toBeVisible();
    await expect(page.getByLabel("비밀번호")).not.toBeVisible();
  });

  test("AccessDenied 오류 시 도메인 제한 배너가 표시된다", async ({ page }) => {
    await page.goto("/login?error=AccessDenied");
    await expect(
      page.getByText("@fassto.com 계정만 사용할 수 있습니다.")
    ).toBeVisible();
  });

  test("정상 로그인 페이지에서는 오류 배너가 없다", async ({ page }) => {
    await page.goto("/login");
    await expect(
      page.getByText("@fassto.com 계정만 사용할 수 있습니다.")
    ).not.toBeVisible();
  });

  test("세션 주입 후 대시보드에 접근할 수 있다", async ({ page }) => {
    const sessionToken = await injectSession(page);
    try {
      await page.goto("/dashboard");
      await expect(page).toHaveURL(/\/dashboard/);
      await expect(page).not.toHaveURL(/\/login/);
    } finally {
      await cleanupSession(sessionToken);
    }
  });

  test("세션 주입 후 로그아웃하면 로그인 페이지로 이동한다", async ({ page }) => {
    const sessionToken = await injectSession(page);
    try {
      await page.goto("/dashboard");
      await expect(page).toHaveURL(/\/dashboard/);
      await page.getByRole("button", { name: "로그아웃" }).click();
      await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
    } finally {
      await cleanupSession(sessionToken);
    }
  });

  test("로그아웃 후 보호된 페이지 접근 시 로그인 페이지로 리다이렉트된다", async ({
    page,
  }) => {
    const sessionToken = await injectSession(page);
    await page.goto("/dashboard");
    await page.getByRole("button", { name: "로그아웃" }).click();
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });

    // 로그아웃 후 대시보드 직접 접근 시 다시 로그인 페이지로
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);

    await cleanupSession(sessionToken);
  });
});
