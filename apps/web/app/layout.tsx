import type { Metadata, Viewport } from "next";
import { getEventConfig } from "../lib/config.js";
import { Providers } from "./providers.js";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const config = await getEventConfig();
  return {
    title: `${config.appName} · ${config.collegeName}`,
    description: `Find your ${config.eventName} match.`,
    manifest: "/manifest.webmanifest",
    icons: { icon: "/icon.png", apple: "/apple-icon.png" },
  };
}

export const viewport: Viewport = {
  themeColor: "#0b1026",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const config = await getEventConfig();

  // Per-event theme overrides win over the ui-tokens defaults because this
  // inline style tag is injected after tokens.css loads (see
  // packages/ui-tokens/src/tokens.css's own header comment) — the admin
  // console writes these via EventConfig.theme.overrides.
  const overrideEntries = Object.entries(config.theme.overrides);
  const overrideCss = overrideEntries.length
    ? `:root{${overrideEntries.map(([k, v]) => `--${k}:${v}`).join(";")}}`
    : "";

  return (
    <html lang="en" data-theme={config.theme.mode}>
      <head>{overrideCss ? <style dangerouslySetInnerHTML={{ __html: overrideCss }} /> : null}</head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
