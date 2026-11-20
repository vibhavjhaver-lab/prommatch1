"use client";

import { useEffect, useState } from "react";
import { trpc } from "../../../lib/trpc.js";
import { Card, PillButton, SectionHeading } from "../../../components/ui.js";

/**
 * Edits the subset of EventConfig organizers are meant to touch day-to-day
 * (spec section 3's `config:editDatesAndCopy` policy): the event's dates
 * and user-facing names. A superadmin can go further via admin.config.update.all,
 * but that's a riskier full-object write this page doesn't expose yet —
 * deliberately left to a follow-up rather than shipped half-validated.
 */
export default function ConfigPage() {
  const config = trpc.admin.config.get.useQuery();
  const utils = trpc.useUtils();
  const update = trpc.admin.config.update.datesAndCopy.useMutation({ onSuccess: () => utils.admin.config.get.invalidate() });

  const [form, setForm] = useState<typeof config.data | null>(null);
  useEffect(() => {
    if (config.data && !form) setForm(config.data);
  }, [config.data, form]);

  if (!form) return <p className="text-sm text-muted">Loading…</p>;

  return (
    <div className="space-y-6 max-w-lg">
      <h1 className="font-heading text-2xl">Event config</h1>

      <Card>
        <SectionHeading>Names</SectionHeading>
        <div className="space-y-3">
          <LabeledInput label="College name" value={form.collegeName} onChange={(v) => setForm({ ...form, collegeName: v })} />
          <LabeledInput label="Event name" value={form.eventName} onChange={(v) => setForm({ ...form, eventName: v })} />
          <LabeledInput label="App name" value={form.appName} onChange={(v) => setForm({ ...form, appName: v })} />
        </div>
      </Card>

      <Card>
        <SectionHeading>Key dates</SectionHeading>
        <div className="space-y-3">
          <DateInput
            label="Questionnaire opens"
            value={form.dates.questionnaireOpensAt}
            onChange={(v) => setForm({ ...form, dates: { ...form.dates, questionnaireOpensAt: v } })}
          />
          <DateInput
            label="Questionnaire closes"
            value={form.dates.questionnaireClosesAt}
            onChange={(v) => setForm({ ...form, dates: { ...form.dates, questionnaireClosesAt: v } })}
          />
          <DateInput
            label="Prom starts"
            value={form.dates.promStartsAt}
            onChange={(v) => setForm({ ...form, dates: { ...form.dates, promStartsAt: v } })}
          />
          <DateInput
            label="Prom ends"
            value={form.dates.promEndsAt}
            onChange={(v) => setForm({ ...form, dates: { ...form.dates, promEndsAt: v } })}
          />
        </div>
      </Card>

      {update.error ? <p className="text-sm text-danger">{update.error.message}</p> : null}

      <PillButton variant="primary" disabled={update.isPending} onClick={() => update.mutate(form)}>
        Save changes
      </PillButton>
    </div>
  );
}

function LabeledInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block text-sm">
      {label}
      <input value={value} onChange={(e) => onChange(e.target.value)} className="input mt-1" />
    </label>
  );
}

function DateInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block text-sm">
      {label}
      <input
        type="datetime-local"
        value={value ? value.slice(0, 16) : ""}
        onChange={(e) => onChange(new Date(e.target.value).toISOString())}
        className="input mt-1"
      />
    </label>
  );
}
