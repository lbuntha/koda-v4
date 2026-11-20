import type { Color } from "./board";

/**
 * Apparatus colours, with permanent text/symbol identities. Surrounding UI uses theme tokens.
 *
 * Each fill is a CSS variable with the light value as its fallback, so a board
 * drawn outside a themed wrapper (a worksheet, a test) still has its colours.
 * `PALETTE_THEME` sets the variables, and in dark mode lifts navy: the light
 * navy is nearly the colour of the dark page, so a navy tile read as a hole in
 * the board rather than a colour.
 */
export const PALETTE: Readonly<Record<Color, { name: string; symbol: string; letter: string; fill: string; ink: string }>> = {
  orange: { name: "Orange", symbol: "●", letter: "O", fill: "var(--cs-orange, #ff5900)", ink: "var(--cs-orange-ink, #19283b)" },
  navy: { name: "Navy", symbol: "◆", letter: "N", fill: "var(--cs-navy, #19283b)", ink: "var(--cs-navy-ink, #ffffff)" },
  cyan: { name: "Cyan", symbol: "▲", letter: "C", fill: "var(--cs-cyan, #2dc4d4)", ink: "var(--cs-cyan-ink, #19283b)" },
};

/** The shades `PALETTE_THEME` sets, as data, so contrast can be checked in both themes. */
export const SHADES: Readonly<Record<"light" | "dark", Record<Color, { fill: string; ink: string }>>> = {
  light: {
    orange: { fill: "#ff5900", ink: "#19283b" },
    navy: { fill: "#19283b", ink: "#ffffff" },
    cyan: { fill: "#2dc4d4", ink: "#19283b" },
  },
  dark: {
    orange: { fill: "#ff6d1f", ink: "#10192a" },
    navy: { fill: "#4a6a9e", ink: "#ffffff" },
    cyan: { fill: "#38cfdd", ink: "#10192a" },
  },
};

/**
 * Put on any element that draws tiles or brushes. Written out in full, not
 * built from `SHADES`, because Tailwind only generates classes it can read in
 * the source; a test keeps the two in step.
 */
export const PALETTE_THEME = [
  "[--cs-orange:#ff5900] [--cs-orange-ink:#19283b]",
  "[--cs-navy:#19283b] [--cs-navy-ink:#ffffff]",
  "[--cs-cyan:#2dc4d4] [--cs-cyan-ink:#19283b]",
  "dark:[--cs-orange:#ff6d1f] dark:[--cs-orange-ink:#10192a]",
  "dark:[--cs-navy:#4a6a9e] dark:[--cs-navy-ink:#ffffff]",
  "dark:[--cs-cyan:#38cfdd] dark:[--cs-cyan-ink:#10192a]",
].join(" ");
