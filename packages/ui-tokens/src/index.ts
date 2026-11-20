/** TS mirror of tokens.css, for contexts that can't read CSS variables (email templates, canvas/SVG). */
export const tokens = {
  dark: {
    bg: "#0B1026",
    surface: "#141B3A",
    text: "#F5F1E8",
    muted: "#A7ADC8",
    gold: "#E8C46A",
    rose: "#F29CB4",
    teal: "#6FD6C8",
    violet: "#A98BFF",
    danger: "#FF6B6B",
  },
  light: {
    bg: "#FBF8F3",
    surface: "#FFFFFF",
    text: "#1A1B2E",
    muted: "#5B5F78",
    gold: "#B8892B",
    rose: "#C9466E",
    teal: "#1F8A7E",
    violet: "#6A4FD1",
    danger: "#C62828",
  },
} as const;

export const modeAccent: Record<"DATE" | "FRIEND" | "SQUAD", keyof typeof tokens.dark> = {
  DATE: "rose",
  FRIEND: "teal",
  SQUAD: "violet",
};

export type ThemeMode = keyof typeof tokens;
