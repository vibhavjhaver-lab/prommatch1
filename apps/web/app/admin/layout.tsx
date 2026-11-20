import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "../../lib/auth.js";
import { Container } from "../../components/ui.js";

const NAV = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/rounds", label: "Rounds" },
  { href: "/admin/questions", label: "Questions" },
  { href: "/admin/photos", label: "Photos" },
  { href: "/admin/reports", label: "Reports" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/announcements", label: "Announcements" },
  { href: "/admin/config", label: "Event config" },
  { href: "/admin/audit", label: "Audit log" },
  { href: "/admin/data", label: "Data" },
  { href: "/admin/organizers", label: "Organizers" },
];

/** Separate top-level group from /(app) — the organizer console has its own nav and a stricter role gate. */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/signin");
  if (session.user.role !== "ORGANIZER" && session.user.role !== "SUPERADMIN") redirect("/home");

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-text/10">
        <Container className="max-w-6xl flex items-center justify-between py-3">
          <Link href="/admin" className="font-heading text-lg text-gold">
            PromMatch admin
          </Link>
          <Link href="/home" className="text-sm text-muted hover:text-text">
            Back to app
          </Link>
        </Container>
      </header>
      <div className="flex flex-1">
        <nav className="w-48 border-r border-text/10 py-6 hidden md:block">
          <ul className="space-y-1 px-3 text-sm">
            {NAV.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="block rounded-pill px-3 py-1.5 text-muted hover:text-text hover:bg-text/5">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <main className="flex-1 py-6">
          <Container className="max-w-4xl">{children}</Container>
        </main>
      </div>
    </div>
  );
}
