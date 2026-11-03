import type { Tone } from "../lib/display";

// Monochrome like the web console: near-black accent, zinc neutrals. Colour carries status only, and every status
// also shows an icon and text, so colour never carries meaning alone.

export const color = {
  bg: "#fafafa",
  card: "#ffffff",
  line: "#e4e4e7",
  text: "#18181b",
  text2: "#52525b",
  muted: "#71717a",
  faint: "#a1a1aa",
  brand: "#18181b",
  onBrand: "#ffffff",
  subtle: "#f4f4f5",
  danger: "#b91c1c",
  dangerBg: "#fef2f2",
  warnBg: "#fefce8",
  warnText: "#713f12",
  okBg: "#f0fdf4",
  okText: "#166534",
  ok: "#15803d",
} as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 } as const;
export const radius = { sm: 8, md: 12, lg: 16, pill: 999 } as const;
export const font = { xs: 12, sm: 13, md: 15, lg: 17, xl: 22 } as const;

/** bg, text and border colours for a status pill, and the left rule on a hospital card. */
export const TONE_COLOR: Record<Tone, { bg: string; fg: string; border: string; accent: string }> = {
  grey: { bg: "#fafafa", fg: "#71717a", border: "#e4e4e7", accent: "#e4e4e7" },
  blue: { bg: "#ecfeff", fg: "#155e75", border: "#a5f3fc", accent: "#22d3ee" },
  amber: { bg: "#eff6ff", fg: "#1e40af", border: "#bfdbfe", accent: "#3b82f6" },
  green: { bg: "#f0fdf4", fg: "#166534", border: "#bbf7d0", accent: "#22c55e" },
  "green-cond": { bg: "#f0fdf4", fg: "#166534", border: "#facc15", accent: "#4ade80" },
  red: { bg: "#fef2f2", fg: "#b91c1c", border: "#fecaca", accent: "#fca5a5" },
  purple: { bg: "#fefce8", fg: "#713f12", border: "#facc15", accent: "#eab308" },
  slate: { bg: "#f5f5f4", fg: "#44403c", border: "#e7e5e4", accent: "#d6d3d1" },
  dark: { bg: "#f4f4f5", fg: "#52525b", border: "#e4e4e7", accent: "#e4e4e7" },
  orange: { bg: "#fefce8", fg: "#713f12", border: "#eab308", accent: "#eab308" },
  held: { bg: "#15803d", fg: "#ffffff", border: "#15803d", accent: "#15803d" },
};

/** The rank badge colour on a hospital card. */
export const PIN_COLOR: Record<Tone, string> = {
  grey: "#a1a1aa", blue: "#0e7490", amber: "#1d4ed8", green: "#15803d", "green-cond": "#15803d", red: "#b91c1c",
  purple: "#854d0e", slate: "#57534e", dark: "#71717a", orange: "#854d0e", held: "#166534",
};
