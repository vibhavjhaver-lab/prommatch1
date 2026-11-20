"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import { trpc } from "../../../../lib/trpc.js";
import { useConversationSocket } from "../../../../lib/useConversationSocket.js";
import { PillButton } from "../../../../components/ui.js";

/**
 * Live updates come from apps/realtime over Socket.IO when it's reachable;
 * the 15s refetchInterval is just a safety net for when it isn't (or for
 * events this client missed while reconnecting), so the chat never fully
 * depends on the socket being up.
 */
export default function ChatRoomPage() {
  const params = useParams<{ conversationId: string }>();
  const conversationId = params.conversationId;
  const [body, setBody] = useState("");

  const history = trpc.chat.history.useQuery({ conversationId }, { refetchInterval: 15000 });
  const utils = trpc.useUtils();
  const send = trpc.chat.send.useMutation({
    onSuccess: () => {
      setBody("");
      utils.chat.history.invalidate({ conversationId });
    },
  });

  useConversationSocket(conversationId, (payload) => {
    if (payload.event === "message:new" || payload.event === "read") {
      utils.chat.history.invalidate({ conversationId });
    }
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
