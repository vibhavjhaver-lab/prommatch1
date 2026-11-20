"use client";

import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { trpc } from "../../../lib/trpc.js";
import { Container, PillButton, Card } from "../../../components/ui.js";

export default function SignInPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestCode = trpc.auth.requestCode.useMutation();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const trimmed = email.trim().toLowerCase();

    try {
      await requestCode.mutateAsync({ email: trimmed });
    } catch (err) {
      const message =
        (err as { data?: { code?: string } })?.data?.code === "TOO_MANY_REQUESTS"
          ? "Too many attempts — try again in a bit."
          : "That doesn't look like a college email we accept.";
      setError(message);
      return;
    }

    // Auth.js's own signIn() is what actually dispatches the email.
    await signIn("college-email", { email: trimmed, redirect: false });
    const from = searchParams.get("from");
    router.push(`/verify?email=${encodeURIComponent(trimmed)}${from ? `&from=${encodeURIComponent(from)}` : ""}`);
  }

  return (
    <Container className="py-16">
      <h1 className="font-heading text-3xl mb-2">Sign in</h1>
      <p className="text-muted mb-8 text-sm">We'll email you a one-time link and code — no password needed.</p>

      <Card className="max-w-md">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium mb-1">
              College email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@college.edu"
              className="w-full rounded-card border border-text/20 bg-bg px-3 py-2 text-text"
            />
          </div>
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          <PillButton type="submit" variant="primary" disabled={requestCode.isPending} className="w-full">
            {requestCode.isPending ? "Sending…" : "Send me a link"}
          </PillButton>
        </form>
      </Card>
    </Container>
  );
}
