"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { Container, PillButton, Card } from "../../../components/ui.js";

export default function VerifyPage() {
  const searchParams = useSearchParams();
  const email = searchParams.get("email") ?? "";
  const from = searchParams.get("from");
  const [code, setCode] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // This is exactly what clicking the magic link in the email does —
    // Auth.js's EmailProvider verifies a presented token the same way
    // whether it arrives via link click or typed here, because
    // generateVerificationToken (lib/auth.ts) makes the code and the
    // link's ?token= the same raw value (see DECISIONS.md).
    const callbackUrl = from && from.startsWith("/") ? from : "/welcome";
    const params = new URLSearchParams({
      token: code.trim().toUpperCase(),
      email,
      callbackUrl,
    });
    window.location.href = `/api/auth/callback/college-email?${params.toString()}`;
  }

  return (
    <Container className="py-16">
      <h1 className="font-heading text-3xl mb-2">Check your inbox</h1>
      <p className="text-muted mb-8 text-sm">
        We sent a link and an 8-character code to <span className="text-text">{email}</span>. Click the link, or
        type the code below — either one signs you in. It expires in 15 minutes.
      </p>

      <Card className="max-w-md">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="code" className="block text-sm font-medium mb-1">
              8-character code
            </label>
            <input
              id="code"
              required
              maxLength={8}
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="ABCD2345"
              className="w-full rounded-card border border-text/20 bg-bg px-3 py-2 text-text font-mono tracking-widest text-center text-lg"
            />
          </div>
          <PillButton type="submit" variant="primary" className="w-full">
            Verify
          </PillButton>
        </form>
      </Card>
    </Container>
  );
}
