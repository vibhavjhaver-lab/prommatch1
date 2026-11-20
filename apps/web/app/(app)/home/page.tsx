"use client";

import { trpc } from "../../../lib/trpc.js";
import { Card, PillButton, SectionHeading, EmptyState } from "../../../components/ui.js";

export default function HomePage() {
  const countdown = trpc.event.countdown.useQuery();
  const dateProposals = trpc.matches.listProposals.useQuery({ mode: "DATE" });
  const friendProposals = trpc.matches.listProposals.useQuery({ mode: "FRIEND" });
  const notifications = trpc.notifications.list.useQuery();
  const squad = trpc.squad.getMine.useQuery();

  const pendingDate = dateProposals.data?.filter((p) => p.myDecision === "PENDING").length ?? 0;
  const pendingFriend = friendProposals.data?.filter((p) => p.myDecision === "PENDING").length ?? 0;

  return (
    <div className="space-y-6">
      <Card>
        <SectionHeading>What's next</SectionHeading>
        {countdown.data ? (
          <p className="text-sm text-muted">
            <span className="text-text font-medium">{formatMilestone(countdown.data.next.key)}</span> on{" "}
            {new Date(countdown.data.next.at).toLocaleString()}
          </p>
        ) : (
          <p className="text-sm text-muted">Loading…</p>
        )}
      </Card>

      <div className="grid sm:grid-cols-2 gap-4">
        <Card>
          <h3 className="font-semibold mb-1">Date matches</h3>
          <p className="text-sm text-muted mb-3">
            {pendingDate > 0 ? `${pendingDate} waiting on your decision.` : "Nothing new right now."}
          </p>
          <PillButton href="/matches?mode=DATE" variant="secondary">
            View
          </PillButton>
        </Card>
        <Card>
          <h3 className="font-semibold mb-1">Friend matches</h3>
          <p className="text-sm text-muted mb-3">
            {pendingFriend > 0 ? `${pendingFriend} waiting on your decision.` : "Nothing new right now."}
          </p>
          <PillButton href="/matches?mode=FRIEND" variant="secondary">
            View
          </PillButton>
        </Card>
      </div>

      {squad.data ? (
        <Card>
          <h3 className="font-semibold mb-1">Your squad</h3>
          <p className="text-sm text-muted mb-3">You're in a squad of {squad.data.members?.length ?? 0}.</p>
          <PillButton href="/squad" variant="secondary">
            View squad
          </PillButton>
        </Card>
      ) : null}

      <Card>
        <SectionHeading>Recent notifications</SectionHeading>
        {notifications.data?.length ? (
          <ul className="space-y-2">
            {notifications.data.slice(0, 5).map((n) => (
              <li key={n.id} className="text-sm">
                <span className="font-medium">{n.title}</span>{" "}
                <span className="text-muted">{n.body}</span>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState>Nothing yet — check back after the next Match Drop.</EmptyState>
        )}
      </Card>
    </div>
  );
}

function formatMilestone(key: string): string {
  if (key === "questionnaireCloses") return "Questionnaire closes";
  if (key === "promStarts") return "Prom night";
  if (key.startsWith("drop")) return `Match Drop #${key.replace("drop", "")}`;
  return key;
}
