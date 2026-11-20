"use client";

import { useState } from "react";
import { trpc } from "../../../lib/trpc.js";
import { Card, PillButton, EmptyState, SectionHeading } from "../../../components/ui.js";

const TEMPLATES = ["starry-night", "retro-arcade", "flower-bloom", "polaroid", "scratch-card", "envelope"] as const;

export default function PromposalsPage() {
  const mutualDates = trpc.matches.listMutual.useQuery({ mode: "DATE" });

  return (
    <div className="space-y-4">
      <h1 className="font-heading text-2xl mb-2">Promposals</h1>
      {mutualDates.data?.length ? (
        mutualDates.data.map((m) => <PromposalCard key={m.id} matchId={m.id} />)
      ) : (
        <EmptyState>You'll be able to send a promposal once you have a mutual Date match.</EmptyState>
      )}
    </div>
  );
}

function PromposalCard({ matchId }: { matchId: string }) {
  const promposal = trpc.matches.getMutualProfile.useQuery({ matchId });
  const existing = trpc.promposal.getForMatch.useQuery({ matchId });
  const utils = trpc.useUtils();
  const send = trpc.promposal.send.useMutation({ onSuccess: () => utils.promposal.getForMatch.invalidate({ matchId }) });
  const respond = trpc.promposal.respond.useMutation({ onSuccess: () => utils.promposal.getForMatch.invalidate({ matchId }) });

  const [template, setTemplate] = useState<(typeof TEMPLATES)[number]>("starry-night");
  const [message, setMessage] = useState("");

  const name = promposal.data?.profile?.displayName ?? "your match";

  if (existing.data) {
    return (
      <Card>
        <SectionHeading>{name}</SectionHeading>
        <p className="text-sm text-muted mb-2">
          Promposal sent ({existing.data.template}): "{existing.data.message}"
        </p>
        <p className="text-sm">
          Status:{" "}
          <span className="text-gold">
            {existing.data.status === "SENT" ? "Waiting for a reply" : existing.data.status}
          </span>
        </p>
        {existing.data.status === "SENT" ? (
          <div className="flex gap-3 mt-3">
            <PillButton variant="secondary" onClick={() => respond.mutate({ matchId, answer: "NOT_YET" })}>
              Not yet
            </PillButton>
            <PillButton variant="primary" onClick={() => respond.mutate({ matchId, answer: "YES" })}>
              Yes!
            </PillButton>
          </div>
        ) : null}
      </Card>
    );
  }

  return (
    <Card>
      <SectionHeading>Promposal to {name}</SectionHeading>
      <div className="flex flex-wrap gap-2 mb-3">
        {TEMPLATES.map((t) => (
          <button
            key={t}
            onClick={() => setTemplate(t)}
            className={`rounded-pill px-3 py-1 text-xs border ${template === t ? "border-gold text-gold" : "border-text/15 text-muted"}`}
          >
            {t.replace("-", " ")}
          </button>
        ))}
      </div>
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        maxLength={280}
        rows={3}
        placeholder="Write something sweet…"
        className="input resize-none mb-3"
      />
      <PillButton
        variant="primary"
        disabled={!message.trim() || send.isPending}
        onClick={() => send.mutate({ matchId, template, message: message.trim() })}
      >
        Send promposal
      </PillButton>
    </Card>
  );
}
