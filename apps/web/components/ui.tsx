import Link from "next/link";
import type { ReactNode } from "react";

/** Small shared primitives used across every page — intentionally minimal, styled purely through ui-tokens CSS vars via Tailwind's mapped classes. */

export function Container({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`mx-auto w-full max-w-3xl px-5 ${className}`}>{children}</div>;
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-card border border-text/10 bg-surface p-5 ${className}`}>{children}</div>;
}

export function PillButton({
  children,
  href,
  onClick,
  type = "button",
  variant = "primary",
  disabled = false,
  className = "",
}: {
  children: ReactNode;
  href?: string;
  onClick?: () => void;
  type?: "button" | "submit";
  variant?: "primary" | "secondary" | "ghost" | "danger";
  disabled?: boolean;
  className?: string;
}) {
  const base =
    "inline-flex items-center justify-center rounded-pill px-5 py-2.5 font-medium transition disabled:opacity-50 disabled:pointer-events-none";
  const styles: Record<string, string> = {
    primary: "bg-gold text-bg hover:brightness-110",
    secondary: "bg-surface border border-text/20 text-text hover:border-gold",
    ghost: "text-text hover:bg-text/5",
    danger: "bg-danger text-white hover:brightness-110",
  };
  const cls = `${base} ${styles[variant]} ${className}`;
  if (href) {
    return (
      <Link href={href} className={cls}>
        {children}
      </Link>
    );
  }
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={cls}>
      {children}
    </button>
  );
}

export function SectionHeading({ children }: { children: ReactNode }) {
  return <h2 className="font-heading text-2xl text-text mb-3">{children}</h2>;
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <p className="text-muted text-center py-10">{children}</p>;
}
