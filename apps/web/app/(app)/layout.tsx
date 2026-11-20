import { redirect } from "next/navigation";
import { auth } from "../../lib/auth.js";
import { AppShell } from "../../components/app-shell.js";

/**
 * The student app proper (home, matches, chat, squad, promposals,
 * settings) — distinct from the (auth) group, whose only member is
 * /welcome. Anyone who hasn't finished the onboarding wizard (status
 * still PENDING_VERIFICATION or ONBOARDING) is sent back there; everyone
 * else gets the shared app shell.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) {
    redirect("/signin");
  }
  if (session.user.status === "SUSPENDED" || session.user.status === "BANNED") {
    redirect("/signin?restricted=1");
  }
  // DELETED is deliberately NOT redirected here: me.deleteAccount sets this
  // status immediately but only starts a 7-day grace period (the
  // data.deleteAccounts job skips anything newer than that) — a student
  // needs to keep reaching /settings during the grace period to call
  // me.cancelDeletion, which this redirect would otherwise block on every
  // single request.
  if (session.user.status === "PENDING_VERIFICATION" || session.user.status === "ONBOARDING") {
    redirect("/welcome");
  }

  return <AppShell user={session.user}>{children}</AppShell>;
}
