/**
 * The colours a colouring item can ask for: the crayons, which have names the
 * child hears in their own language ("red"), and custom colours the author
 * picked (any "#rrggbb"), which are shown and matched but have no name. Steps
 * store a crayon's id or the custom hex. Content colours, not UI colours: a
 * sun can be yellow here even though the app's own chrome never is.
 */

import type { PaintStep } from "../geometry/types";

export interface Crayon {
  id: string;
  hex: string;
}

export const PALETTE: readonly Crayon[] = [
  { id: "red", hex: "#e5383b" },
  { id: "orange", hex: "#f28c28" },
  { id: "yellow", hex: "#f7d038" },
  { id: "lime", hex: "#8ac926" },
  { id: "green", hex: "#2b9348" },
  { id: "sky", hex: "#4cc9f0" },
  { id: "blue", hex: "#2f6fd6" },
  { id: "purple", hex: "#7b4fd6" },
  { id: "pink", hex: "#f472b6" },
  { id: "peach", hex: "#f6c29b" },
  { id: "brown", hex: "#8b5a2b" },
  { id: "gray", hex: "#9aa3b5" },
  { id: "black", hex: "#2d3142" },
];

const BY_ID = new Map(PALETTE.map((c, i) => [c.id, i]));

export const isCustom = (id: string): boolean => /^#[0-9a-f]{6}$/i.test(id);

/** A crayon id or a custom "#rrggbb". */
export const isColour = (id: unknown): id is string => typeof id === "string" && (BY_ID.has(id) || isCustom(id));

/**
 * Custom colours get paint-grid numbers after the crayons, the first time they
 * are seen. Paint grids live only while a picture is open, so the numbers never
 * need to survive a reload.
 */
const custom = new Map<string, number>();

/** The paint-grid number of a colour (1-based; 0 = white / unknown). */
export function crayonIndex(id: string): number {
  if (BY_ID.has(id)) return BY_ID.get(id)! + 1;
  if (!isCustom(id)) return 0;
  const hex = id.toLowerCase();
  if (!custom.has(hex) && custom.size < 255 - PALETTE.length) custom.set(hex, PALETTE.length + 1 + custom.size);
  return custom.get(hex) ?? 0;
}

/** The colour of a paint-grid number. */
export function hexOfIndex(i: number): string {
  if (i >= 1 && i <= PALETTE.length) return PALETTE[i - 1].hex;
  for (const [hex, n] of custom) if (n === i) return hex;
  return "#ffffff";
}

export const crayonHex = (id: string): string => (isCustom(id) ? id.toLowerCase() : (PALETTE[BY_ID.get(id) ?? 0]?.hex ?? PALETTE[0].hex));

/** The custom colours an item's steps use, in step order, each once. */
export const customColours = (steps: readonly Pick<PaintStep, "color">[]): string[] => [...new Set(steps.map((s) => s.color.toLowerCase()).filter(isCustom))];

/** What to call a colour: the crayon's name, or "this colour" for a custom one (its swatch is always beside it). */
export const colourName = (t: (key: string, vars?: Record<string, string | number>) => string, id: string): string => (isCustom(id) ? t("paint.thisColour") : t(`paint.color.${id}`));

/** "#rrggbb" → [r, g, b]. */
export function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export const toHex = (r: number, g: number, b: number): string => `#${[r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("")}`;
