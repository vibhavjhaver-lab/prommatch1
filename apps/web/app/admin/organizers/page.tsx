"use client";

import { useSession } from "next-auth/react";
import { trpc } from "../../../lib/trpc.js";
import { Card, PillButton } from "../../../components/ui.js";

export default function OrganizersPage() {
  const { data: session } = useSession();
  const isSuperadmin = session?.user?.role === "SUPERADMIN";
  const list = trpc.admin.organizers.list.useQuery(undefined, { enabled: isSuperadmin });
  const utils = trpc.useUtils();
  const promote = trpc.admin.organizers.promote.useMutation({ onSuccess: () => utils.admin.organizers.list.invalidate() });
  const demote = trpc.admin.organizers.demote.useMutation({ onSuccess: () => utils.admin.organizers.list.invalidate() });

  if (!isSuperadmin) {
    return <p className="text-sm text-muted">Only superadmins can manage organizers.</p>;
  }

  return (
    <div className="space-y-4">
      <h1 className="font-heading text-2xl mb-2">Organizers</h1>
      <p className="text-sm text-muted">
        To promote a new organizer, have them sign in once first (search for them in Users), then promote here using
        their email — or use admin.users.search to find their id.
      </p>
      <div className="space-y-2">
        {list.data?.map((u) => (
          <Card key={u.id} className="flex items-center justify-between">
            <div>
              <p className="font-medium">{u.profile?.displayName ?? u.email}</p>
              <p className="text-xs text-muted">
                {u.email} · {u.role}
              </p>
            </div>
            {u.role === "SUPERADMIN" ? (
              <span className="text-xs text-muted">Superadmin</span>
            ) : (
              <PillButton variant="danger" onClick={() => demote.mutate({ userId: u.id })}>
                Demote
              </PillButton>
            )}
          </Card>
        ))}
      </div>
      <PromoteByUserId onPromote={(userId) => promote.mutate({ userId })} pending={promote.isPending} />
    </div>
  );
}

function PromoteByUserId({ onPromote, pending }: { onPromote: (userId: string) => void; pending: boolean }) {
  return (
    <Card>
      <p className="text-sm font-medium mb-2">Promote by user id</p>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const input = e.currentTarget.elements.namedItem("userId") as HTMLInputElement;
          if (input.value.trim()) onPromote(input.value.trim());
        }}
      >
        <input name="userId" placeholder="user id" className="input" />
        <PillButton type="submit" variant="primary" disabled={pending}>
          Promote
        </PillButton>
      </form>
    </Card>
  );
}
