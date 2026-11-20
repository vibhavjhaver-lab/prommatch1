import { randomInt } from "node:crypto";
import NextAuth from "next-auth";
import type { NextAuthConfig } from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@prommatch/db";
import { isAllowedCollegeEmail } from "@prommatch/core";
import { getEnv } from "./env.js";
import { getEventConfig } from "./config.js";
import { sendVerificationEmail } from "./mail.js";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I — avoids transcription errors

/**
 * The raw token IS the 8-character code, not a slice of a longer token:
 * Auth.js hashes whatever `generateVerificationToken` returns before
 * storing it in VerificationToken, and verifies a magic-link click or a
 * typed code the same way (hash the presented token, compare to the
 * stored hash). If the two didn't share the same raw value, typing the
 * "code" could never satisfy the verification Auth.js does for the link
 * — so both affordances only work because they resolve to this one
 * value. 8 chars from a 33-symbol alphabet is ~40 bits of entropy per
 * token; combined with single-use, a 15-minute expiry, and the
 * request-rate limits in auth.requestCode, that's an acceptable
 * tradeoff for a prom app (documented in DECISIONS.md).
 */
function generateShortToken(): string {
  let out = "";
  for (let i = 0; i < 8; i++) {
    out += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  }
  return out;
}

/**
 * Passwordless, domain-restricted auth per spec section 6: a magic link +
 * short code, both backed by Auth.js's EmailProvider (which already does
 * single-use, time-limited tokens via VerificationToken) — generateVerificationToken
 * below makes that one token short enough to type by hand, and it's used
 * verbatim for both the link and the code. Rate-limiting on send happens
 * in the `auth.requestCode` tRPC procedure, not here.
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
      generateVerificationToken: generateShortToken,
      async sendVerificationRequest({ identifier, url, token }) {
        const config = await getEventConfig();
        if (!isAllowedCollegeEmail(identifier, config.allowedEmailDomains)) {
          // Adapter already created the token; it simply expires unused.
          // We never send mail to a non-college address.
          return;
        }
        await sendVerificationEmail({ to: identifier, url, code: token, appName: config.appName });
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
