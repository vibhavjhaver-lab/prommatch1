"use client";

import { useState } from "react";
import { trpc } from "../../../lib/trpc.js";
import { Card } from "../../../components/ui.js";

export default function AuditPage() {
  const [filter, setFilter] = useState("");
  const list = trpc.admin.audit.list.useQuery({ action: filter || undefined });

  return (
    <div className="space-y-4">
      <h1 className="font-heading text-2xl mb-2">Audit log</h1>
      <input
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="Filter by action (e.g. report., photo., round.)"
        className="input"
      />
      <div className="space-y-2">
        {list.data?.map((entry) => (
          <Card key={entry.id} className="text-sm">
            <div className="flex justify-between">
              <span className="font-mono">{entry.action}</span>
              <span className="text-xs text-muted">{new Date(entry.createdAt).toLocaleString()}</span>
            </div>
            <p className="text-xs text-muted">
              actor: {entry.actorId ?? "system"} · target: {entry.targetType ?? "—"} {entry.targetId ?? ""}
            </p>
          </Card>
        ))}
      </div>
    </div>
  );
}
