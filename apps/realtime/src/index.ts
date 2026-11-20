import { createServer } from "node:http";
import { Server } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import { createClient } from "redis";
import { jwtVerify } from "jose";
import { prisma } from "@prommatch/db";
import { getEnv } from "./env.js";

const env = getEnv();
const secret = new TextEncoder().encode(env.REALTIME_JWT_SECRET);

const httpServer = createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
    return;
  }
  res.writeHead(404);
  res.end();
});

const io = new Server(httpServer, {
  cors: { origin: env.REALTIME_CORS_ORIGINS.split(",").map((s) => s.trim()) },
});

const pubClient = createClient({ url: env.REDIS_URL });
const subClient = pubClient.duplicate();

/**
 * JWT auth: every socket must present the token /api/realtime-token
 * (apps/web) issues (HS256, 5-minute expiry, { userId, role }). A socket
 * that connects without a valid token is rejected before any event
 * handler runs — see io.use below.
 */
io.use(async (socket, next) => {
  const token = socket.handshake.auth?.token;
  if (typeof token !== "string") return next(new Error("missing_token"));
  try {
    const { payload } = await jwtVerify(token, secret);
    if (typeof payload.userId !== "string") return next(new Error("invalid_token"));
    socket.data.userId = payload.userId;
    socket.data.role = payload.role;
    next();
  } catch {
    next(new Error("invalid_or_expired_token"));
  }
});

io.on("connection", (socket) => {
  const userId = socket.data.userId as string;

  /**
   * The client joins one Socket.IO room per conversation it has open.
   * This server re-verifies participancy itself (mirroring chat.ts's
   * assertParticipant) rather than trusting the client's say-so — a
   * forged `join` for someone else's conversationId gets a `join:error`
   * back and nothing else.
   */
  socket.on("join", async (conversationId: unknown) => {
    if (typeof conversationId !== "string") return;
    try {
      const convo = await prisma.conversation.findUniqueOrThrow({
        where: { id: conversationId },
        include: { match: true, squad: { include: { members: true } } },
      });
      const isParticipant =
        convo.match?.userAId === userId ||
        convo.match?.userBId === userId ||
        convo.squad?.members.some((m) => m.userId === userId);
      if (!isParticipant) {
        socket.emit("join:error", { conversationId, reason: "forbidden" });
        return;
      }
      await socket.join(`conversation:${conversationId}`);
      socket.emit("join:ok", { conversationId });
    } catch {
      socket.emit("join:error", { conversationId, reason: "not_found" });
    }
  });

  socket.on("leave", (conversationId: unknown) => {
    if (typeof conversationId === "string") void socket.leave(`conversation:${conversationId}`);
  });
});

async function main() {
  await pubClient.connect();
  await subClient.connect();
  io.adapter(createAdapter(pubClient, subClient));

  /**
   * apps/web's chat.ts router publishes directly to Redis (channel
   * `conversation:<id>`, JSON `{ event, ...payload }`) on send/react/
   * markRead rather than calling into this service over HTTP — simpler,
   * and apps/web never needs to know whether this service is even up.
   * A second Redis connection here just relays those messages into the
   * matching Socket.IO room; psubscribe means one subscription covers
   * every conversation rather than one per room.
   */
  const relaySubscriber = pubClient.duplicate();
  await relaySubscriber.connect();
  await relaySubscriber.pSubscribe("conversation:*", (message, channel) => {
    try {
      const payload = JSON.parse(message) as { event: string } & Record<string, unknown>;
      io.to(channel).emit(payload.event, payload);
    } catch {
      // Malformed payload on the channel — drop it rather than crash the relay.
    }
  });

  httpServer.listen(env.REALTIME_PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`[realtime] listening on :${env.REALTIME_PORT}`);
  });
}

void main();

async function shutdown() {
  io.close();
  httpServer.close();
  await pubClient.disconnect().catch(() => undefined);
  await subClient.disconnect().catch(() => undefined);
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
