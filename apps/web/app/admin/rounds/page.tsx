"use client";

import { useState } from "react";
import { trpc } from "../../../lib/trpc.js";
import { Card, PillButton, SectionHeading } from "../../../components/ui.js";

type Mode = "DATE" | "FRIEND" | "SQUAD";

export default function RoundsPage() {
  const [mode, setMode] = useState<Mode>("DATE");
  const rounds = trpc.admin.rounds.list.useQuery({ mode });
  const utils = trpc.useUtils();

  const [number, setNumber] = useState(1);
  const [scheduledAt, setScheduledAt] = useState("");
  const [decisionDeadline, setDecisionDeadline] = useState("");
  const [minScore, setMinScore] = useState(50);
  const [proposalsPerUser, setProposalsPerUser] = useState(3);
  const [candidatesPerUser, setCandidatesPerUser] = useState(20);

  const create = trpc.admin.rounds.create.useMutation({ onSuccess: () => utils.admin.rounds.list.invalidate({ mode }) });
  const preview = trpc.admin.rounds.preview.useMutation();
  const publish = trpc.admin.rounds.publish.useMutation({ onSuccess: () => utils.admin.rounds.list.invalidate({ mode }) });
  const close = trpc.admin.rounds.close.useMutation({ onSuccess: () => utils.admin.rounds.list.invalidate({ mode }) });

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-2xl">Match Drops</h1>

      <div className="flex gap-2">
        {(["DATE", "FRIEND", "SQUAD"] as Mode[]).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`rounded-pill px-4 py-1.5 text-sm border ${mode === m ? "border-gold text-gold" : "border-text/15 text-muted"}`}
          >
            {m}
          </button>
        ))}
      </div>

      <Card>
        <SectionHeading>New round</SectionHeading>
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="block text-sm">
            Round number
            <input type="number" min={1} value={number} onChange={(e) => setNumber(Number(e.target.value))} className="input mt-1" />
          </label>
          <label className="block text-sm">
            Min score
            <input type="number" min={0} max={100} value={minScore} onChange={(e) => setMinScore(Number(e.target.value))} className="input mt-1" />
          </label>
          <label className="block text-sm">
            Scheduled at
            <input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} className="input mt-1" />
          </label>
          <label className="block text-sm">
            Decision deadline
            <input type="datetime-local" value={decisionDeadline} onChange={(e) => setDecisionDeadline(e.target.value)} className="input mt-1" />
          </label>
          <label className="block text-sm">
            Proposals per user
            <input type="number" min={1} value={proposalsPerUser} onChange={(e) => setProposalsPerUser(Number(e.target.value))} className="input mt-1" />
          </label>
          <label className="block text-sm">
            Candidates per user
            <input type="number" min={1} value={candidatesPerUser} onChange={(e) => setCandidatesPerUser(Number(e.target.value))} className="input mt-1" />
          </label>
        </div>
        <PillButton
          variant="primary"
          className="mt-4"
          disabled={!scheduledAt || !decisionDeadline || create.isPending}
          onClick={() =>
            create.mutate({
              mode,
              number,
              scheduledAt: new Date(scheduledAt),
              decisionDeadline: new Date(decisionDeadline),
              params: { minScore, proposalsPerUser, candidatesPerUser, choiceMismatch: 0.3 },
            })
          }
        >
          Create round
        </PillButton>
      </Card>

      <div className="space-y-3">
        {rounds.data?.map((r) => (
          <Card key={r.id}>
            <div className="flex items-center justify-between mb-2">
              <p className="font-semibold">
                Round #{r.number} · {r.status}
              </p>
              <p className="text-xs text-muted">{new Date(r.scheduledAt).toLocaleString()}</p>
            </div>
            <div className="flex gap-3">
              {r.status === "DRAFT" ? (
                <PillButton variant="secondary" onClick={() => preview.mutate({ roundId: r.id })} disabled={preview.isPending}>
                  Preview
                </PillButton>
              ) : null}
              {r.status === "PREVIEWED" ? (
                <PillButton variant="primary" onClick={() => publish.mutate({ roundId: r.id })} disabled={publish.isPending}>
                  Publish
                </PillButton>
              ) : null}
              {r.status === "PUBLISHED" ? (
                <PillButton variant="danger" onClick={() => close.mutate({ roundId: r.id })} disabled={close.isPending}>
                  Close
                </PillButton>
              ) : null}
          </Card>
        ))}
      </div>

      {preview.data ? (
        <Card>
          <SectionHeading>Preview stats</SectionHeading>
          <pre className="text-xs text-muted overflow-x-auto">{JSON.stringify(preview.data.stats, null, 2)}</pre>
        </Card>
      ) : null}
    </div>
  );
}
