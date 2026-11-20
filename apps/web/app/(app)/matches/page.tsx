"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { trpc } from "../../../lib/trpc.js";
import { Card, PillButton, EmptyState } from "../../../components/ui.js";

type Mode = "DATE" | "FRIEND";

export default function MatchesPage() {
  const params = useSearchParams();
  const initialMode = (params.get("mode") as Mode) ?? "DATE";
  const [mode, setMode] = useState<Mode>(initialMode);
  const [tab, setTab] = useState<"new" | "mutual">("new");

  const proposals = trpc.matches.listProposals.useQuery({ mode });
  const mutual = trpc.matches.listMutual.useQuery({ mode });
  const utils = trpc.useUtils();
  const decide = trpc.matches.decide.useMutation({
    onSuccess: () => utils.matches.listProposals.invalidate({ mode }),
  });

  return (
    <div className="space-y-5">
      <div className="flex gap-2">
        {(["DATE", "FRIEND"] as Mode[]).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`rounded-pill px-4 py-1.5 text-sm border ${mode === m ? "border-gold text-gold" : "border-text/15 text-muted"}`}
          >
            {m === "DATE" ? "Date" : "Friend"}
          </button>
        ))}
        <span className="mx-2 text-muted">·</span>
        {(["new", "mutual"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-pill px-4 py-1.5 text-sm border ${tab === t ? "border-gold text-gold" : "border-text/15 text-muted"}`}
          >
            {t === "new" ? "New" : "Mutual"}
          </button>
        ))}
      </div>

      {tab === "new" && (
        <div className="space-y-3">
          {proposals.data?.length ? (
            proposals.data.map((p) => (
              <Card key={p.id}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gold font-heading text-2xl">{Math.round(p.score)}% match</span>
                  <span className="text-xs text-muted">
                    Decide by {new Date(p.decisionDeadline).toLocaleDateString()}
                  </span>
                </div>
                <ul className="text-sm text-muted mb-3 list-disc pl-5">
                  {p.reasons?.slice(0, 3).map((r, i) => <li key={i}>{r.text}</li>)}
                </ul>
                {p.myDecision === "PENDING" ? (
                  <div className="flex gap-3">
                    <PillButton variant="secondary" onClick={() => decide.mutate({ matchId: p.id, decision: "PASS" })}>
                      Pass
                    </PillButton>
                    <PillButton variant="primary" onClick={() => decide.mutate({ matchId: p.id, decision: "ACCEPT" })}>
                      Accept
                    </PillButton>
                  </div>
                ) : (
                  <p className="text-sm text-muted">
                    You {p.myDecision === "ACCEPT" ? "accepted" : "passed"}.{" "}
                    {p.myDecision === "ACCEPT" && !p.otherDecisionKnown ? "Waiting on them." : ""}
                  </p>
                )}
              </Card>
            ))
          ) : (
            <EmptyState>No proposals right now — check back after the next Match Drop.</EmptyState>
          )}
        </div>
      )}

      {tab === "mutual" && (
        <div className="space-y-3">
          {mutual.data?.length ? (
            mutual.data.map((m) => <MutualCard key={m.id} matchId={m.id} conversationId={m.conversation?.id} />)
          ) : (
            <EmptyState>No mutual matches yet.</EmptyState>
          )}
        </div>
      )}
    </div>
  );
}

function MutualCard({ matchId, conversationId }: { matchId: string; conversationId?: string }) {
  const profile = trpc.matches.getMutualProfile.useQuery({ matchId });

  return (
    <Card className="flex items-center justify-between">
      <div>
        <p className="font-semibold">{profile.data?.profile?.displayName ?? "Loading…"}</p>
        <p className="text-sm text-muted">{profile.data?.profile?.department}</p>
      </div>
      {conversationId ? (
        <PillButton href={`/chat/${conversationId}`} variant="primary">
          Chat
        </PillButton>
      ) : null}
    </Card>
  );
}
