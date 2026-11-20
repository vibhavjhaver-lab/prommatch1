"use client";

import { useState } from "react";
import { trpc } from "../../../lib/trpc.js";
import { Card, PillButton, SectionHeading } from "../../../components/ui.js";

type Audience = "all" | "DATE" | "FRIEND" | "SQUAD" | "unmatched" | "matched" | "going_together";

export default function AnnouncementsPage() {
  const list = trpc.admin.announcements.list.useQuery();
  const utils = trpc.useUtils();
  const create = trpc.admin.announcements.create.useMutation({ onSuccess: () => utils.admin.announcements.list.invalidate() });

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState<Audience>("all");
  const [publishAt, setPublishAt] = useState("");

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-2xl">Announcements</h1>

      <Card>
        <SectionHeading>New announcement</SectionHeading>
        <div className="space-y-3">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" className="input" />
          <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Body" rows={3} className="input resize-none" />
          <div className="flex gap-3">
            <select value={audience} onChange={(e) => setAudience(e.target.value as Audience)} className="input">
              {["all", "DATE", "FRIEND", "SQUAD", "unmatched", "matched", "going_together"].map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
            <input type="datetime-local" value={publishAt} onChange={(e) => setPublishAt(e.target.value)} className="input" />
          </div>
          <PillButton
            variant="primary"
            disabled={!title.trim() || !body.trim() || !publishAt || create.isPending}
            onClick={() => create.mutate({ title, body, audience, publishAt: new Date(publishAt) })}
          >
            Schedule
          </PillButton>
        </div>
      </Card>

      <div className="space-y-2">
        {list.data?.map((a) => (
          <Card key={a.id}>
            <p className="font-semibold">{a.title}</p>
            <p className="text-sm text-muted">
              {a.audience} · {new Date(a.publishAt).toLocaleString()}
            </p>
          </Card>
        ))}
      </div>
    </div>
  );
}
