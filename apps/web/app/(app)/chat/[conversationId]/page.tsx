"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import { trpc } from "../../../../lib/trpc.js";
import { PillButton } from "../../../../components/ui.js";

/**
 * Polls for new messages every few seconds. apps/realtime (Socket.IO) is
 * the live-push path once it exists — this page is written against the
 * same tRPC procedures it would otherwise just be prodded by, so swapping
 * in a socket subscription later only means replacing the refetchInterval
 * with a socket listener that calls the same query invalidation.
 */
export default function ChatRoomPage() {
  const params = useParams<{ conversationId: string }>();
  const conversationId = params.conversationId;
  const [body, setBody] = useState("");

  const history = trpc.chat.history.useQuery({ conversationId }, { refetchInterval: 4000 });
  const utils = trpc.useUtils();
  const send = trpc.chat.send.useMutation({
    onSuccess: () => {
      setBody("");
      utils.chat.history.invalidate({ conversationId });
    },
  });

  return (
    <div className="flex flex-col h-[70vh]">
      <div className="flex-1 overflow-y-auto space-y-2 mb-4">
        {history.data?.messages.map((m) => (
          <div key={m.id} className="rounded-card bg-surface px-3 py-2 max-w-sm">
            <p className="text-sm">{m.body}</p>
            <p className="text-[10px] text-muted mt-1">{new Date(m.createdAt).toLocaleTimeString()}</p>
          </div>
        ))}
        {!history.data?.messages.length ? (
          <p className="text-muted text-sm">No messages yet — say hi.</p>
        ) : null}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!body.trim()) return;
          send.mutate({ conversationId, body: body.trim() });
        }}
        className="flex gap-2"
      >
        <input
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={1000}
          placeholder="Type a message…"
          className="input flex-1"
        />
        <PillButton type="submit" variant="primary" disabled={send.isPending}>
          Send
        </PillButton>
      </form>
      {send.data?.held ? (
        <p className="text-xs text-danger mt-2">That message was held for review and wasn't delivered.</p>
      ) : null}
    </div>
  );
}
