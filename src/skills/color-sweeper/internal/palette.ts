import type { Color } from "./board";

/** Apparatus colors, with permanent text/symbol identities. Surrounding UI uses theme tokens. */
export const PALETTE: Readonly<Record<Color, { name: string; symbol: string; letter: string; fill: string; ink: string }>> = {
  orange: { name: "Orange", symbol: "●", letter: "O", fill: "#ff5900", ink: "#19283b" },
  navy: { name: "Navy", symbol: "◆", letter: "N", fill: "#19283b", ink: "#ffffff" },
  cyan: { name: "Cyan", symbol: "▲", letter: "C", fill: "#2dc4d4", ink: "#19283b" },
};
