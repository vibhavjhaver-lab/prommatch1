import { Body, Container, Head, Html, Preview, Section, Text, Hr } from "@react-email/components";
import * as React from "react";
import { tokens } from "@prommatch/ui-tokens";

export interface LayoutProps {
  previewText: string;
  appName: string;
  children: React.ReactNode;
  footer?: string;
}

/**
 * Shared email layout matching the "midnight gala" design tokens, dark
 * background (emails always render in a fixed scheme — client dark-mode
 * support varies too much to rely on CSS variables here, so values are
 * inlined from packages/ui-tokens).
 */
export function Layout({ previewText, appName, children, footer }: LayoutProps) {
  const t = tokens.dark;
  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={{ backgroundColor: t.bg, fontFamily: "Inter, Arial, sans-serif", margin: 0 }}>
        <Container
          style={{
            backgroundColor: t.surface,
            borderRadius: 16,
            padding: 32,
            maxWidth: 480,
            margin: "40px auto",
          }}
        >
          <Text style={{ color: t.gold, fontSize: 14, fontWeight: 600, letterSpacing: 1, textTransform: "uppercase" }}>
            {appName}
          </Text>
          {children}
          <Hr style={{ borderColor: t.muted, opacity: 0.2, margin: "24px 0" }} />
          <Text style={{ color: t.muted, fontSize: 12 }}>
            {footer ?? `You're receiving this because you have an account on ${appName}. Manage notification preferences in Settings.`}
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export function PrimaryButton({ href, children }: { href: string; children: React.ReactNode }) {
  const t = tokens.dark;
  return (
    <Section style={{ textAlign: "center", margin: "24px 0" }}>
      <a
        href={href}
        style={{
          backgroundColor: t.gold,
          color: t.bg,
          padding: "12px 28px",
          borderRadius: 999,
          fontWeight: 600,
          textDecoration: "none",
          display: "inline-block",
        }}
      >
        {children}
      </a>
    </Section>
  );
}
