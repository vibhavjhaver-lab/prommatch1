"use client";

import { useState } from "react";
import { trpc } from "../../../lib/trpc.js";
import { Card, PillButton } from "../../../components/ui.js";

const STATUSES = ["ACTIVE", "PAUSED", "SUSPENDED", "BANNED"] as const;

export default function UsersPage() {
  const [query, setQuery] = useState("");
  const [submitted, setSubmitted] = useState("");
  const results = trpc.admin.users.search.useQuery({ query: submitted }, { enabled: submitted.length > 0 });
  const utils = trpc.useUtils();
  const setStatus = trpc.admin.users.setStatus.useMutation({ onSuccess: () => utils.admin.users.search.invalidate() });

  return (
    <div className="space-y-4">
      <h1 className="font-heading text-2xl mb-2">Users</h1>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setSubmitted(query.trim());
        }}
        className="flex gap-2"
      >
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name or email" className="input" />
        <PillButton type="submit" variant="primary">
          Search
        </PillButton>
      </form>

      <div className="space-y-2">
        {results.data?.map((u) => (
          <Card key={u.id} className="flex items-center justify-between">
            <div>
              <p className="font-medium">{u.profile?.displayName ?? u.email}</p>
              <p className="text-xs text-muted">
                {u.email} · {u.role} · {u.status}
              </p>
            </div>
            <select
              value={u.status}
              onChange={(e) => setStatus.mutate({ userId: u.id, status: e.target.value as (typeof STATUSES)[number] })}
              className="input w-auto text-sm"
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </Card>
        ))}
      </div>
    </div>
  );
}
