import type { Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const TEST_USER_EMAIL = "albert.rim@fassto.com";
const TEST_USER_NAME = "Albert Rim";

/**
 * DB에 테스트 세션을 생성하고 Playwright 컨텍스트에 쿠키를 주입합니다.
 * Google OAuth 리다이렉트 없이 인증 상태를 시뮬레이션합니다.
 */
export async function injectSession(page: Page): Promise<string> {
  const sessionToken = `test-session-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);

  const user = await prisma.user.upsert({
    where: { email: TEST_USER_EMAIL },
    update: { name: TEST_USER_NAME },
    create: { email: TEST_USER_EMAIL, name: TEST_USER_NAME },
  });

  await prisma.session.create({
    data: { sessionToken, userId: user.id, expires },
  });

  await page.context().addCookies([
    {
      name: "authjs.session-token",
      value: sessionToken,
      domain: "localhost",
      path: "/",
      expires: Math.floor(expires.getTime() / 1000),
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);

  return sessionToken;
}

export async function cleanupSession(sessionToken: string): Promise<void> {
  await prisma.session.deleteMany({ where: { sessionToken } });
}
