"use client";

import { trpc } from "../../../lib/trpc.js";
import { Card, EmptyState, PillButton } from "../../../components/ui.js";

export default function ChatListPage() {
  const conversations = trpc.chat.listConversations.useQuery();

  return (
    <div className="space-y-3">
      <h1 className="font-heading text-2xl mb-3">Chat</h1>
      {conversations.data?.length ? (
        conversations.data.map((c) => (
          <Card key={c.id} className="flex items-center justify-between">
            <div>
              <p className="font-medium">{"match" in c && c.match ? "Date/Friend match" : "Squad"}</p>
              <p className="text-sm text-muted truncate max-w-xs">
                {c.messages?.[0]?.body ?? "No messages yet"}
              </p>
            </div>
            <PillButton href={`/chat/${c.id}`} variant="secondary">
              Open
            </PillButton>
          </Card>
        ))
      ) : (
        <EmptyState>No conversations yet. They'll show up here after a mutual match.</EmptyState>
      )}
    </div>
  );
}
