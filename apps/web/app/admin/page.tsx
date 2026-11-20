"use client";

import { trpc } from "../../lib/trpc.js";
import { Card, SectionHeading } from "../../components/ui.js";

export default function AdminOverviewPage() {
  const overview = trpc.admin.stats.overview.useQuery();
  const funnel = trpc.admin.stats.funnel.useQuery();

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-2xl">Overview</h1>

      <div className="grid sm:grid-cols-3 gap-4">
        <Stat label="Total students" value={overview.data?.totalUsers} />
        <Stat label="Onboarded" value={overview.data?.onboarded} />
        <Stat label="Open reports" value={overview.data?.openReports} />
        <Stat label="Photos pending review" value={overview.data?.pendingPhotos} />
        <Stat label="Mutual matches" value={overview.data?.mutualCount} />
        <Stat
          label="Accept rate"
          value={overview.data ? `${Math.round(overview.data.acceptRate * 100)}%` : undefined}
        />
      </div>

      <Card>
        <SectionHeading>Funnel</SectionHeading>
        {funnel.data ? (
          <ul className="text-sm space-y-1">
            <li>Signed up: {funnel.data.signedUp}</li>
            <li>Verified: {funnel.data.verified}</li>
            <li>Onboarded: {funnel.data.onboarded}</li>
            <li>Matched: {funnel.data.matched}</li>
            <li>Mutual: {funnel.data.mutual}</li>
            <li>Going together: {funnel.data.goingTogether}</li>
          </ul>
        ) : (
          <p className="text-sm text-muted">Loading…</p>
        )}
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value?: number | string }) {
  return (
    <Card>
      <p className="text-xs text-muted mb-1">{label}</p>
      <p className="text-2xl font-heading text-gold">{value ?? "—"}</p>
    </Card>
  );
}
