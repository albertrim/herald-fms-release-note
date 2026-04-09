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
          prompt: "consent",
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

      // 매 로그인마다 OAuth 토큰을 DB에 갱신 (PrismaAdapter는 최초 linkAccount만 처리)
      if (account.providerAccountId) {
        const data: { access_token?: string; expires_at?: number; refresh_token?: string } = {};
        if (account.access_token) data.access_token = account.access_token;
        if (account.expires_at) data.expires_at = account.expires_at;
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
