/**
 * Central design tokens — single source of truth for the whole app.
 *
 * Cross-platform note: this file holds NO web/DOM logic, only plain values.
 * When the app is ported to React Native (or wrapped via Capacitor), this same
 * token object is reused as-is — screens never hardcode a hex value, so theming
 * stays consistent across web, Android and iOS.
 */

// Surface + text tokens are CSS variables so the app can switch light / dark at
// runtime (see THEME_VARS + <ThemeProvider>). Brand colors stay literal — they
// read well on both grounds and are safe to concatenate alpha onto.
export const colors = {
  // surfaces
  shell: "var(--dg-shell)",
  bg: "var(--dg-bg)",
  card: "var(--dg-card)",
  cardAlt: "var(--dg-cardAlt)",
  input: "var(--dg-input)",
  line: "var(--dg-line)",
  lineSoft: "var(--dg-lineSoft)",

  // brand — DGR purple (#7C5CFF). `blue` is kept as the token name for the
  // primary accent (used in ~90 places) but now holds the brand purple so the
  // whole app reads on-brand; `purple` is a slightly lighter tint for gradients.
  blue: "#7c5cff",
  purple: "#9d81ff",
  green: "#22c55e",
  amber: "#f59e0b",
  red: "#ef4444",

  // text
  text: "var(--dg-text)",
  muted: "var(--dg-muted)",
  faint: "var(--dg-faint)",
} as const;

/** The light (default) + dark palettes behind the CSS variables above. Injected
 *  once at the app root. `:root` is LIGHT; `[data-theme="dark"]` swaps to dark. */
export const THEME_VARS = `
  :root {
    --dg-shell:#e7ebf3; --dg-bg:#f5f7fb; --dg-card:#ffffff; --dg-cardAlt:#f0f3f9; --dg-input:#eef2f8;
    --dg-line:rgba(13,38,76,0.10); --dg-lineSoft:rgba(13,38,76,0.06);
    --dg-text:#0f1728; --dg-muted:#5a6474; --dg-faint:#94a0b3;
  }
  :root[data-theme="dark"] {
    --dg-shell:#04060b; --dg-bg:#0a0d14; --dg-card:#10141f; --dg-cardAlt:#0d1120; --dg-input:#161d2e;
    --dg-line:rgba(255,255,255,0.06); --dg-lineSoft:rgba(255,255,255,0.04);
    --dg-text:#eef0f6; --dg-muted:#8892aa; --dg-faint:#4d5a72;
  }
  .dg-dialer-input::placeholder { color: var(--dg-faint); }
`;

export const gradients = {
  brand: `linear-gradient(135deg,${colors.blue},${colors.purple})`,
  brandRev: `linear-gradient(135deg,${colors.purple},${colors.blue})`,
  green: "linear-gradient(135deg,#16a34a,#15803d)",
  amber: "linear-gradient(135deg,#f59e0b,#d97706)",
} as const;

export const radius = { sm: 11, md: 14, lg: 18, xl: 24, pill: 999 } as const;

export const font = {
  sans: "'Inter', sans-serif",
  mono: "'JetBrains Mono', monospace",
} as const;

/** Phone-frame sizing used by the web preview shell. */
export const frame = { width: 390, height: 844 } as const;

export const theme = { colors, gradients, radius, font, frame };
export type Theme = typeof theme;

// Short alias kept for readability inside screens.
export const C = colors;
