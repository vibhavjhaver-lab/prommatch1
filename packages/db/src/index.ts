import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var __prommatchPrisma: PrismaClient | undefined;
}

/**
 * Singleton Prisma client. In dev, Next.js hot-reloads modules, which would
 * otherwise create a new PrismaClient (and a new connection pool) on every
 * edit — so we stash it on `global` and reuse it.
 */
export const prisma =
  globalThis.__prommatchPrisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalThis.__prommatchPrisma = prisma;
}

export * from "@prisma/client";
