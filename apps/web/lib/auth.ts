import NextAuth from "next-auth";
import type { NextAuthConfig } from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@prommatch/db";
import { isAllowedCollegeEmail } from "@prommatch/core";
import { getEnv } from "./env.js";
import { getEventConfig } from "./config.js";
import { sendVerificationEmail } from "./mail.js";

/**
 * Passwordless, domain-restricted auth per spec section 6: a magic link +
 * 6-digit code, both backed by Auth.js's EmailProvider (which already does
 * single-use, time-limited tokens via VerificationToken) — we add the
 * 6-digit code as an alternate, shorter representation of the same token
 * so it's easy to type on another device, and rate-limit sends in the
 * `auth.requestCode` tRPC procedure, not here.
 */
export const authConfig: NextAuthConfig = {
  adapter: PrismaAdapter(prisma),
  session: { strategy: "database", maxAge: 30 * 24 * 60 * 60 },
  secret: getEnv().AUTH_SECRET,
  providers: [
    {
      id: "college-email",
      name: "College email",
      type: "email",
      server: getEnv().SMTP_URL,
      from: getEnv().EMAIL_FROM,
      maxAge: 15 * 60,
      async sendVerificationRequest({ identifier, url, token }) {
        const config = await getEventConfig();
        if (!isAllowedCollegeEmail(identifier, config.allowedEmailDomains)) {
          // Adapter already created the token; it simply expires unused.
          // We never send mail to a non-college address.
          return;
        }
        const code = token.slice(0, 6).toUpperCase();
        await sendVerificationEmail({ to: identifier, url, code, appName: config.appName });
      },
    },
  ],
  pages: {
    signIn: "/signin",
    verifyRequest: "/verify",
  },
  callbacks: {
    async signIn({ user }) {
      const config = await getEventConfig();
      if (!user.email) return false;
      return isAllowedCollegeEmail(user.email, config.allowedEmailDomains);
    },
    async session({ session, user }) {
      if (session.user) {
        const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
        session.user.id = user.id;
        session.user.role = dbUser?.role ?? "STUDENT";
        session.user.status = dbUser?.status ?? "PENDING_VERIFICATION";
      }
      return session;
    },
  },
};

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
