import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { prisma } from "@prommatch/db";
import { can, type Action, type PolicyResource } from "@prommatch/core";
import { auth } from "../lib/auth.js";

export async function createContext() {
  const session = await auth();
  return { session, db: prisma };
}

export type Context = Awaited<ReturnType<typeof createContext>>;

const t = initTRPC.context<Context>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

/** Requires any signed-in, non-deleted/suspended user. */
export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.session?.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  const status = ctx.session.user.status;
  if (status === "SUSPENDED" || status === "BANNED" || status === "DELETED") {
    throw new TRPCError({ code: "FORBIDDEN", message: "account_restricted" });
  }
  return next({ ctx: { ...ctx, session: { ...ctx.session, user: ctx.session.user } } });
});

/** Requires ORGANIZER or SUPERADMIN. */
export const organizerProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.session.user.role !== "ORGANIZER" && ctx.session.user.role !== "SUPERADMIN") {
    throw new TRPCError({ code: "FORBIDDEN" });
  }
  return next({ ctx });
});

/** Requires SUPERADMIN. */
export const superadminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.session.user.role !== "SUPERADMIN") {
    throw new TRPCError({ code: "FORBIDDEN" });
  }
  return next({ ctx });
});

/** Throws FORBIDDEN unless the policy check passes — the single place every router calls into @prommatch/core's can(). */
export function requirePolicy(ctx: Context, action: Action, resource?: PolicyResource) {
  if (!ctx.session?.user) throw new TRPCError({ code: "UNAUTHORIZED" });
  const allowed = can({ role: ctx.session.user.role, userId: ctx.session.user.id }, action, resource);
  if (!allowed) throw new TRPCError({ code: "FORBIDDEN", message: `policy:${action}` });
}
