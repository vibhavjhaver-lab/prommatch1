import { redirect } from "next/navigation";
import { auth } from "../../lib/auth.js";
import { AppShell } from "../../components/app-shell.js";

/**
 * Authoritative auth boundary for every page under this group (home,
 * matches, chat, squad, promposals, settings, welcome): middleware.ts
 * only checks for a cookie, so this layout is where the real session (and,
 * for everything except /welcome itself, onboarding completion) is
 * actually verified, per request, server-side.
 */
export default async function AuthedLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) {
    redirect("/signin");
  }
  if (session.user.status === "SUSPENDED" || session.user.status === "BANNED" || session.user.status === "DELETED") {
    redirect("/signin?restricted=1");
  }

  return <AppShell user={session.user}>{children}</AppShell>;
}
