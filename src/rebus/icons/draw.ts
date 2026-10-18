/**
 * Tiny helpers for drawing the rebus icons as SVG markup.
 *
 * Every icon is a 64×64 flat drawing: a few solid shapes, no gradients, no
 * outlines unless the shape would vanish on paper. They are markup strings, the
 * same way the Library's house drawings are, so an artist can open one, redraw
 * it, and replace it under the same id without touching code.
 *
 * The palette is Koda's own. There is no yellow in it, by design: yellow is
 * unreadable on this app's light surface. Things that are yellow in life (sun,
 * cheese, honey, corn) are drawn orange or peach.
 */

export const PAL = {
  ink: "#334155",
  mid: "#64748B",
  soft: "#CBD5E1",
  pale: "#E2E8F0",
  white: "#FFFFFF",
  indigo: "#6B46C1",
  violet: "#9F7AEA",
  lav: "#D0C3F6",
  rose: "#FF4D94",
  pink: "#FFB3D1",
  red: "#EF4444",
  darkRed: "#B91C1C",
  orange: "#FB923C",
  deepOrange: "#EA580C",
  peach: "#FDBA74",
  cream: "#FDE6D0",
  brown: "#92613A",
  darkBrown: "#6B4423",
  tan: "#D9BFA0",
  green: "#22C55E",
  darkGreen: "#15803D",
  emerald: "#10B981",
  sky: "#60A5FA",
  blue: "#2563EB",
  navy: "#1E3A8A",
  ice: "#BFDBFE",
} as const;

type Fill = string;

export const circle = (cx: number, cy: number, r: number, fill: Fill, stroke?: string): string =>
  `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}"${stroke ? ` stroke="${stroke}" stroke-width="2"` : ""}/>`;

export const ellipse = (cx: number, cy: number, rx: number, ry: number, fill: Fill, stroke?: string): string =>
  `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${fill}"${stroke ? ` stroke="${stroke}" stroke-width="2"` : ""}/>`;

export const rect = (x: number, y: number, w: number, h: number, fill: Fill, rx = 3, stroke?: string): string =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}"${stroke ? ` stroke="${stroke}" stroke-width="2"` : ""}/>`;

/** A filled shape from a path, optionally outlined. */
export const path = (d: string, fill: Fill, stroke?: string): string =>
  `<path d="${d}" fill="${fill}"${stroke ? ` stroke="${stroke}" stroke-width="2" stroke-linejoin="round"` : ""}/>`;

/** A stroked line or curve with round ends, no fill. */
export const line = (d: string, stroke: string, width = 3): string =>
  `<path d="${d}" fill="none" stroke="${stroke}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/>`;

/** `n` rays around a centre, from radius `r1` to `r2`. */
export const rays = (cx: number, cy: number, r1: number, r2: number, n: number, stroke: string, width = 3): string =>
  Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    const f = (r: number, fn: (x: number) => number) => (r * fn(a)).toFixed(1);
    return line(`M${(cx + +f(r1, Math.cos)).toFixed(1)} ${(cy + +f(r1, Math.sin)).toFixed(1)}L${(cx + +f(r2, Math.cos)).toFixed(1)} ${(cy + +f(r2, Math.sin)).toFixed(1)}`, stroke, width);
  }).join("");

/** A fluffy cloud body, sitting around (32, 36). */
export const cloud = (fill: Fill, dy = 0): string =>
  [circle(22, 38 + dy, 10, fill), circle(34, 31 + dy, 13, fill), circle(46, 38 + dy, 10, fill), rect(22, 38 + dy, 24, 10, fill, 0)].join("");

/** A round face: two eyes and a small smile, for the animals that are faces. */
export const eyes = (y = 30, gap = 8, color: string = PAL.ink): string => circle(32 - gap, y, 2.6, color) + circle(32 + gap, y, 2.6, color);

export const wrap = (inner: string): string => inner;
