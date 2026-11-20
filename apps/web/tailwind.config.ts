import type { Config } from "tailwindcss";

/**
 * Tailwind maps onto the CSS custom properties defined in
 * @prommatch/ui-tokens/tokens.css rather than hardcoding colors, so an
 * event's theme.overrides (written to <html> as inline custom properties
 * in app/layout.tsx) automatically repaint every Tailwind utility that
 * uses these names — no per-college rebuild needed.
 */
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  darkMode: ["selector", '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        surface: "var(--surface)",
        text: "var(--text)",
        muted: "var(--muted)",
        gold: "var(--gold)",
        rose: "var(--rose)",
        teal: "var(--teal)",
        violet: "var(--violet)",
        danger: "var(--danger)",
      },
      borderRadius: {
        card: "var(--radius-card)",
        pill: "var(--radius-pill)",
      },
      fontFamily: {
        heading: ["var(--font-heading)"],
        body: ["var(--font-body)"],
      },
    },
  },
  plugins: [],
};

export default config;
