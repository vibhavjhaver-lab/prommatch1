"use client";

import { useSession } from "next-auth/react";
import { useState } from "react";
import { trpc } from "../../../lib/trpc.js";
import { Card, PillButton, SectionHeading } from "../../../components/ui.js";

export default function SettingsPage() {
  const { data: session } = useSession();
  const prefs = trpc.prefs.get.useQuery();
  const utils = trpc.useUtils();
  const pause = trpc.prefs.pause.useMutation({ onSuccess: () => utils.prefs.get.invalidate() });
  const resume = trpc.prefs.resume.useMutation({ onSuccess: () => utils.prefs.get.invalidate() });
  const exportData = trpc.me.requestDataExport.useMutation();
  const deleteAccount = trpc.me.deleteAccount.useMutation();
  const cancelDeletion = trpc.me.cancelDeletion.useMutation();
  const blocked = trpc.safety.listBlocked.useQuery();
  const unblock = trpc.safety.unblock.useMutation({ onSuccess: () => utils.safety.listBlocked.invalidate() });
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const isDeletionPending = session?.user?.status === "DELETED";

  return (
    <div className="space-y-5 max-w-xl">
      <h1 className="font-heading text-2xl mb-2">Settings</h1>

      {isDeletionPending ? (
        <Card className="border-danger/50">
          <SectionHeading>Account deletion scheduled</SectionHeading>
          <p className="text-sm text-muted mb-3">
            Your account is scheduled for permanent deletion. You can still cancel this within the grace period.
          </p>
          <PillButton variant="primary" onClick={() => cancelDeletion.mutate()} disabled={cancelDeletion.isPending}>
            Cancel deletion
          </PillButton>
        </Card>
      ) : null}

      <Card>
        <SectionHeading>Matching</SectionHeading>
        <p className="text-sm text-muted mb-3">
          {prefs.data?.paused ? "Matching is paused — you won't appear in any Match Drops." : "You're active in matching."}
        </p>
        {prefs.data?.paused ? (
          <PillButton variant="primary" onClick={() => resume.mutate()} disabled={resume.isPending}>
            Resume matching
          </PillButton>
        ) : (
          <PillButton variant="secondary" onClick={() => pause.mutate()} disabled={pause.isPending}>
            Pause matching
          </PillButton>
        )}
      </Card>

      <Card>
        <SectionHeading>Blocked people</SectionHeading>
        {blocked.data?.length ? (
          <ul className="space-y-2">
            {blocked.data.map((b) => (
              <li key={b.id} className="flex justify-between text-sm">
                <span>{b.blockedId}</span>
                <button
                  onClick={() => unblock.mutate({ blockedId: b.blockedId })}
                  className="text-gold underline"
                >
                  Unblock
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">You haven't blocked anyone.</p>
        )}
      </Card>

      <Card>
        <SectionHeading>Your data</SectionHeading>
        <div className="flex gap-3 flex-wrap">
          <PillButton
            variant="secondary"
            onClick={() => exportData.mutate()}
            disabled={exportData.isPending || exportData.isSuccess}
          >
            {exportData.isSuccess ? "Export requested" : "Request a copy of my data"}
          </PillButton>
        </div>
      </Card>

      {!isDeletionPending ? (
        <Card className="border-danger/30">
          <SectionHeading>Delete account</SectionHeading>
          <p className="text-sm text-muted mb-3">
            Permanent after a 7-day grace period, during which you can come back here to cancel.
          </p>
          {confirmingDelete ? (
            <div className="flex gap-3">
              <PillButton variant="secondary" onClick={() => setConfirmingDelete(false)}>
                Never mind
              </PillButton>
              <PillButton variant="danger" onClick={() => deleteAccount.mutate()} disabled={deleteAccount.isPending}>
                Yes, delete my account
              </PillButton>
            </div>
          ) : (
            <PillButton variant="danger" onClick={() => setConfirmingDelete(true)}>
              Delete my account
            </PillButton>
          )}
        </Card>
      ) : null}
    </div>
  );
}
