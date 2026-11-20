"use client";

import { useState } from "react";
import { trpc } from "../../../lib/trpc.js";
import { Card, PillButton, EmptyState } from "../../../components/ui.js";

export default function PhotosPage() {
  const queue = trpc.admin.photos.queue.useQuery();
  const utils = trpc.useUtils();
  const review = trpc.admin.photos.review.useMutation({ onSuccess: () => utils.admin.photos.queue.invalidate() });
  const [reason, setReason] = useState<Record<string, string>>({});

  return (
    <div className="space-y-4">
      <h1 className="font-heading text-2xl mb-2">Photo review</h1>
      {queue.data?.length ? (
        <div className="grid sm:grid-cols-2 gap-4">
          {queue.data.map((p) => (
            <Card key={p.id}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.signedUrl} alt="Pending review" className="rounded-card mb-3 w-full h-48 object-cover" />
              <p className="text-sm text-muted mb-2">{p.user?.profile?.displayName ?? "Unknown"}</p>
              <input
                placeholder="Rejection reason (if rejecting)"
                value={reason[p.id] ?? ""}
                onChange={(e) => setReason((cur) => ({ ...cur, [p.id]: e.target.value }))}
                className="input mb-3 text-sm"
              />
              <div className="flex gap-3">
                <PillButton
                  variant="danger"
                  onClick={() => review.mutate({ photoId: p.id, decision: "REJECTED", rejectReason: reason[p.id] })}
                >
                  Reject
                </PillButton>
                <PillButton variant="primary" onClick={() => review.mutate({ photoId: p.id, decision: "APPROVED" })}>
                  Approve
                </PillButton>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState>Nothing waiting on review.</EmptyState>
      )}
    </div>
  );
}
