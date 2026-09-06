import { POOL } from "./racks";

/**
 * What a colour looks like, in one place.
 *
 * Two activities draw the same racks — the sorter and the predictor — and if
 * they disagree about what colour 2 looks like, or which shape marks it, the
 * prediction lesson stops being about predicting. Shared rather than copied,
 * for that reason.
 */

/** Shape is bound to the deal position, never the hue, so a redrawn palette
 *  leaves a colour-blind child playing exactly the same puzzle. */
export const SHAPES = ["circle", "square", "triangle", "diamond", "cross", "bar"] as const;

export const GLYPH: Record<string, string> = {
  circle: "M0-5A5 5 0 1 0 0 5 5 5 0 1 0 0-5Z",
  square: "M-4.4-4.4h8.8v8.8h-8.8Z",
  triangle: "M0-5.4 5.4 4.6H-5.4Z",
  diamond: "M0-5.6 5.6 0 0 5.6-5.6 0Z",
  cross: "M-1.8-5.4h3.6v3.6h3.6v3.6H1.8v3.6h-3.6V1.8h-3.6v-3.6h3.6Z",
  bar: "M-5.6-2h11.2v4h-11.2Z",
};

export const shapeOf = (colour: number) => SHAPES[colour % SHAPES.length];
export const nameOf = (colour: number) => `${shapeOf(colour)} ${colour + 1}`;

export const cssColour = (hues: number[], colour: number) => {
  const [r, g, b] = POOL[hues[colour] ?? 0];
  return `rgb(${r} ${g} ${b})`;
};
