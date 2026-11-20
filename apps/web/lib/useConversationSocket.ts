"use client";

import { useEffect, useRef } from "react";
import { io, type Socket } from "socket.io-client";

/**
 * Connects to apps/realtime for one conversation's room and calls
 * `onEvent` for every `{event, ...}` payload chat.ts's router relays
 * through it (message:new, reaction, read). Fetches a fresh short-lived
 * token from /api/realtime-token per connection, same as any other
 * client of that route.
 *
 * If apps/realtime isn't deployed/reachable, this fails closed: the
 * socket just never connects, and the caller's own polling (chat room
 * page keeps a refetchInterval specifically for this) is what actually
 * keeps messages showing up either way — this hook is a latency
 * improvement, not the only path to a working chat.
 */
export function useConversationSocket(conversationId: string, onEvent: (payload: { event: string } & Record<string, unknown>) => void) {
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    let socket: Socket | undefined;
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch("/api/realtime-token");
        if (!res.ok) return;
        const { token, realtimeUrl } = await res.json();
        if (cancelled) return;

        socket = io(realtimeUrl, { auth: { token }, transports: ["websocket"] });
        socket.on("connect", () => socket?.emit("join", conversationId));
        for (const evt of ["message:new", "reaction", "read"]) {
          socket.on(evt, (payload) => onEventRef.current({ event: evt, ...payload }));
        }
      } catch {
        // Realtime is best-effort — the page's own polling covers this.
      }
    })();

    return () => {
      cancelled = true;
      socket?.emit("leave", conversationId);
      socket?.disconnect();
    };
  }, [conversationId]);
}
