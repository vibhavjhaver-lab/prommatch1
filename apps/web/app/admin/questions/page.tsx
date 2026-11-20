"use client";

import { trpc } from "../../../lib/trpc.js";
import { Card, PillButton, SectionHeading } from "../../../components/ui.js";

export default function QuestionsPage() {
  const questions = trpc.admin.questions.list.useQuery();
  const utils = trpc.useUtils();
  const setActive = trpc.admin.questions.setActive.useMutation({ onSuccess: () => utils.admin.questions.list.invalidate() });

  return (
    <div className="space-y-4">
      <h1 className="font-heading text-2xl mb-2">Questions</h1>
      <p className="text-sm text-muted">
        {questions.data?.length ?? 0} questions configured. New questions are added by editing the question bank in
        code (packages/config/src/question-bank.ts) and redeploying — toggling active/inactive here takes effect
        immediately for the next round.
      </p>
      <div className="space-y-2">
        {questions.data?.map((q) => (
          <Card key={q.id} className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">{q.text}</p>
              <p className="text-xs text-muted">
                {q.section} · {q.type} · modes: {q.modes.length ? q.modes.join(", ") : "all"}
              </p>
            </div>
            <PillButton
              variant={q.active ? "secondary" : "primary"}
              onClick={() => setActive.mutate({ id: q.id, active: !q.active })}
            >
              {q.active ? "Deactivate" : "Activate"}
            </PillButton>
          </Card>
        ))}
      </div>
    </div>
  );
}
