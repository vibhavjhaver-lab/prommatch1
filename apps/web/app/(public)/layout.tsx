import Link from "next/link";
import { getEventConfig } from "../../lib/config.js";
import { Container } from "../../components/ui.js";

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const config = await getEventConfig();
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-text/10">
        <Container className="flex items-center justify-between py-4">
          <Link href="/" className="font-heading text-xl text-gold">
            {config.appName}
          </Link>
          <nav className="flex gap-4 text-sm text-muted">
            <Link href="/faq">FAQ</Link>
            <Link href="/signin">Sign in</Link>
          </nav>
        </Container>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t border-text/10 py-6">
        <Container className="flex flex-wrap gap-4 text-xs text-muted">
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/conduct">Code of conduct</Link>
          <span>
            &copy; {new Date().getFullYear()} {config.collegeName}
          </span>
        </Container>
      </footer>
    </div>
  );
}
