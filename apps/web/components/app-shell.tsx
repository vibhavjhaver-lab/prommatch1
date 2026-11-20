"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { Container } from "./ui.js";

type NavUser = { id: string; role: "STUDENT" | "ORGANIZER" | "SUPERADMIN"; status: string };

const STUDENT_NAV = [
  { href: "/home", label: "Home" },
  { href: "/matches", label: "Matches" },
  { href: "/chat", label: "Chat" },
  { href: "/squad", label: "Squad" },
  { href: "/promposals", label: "Promposals" },
  { href: "/settings", label: "Settings" },
];

/** Shared nav/footer chrome for every signed-in page — student links plus an Admin link for organizers/superadmins. */
export function AppShell({ user, children }: { user: NavUser; children: React.ReactNode }) {
  const pathname = usePathname();
  const nav = user.role === "STUDENT" ? STUDENT_NAV : [...STUDENT_NAV, { href: "/admin", label: "Admin" }];

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-text/10 sticky top-0 bg-bg/95 backdrop-blur z-10">
        <Container className="flex items-center justify-between py-3 max-w-5xl">
          <Link href="/home" className="font-heading text-lg text-gold">
            PromMatch
          </Link>
          <nav className="hidden sm:flex gap-4 text-sm">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={pathname?.startsWith(item.href) ? "text-gold" : "text-muted hover:text-text"}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <button onClick={() => signOut({ callbackUrl: "/" })} className="text-sm text-muted hover:text-text">
            Sign out
          </button>
        </Container>
      </header>

      <nav className="sm:hidden border-b border-text/10 overflow-x-auto">
        <div className="flex gap-4 px-5 py-2 text-sm whitespace-nowrap">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={pathname?.startsWith(item.href) ? "text-gold" : "text-muted"}
            >
              {item.label}
            </Link>
          ))}
        </div>
      </nav>

      <main className="flex-1">
        <Container className="max-w-5xl py-6">{children}</Container>
      </main>
    </div>
  );
}
