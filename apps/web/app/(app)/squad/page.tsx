"use client";

import { useState } from "react";
import { trpc } from "../../../lib/trpc.js";
import { Card, PillButton, EmptyState, SectionHeading } from "../../../components/ui.js";

export default function SquadPage() {
  const squad = trpc.squad.getMine.useQuery();
  const utils = trpc.useUtils();
  const decide = trpc.squad.decide.useMutation({ onSuccess: () => utils.squad.getMine.invalidate() });
  const leave = trpc.squad.leave.useMutation({ onSuccess: () => utils.squad.getMine.invalidate() });
  const createCode = trpc.prefs.createFriendCode.useMutation();
  const joinCode = trpc.prefs.joinFriendCode.useMutation();
  const [codeInput, setCodeInput] = useState("");

  if (!squad.data) {
    return (
      <div className="space-y-5">
        <EmptyState>You haven't joined a squad yet. Opt into Squad mode in Settings to get started.</EmptyState>
        <Card className="max-w-md">
          <SectionHeading>Have a friend code?</SectionHeading>
          <div className="flex gap-2">
            <input
              value={codeInput}
              onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
              maxLength={6}
              placeholder="ABCD12"
              className="input"
            />
            <PillButton
              variant="primary"
              disabled={codeInput.length !== 6 || joinCode.isPending}
              onClick={() => joinCode.mutate({ code: codeInput })}
            >
              Join
            </PillButton>
          </div>
          <div className="pt-4">
            <PillButton variant="secondary" onClick={() => createCode.mutate()} disabled={createCode.isPending}>
              {createCode.data ? `Your code: ${createCode.data.code}` : "Generate a code to share"}
            </PillButton>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <Card>
        <SectionHeading>{squad.data.name ?? "Your squad"}</SectionHeading>
        <ul className="space-y-2 mb-4">
          {squad.data.members.map((m) => (
            <li key={m.userId} className="text-sm flex justify-between">
              <span>{m.displayName}</span>
              <span className="text-muted">{m.decision}</span>
            </li>
          ))}
        </ul>

        {squad.data.myDecision === "PENDING" ? (
          <div className="flex gap-3">
            <PillButton variant="secondary" onClick={() => decide.mutate({ squadId: squad.data!.id, decision: "PASS" })}>
              Pass
            </PillButton>
            <PillButton variant="primary" onClick={() => decide.mutate({ squadId: squad.data!.id, decision: "ACCEPT" })}>
              Accept
            </PillButton>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted">You {squad.data.myDecision === "ACCEPT" ? "accepted" : "passed"}.</p>
            {squad.data.conversationId ? (
              <PillButton href={`/chat/${squad.data.conversationId}`} variant="primary">
                Squad chat
              </PillButton>
            ) : null}
          </div>
        )}
      </Card>

      <PillButton variant="ghost" onClick={() => leave.mutate({ squadId: squad.data!.id })}>
        Leave squad
      </PillButton>
    </div>
  );
}
