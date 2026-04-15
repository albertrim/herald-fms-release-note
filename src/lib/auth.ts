import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "database" },
  pages: {
    signIn: "/login",
  },
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      allowDangerousEmailAccountLinking: true,
      authorization: {
        params: {
          scope:
            "openid email profile https://www.googleapis.com/auth/gmail.send",
          access_type: "offline",
          // prompt을 지정하지 않으면 Google이 자체적으로 최초 1회만 동의 화면 표시
          // refresh_token이 없을 때만 동의가 필요하므로 클라이언트에서 동적으로 처리
        },
      },
    }),
  ],
  events: {
    async createUser({ user }) {
      if (user.id && user.name) {
        const name = user.name.replace(/\(.*\)$/, "").trim();
        if (name !== user.name) {
          await prisma.user.update({
            where: { id: user.id },
            data: { name },
          });
        }
      }
    },
  },
  callbacks: {
    async signIn({ account, profile }) {
      if (account?.provider !== "google") return false;
      const email = profile?.email ?? "";
      if (!email.endsWith("@fassto.com")) return false;

      if (account.providerAccountId) {
        // DB에 기존 refresh_token이 있는지 확인
        const existing = await prisma.account.findFirst({
          where: { provider: "google", providerAccountId: account.providerAccountId },
          select: { refresh_token: true },
        });
        const hasExistingRefreshToken = !!existing?.refresh_token;

        // refresh_token이 없고 DB에도 없으면 재동의 필요 → 거부 후 consent 파라미터로 리다이렉트
        if (!account.refresh_token && !hasExistingRefreshToken) {
          return "/login?error=ConsentRequired";
        }

        const data: { access_token?: string; expires_at?: number; refresh_token?: string } = {};
        if (account.access_token) data.access_token = account.access_token;
        if (account.expires_at) data.expires_at = account.expires_at;
        // 새 refresh_token이 발급된 경우에만 갱신 (재동의 없이 로그인 시 undefined)
        if (account.refresh_token) data.refresh_token = account.refresh_token;

        if (Object.keys(data).length > 0) {
          await prisma.account.updateMany({
            where: {
              provider: "google",
              providerAccountId: account.providerAccountId,
            },
            data,
          });
        }
      }

      return true;
    },
    async session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
      }
      return session;
    },
  },
});
