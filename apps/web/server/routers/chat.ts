import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createClient } from "redis";
import { MessageInputSchema, moderateText } from "@prommatch/core";
import { getEnv } from "../../lib/env.js";
import { protectedProcedure, router } from "../trpc.js";

let redisPublisher: ReturnType<typeof createClient> | undefined;
async function publisher() {
  if (!redisPublisher) {
    redisPublisher = createClient({ url: getEnv().REDIS_URL });
    await redisPublisher.connect();
  }
  return redisPublisher;
}

const RATE_LIMIT_WINDOW_SECONDS = 10;
const RATE_LIMIT_MAX = 20;
const DAILY_MAX = 500;

async function checkRateLimit(userId: string) {
  const r = await publisher();
  const shortKey = `ratelimit:chat:${userId}:short`;
  const dailyKey = `ratelimit:chat:${userId}:daily`;

  const shortCount = await r.incr(shortKey);
  if (shortCount === 1) await r.expire(shortKey, RATE_LIMIT_WINDOW_SECONDS);
  if (shortCount > RATE_LIMIT_MAX) {
    throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "chat_rate_limited" });
  }

  const dailyCount = await r.incr(dailyKey);
  if (dailyCount === 1) await r.expire(dailyKey, 24 * 60 * 60);
  if (dailyCount > DAILY_MAX) {
    throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "chat_daily_limit" });
  }
}

async function assertParticipant(db: typeof import("@prommatch/db").prisma, conversationId: string, userId: string) {
  const convo = await db.conversation.findUniqueOrThrow({
    where: { id: conversationId },
    include: { match: true, squad: { include: { members: true } } },
  });
  const isParticipant =
    convo.match?.userAId === userId ||
    convo.match?.userBId === userId ||
    convo.squad?.members.some((m) => m.userId === userId);
  if (!isParticipant) throw new TRPCError({ code: "FORBIDDEN" });
  if (convo.closedAt) throw new TRPCError({ code: "BAD_REQUEST", message: "conversation_closed" });
  return convo;
}

export const chatRouter = router({
  listConversations: protectedProcedure.query(async ({ ctx }) => {
    const uid = ctx.session.user.id;
    const [matchConvos, squadConvos] = await Promise.all([
      ctx.db.conversation.findMany({
        where: { match: { OR: [{ userAId: uid }, { userBId: uid }], status: "MUTUAL" } },
        include: { match: true, messages: { orderBy: { createdAt: "desc" }, take: 1 } },
      }),
      ctx.db.conversation.findMany({
        where: { squad: { members: { some: { userId: uid } } } },
        include: { squad: true, messages: { orderBy: { createdAt: "desc" }, take: 1 } },
      }),
    ]);
    return [...matchConvos, ...squadConvos];
  }),

  history: protectedProcedure
    .input(z.object({ conversationId: z.string(), cursor: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      await assertParticipant(ctx.db, input.conversationId, ctx.session.user.id);
      const messages = await ctx.db.message.findMany({
        where: { conversationId: input.conversationId, deletedAt: null },
        orderBy: { createdAt: "desc" },
        take: 30,
        ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
      });
      return { messages: messages.reverse(), nextCursor: messages.length === 30 ? messages[0]?.id : undefined };
    }),

  send: protectedProcedure.input(MessageInputSchema).mutation(async ({ ctx, input }) => {
    const uid = ctx.session.user.id;
    await assertParticipant(ctx.db, input.conversationId, uid);
    await checkRateLimit(uid);

    const moderation = moderateText(input.body);
    if (moderation.severity === "block") {
      return { held: true, reason: "moderation" as const };
    }

    const message = await ctx.db.message.create({
      data: {
        conversationId: input.conversationId,
        senderId: uid,
        body: input.body,
        flagged: moderation.severity === "flag",
        readBy: [uid],
      },
    });

    const r = await publisher();
    await r.publish(
      `conversation:${input.conversationId}`,
      JSON.stringify({ event: "message:new", message }),
    );

    return { held: false, message };
  }),

  react: protectedProcedure
    .input(z.object({ messageId: z.string(), emoji: z.string().max(8) }))
    .mutation(async ({ ctx, input }) => {
      const message = await ctx.db.message.findUniqueOrThrow({ where: { id: input.messageId } });
      await assertParticipant(ctx.db, message.conversationId, ctx.session.user.id);
      const r = await publisher();
      await r.publish(
        `conversation:${message.conversationId}`,
        JSON.stringify({ event: "reaction", messageId: input.messageId, emoji: input.emoji, userId: ctx.session.user.id }),
      );
      return { ok: true };
    }),

  markRead: protectedProcedure
    .input(z.object({ conversationId: z.string(), messageId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await assertParticipant(ctx.db, input.conversationId, ctx.session.user.id);
      const message = await ctx.db.message.findUniqueOrThrow({ where: { id: input.messageId } });
      if (!message.readBy.includes(ctx.session.user.id)) {
        await ctx.db.message.update({
          where: { id: input.messageId },
          data: { readBy: { push: ctx.session.user.id } },
        });
      }
      const r = await publisher();
      await r.publish(
        `conversation:${input.conversationId}`,
        JSON.stringify({ event: "read", messageId: input.messageId, userId: ctx.session.user.id }),
      );
      return { ok: true };
    }),
});
