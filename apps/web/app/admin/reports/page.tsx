"use client";

import { useState } from "react";
import { trpc } from "../../../lib/trpc.js";
import { Card, PillButton, EmptyState } from "../../../components/ui.js";

const ACTIONS = ["dismiss", "warn", "remove_content", "suspend", "ban"] as const;

export default function ReportsPage() {
  const queue = trpc.admin.reports.queue.useQuery();
  const utils = trpc.useUtils();
  const act = trpc.admin.reports.act.useMutation({ onSuccess: () => utils.admin.reports.queue.invalidate() });
  const [note, setNote] = useState<Record<string, string>>({});

  return (
    <div className="space-y-4">
      <h1 className="font-heading text-2xl mb-2">Reports</h1>
      {queue.data?.length ? (
        queue.data.map((r) => (
          <Card key={r.id}>
            <div className="flex justify-between mb-2">
              <p className="font-semibold">{r.category}</p>
              <p className="text-xs text-muted">{new Date(r.createdAt).toLocaleString()}</p>
            </div>
            <p className="text-sm text-muted mb-1">
              {r.reporter?.profile?.displayName ?? "Someone"} reported {r.reported?.profile?.displayName ?? "someone"} ·
              context: {r.context}
            </p>
            <p className="text-sm mb-3">{r.details}</p>
            <input
              placeholder="Note (required)"
              value={note[r.id] ?? ""}
              onChange={(e) => setNote((cur) => ({ ...cur, [r.id]: e.target.value }))}
              className="input mb-3 text-sm"
            />
            <div className="flex gap-2 flex-wrap">
              {ACTIONS.map((a) => (
                <PillButton
                  key={a}
                  variant={a === "ban" || a === "suspend" ? "danger" : a === "dismiss" ? "secondary" : "primary"}
                  disabled={!note[r.id]?.trim() || act.isPending}
                  onClick={() => act.mutate({ reportId: r.id, action: a, note: note[r.id] })}
                >
                  {a.replace("_", " ")}
                </PillButton>
              ))}
            </div>
          </Card>
        ))
      ) : (
        <EmptyState>All quiet. Nice.</EmptyState>
      )}
    </div>
  );
}
