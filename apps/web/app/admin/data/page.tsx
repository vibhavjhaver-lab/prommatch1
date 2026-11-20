"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { trpc } from "../../../lib/trpc.js";
import { Card, PillButton, SectionHeading } from "../../../components/ui.js";

export default function DataPage() {
  const { data: session } = useSession();
  const isSuperadmin = session?.user?.role === "SUPERADMIN";
  const aggregate = trpc.admin.data.exportAggregate.useQuery();
  const exportFull = trpc.admin.data.exportFull.useMutation();
  const utils = trpc.useUtils();
  const wipeStatus = trpc.admin.data.wipeStatus.useQuery(undefined, { enabled: isSuperadmin });
  const wipe = trpc.admin.data.wipeEvent.useMutation({ onSuccess: () => utils.admin.data.wipeStatus.invalidate() });
  const cancelWipe = trpc.admin.data.cancelWipe.useMutation({ onSuccess: () => utils.admin.data.wipeStatus.invalidate() });
  const [confirmPhrase, setConfirmPhrase] = useState("");
  const [confirming, setConfirming] = useState(false);

  return (
    <div className="space-y-6 max-w-lg">
      <h1 className="font-heading text-2xl">Data</h1>

      <Card>
        <SectionHeading>Aggregate stats</SectionHeading>
        {aggregate.data ? (
          <ul className="text-sm space-y-1">
            <li>Users: {aggregate.data.users}</li>
            <li>Matches: {aggregate.data.matches}</li>
            <li>Reports: {aggregate.data.reports}</li>
          </ul>
        ) : (
          <p className="text-sm text-muted">Loading…</p>
        )}
      </Card>

      {isSuperadmin ? (
        <>
          <Card>
            <SectionHeading>Full export</SectionHeading>
            <p className="text-sm text-muted mb-3">
              Generates a full data export and emails you a signed download link.
            </p>
            <PillButton variant="secondary" onClick={() => exportFull.mutate()} disabled={exportFull.isPending}>
              {exportFull.data ? "Export requested" : "Request full export"}
            </PillButton>
          </Card>

          <Card className="border-danger/40">
            <SectionHeading>Wipe event data</SectionHeading>
            {wipeStatus.data ? (
              <div className="space-y-3">
                <p className="text-sm text-danger">
                  A wipe is scheduled for {new Date(wipeStatus.data.at).toLocaleString()}. Everything — students,
                  matches, chats, reports — will be permanently deleted at that time unless cancelled.
                </p>
                <PillButton variant="secondary" onClick={() => cancelWipe.mutate()} disabled={cancelWipe.isPending}>
                  Cancel scheduled wipe
                </PillButton>
              </div>
            ) : (
              <>
                <p className="text-sm text-muted mb-3">
                  Permanently deletes all event data after a 48-hour window during which any superadmin can cancel.
                  Type <code>DELETE ALL EVENT DATA</code> to confirm.
                </p>
                {confirming ? (
                  <div className="space-y-3">
                    <input
                      value={confirmPhrase}
                      onChange={(e) => setConfirmPhrase(e.target.value)}
                      className="input"
                      placeholder="DELETE ALL EVENT DATA"
                    />
                    <div className="flex gap-3">
                      <PillButton variant="secondary" onClick={() => setConfirming(false)}>
                        Cancel
                      </PillButton>
                      <PillButton
                        variant="danger"
                        disabled={confirmPhrase !== "DELETE ALL EVENT DATA" || wipe.isPending}
                        onClick={() => wipe.mutate({ confirmationPhrase: "DELETE ALL EVENT DATA" })}
                      >
                        Confirm wipe
                      </PillButton>
                    </div>
                  </div>
                ) : (
                  <PillButton variant="danger" onClick={() => setConfirming(true)}>
                    Wipe event data
                  </PillButton>
                )}
              </>
            )}
          </Card>
        </>
      ) : null}
    </div>
  );
}
