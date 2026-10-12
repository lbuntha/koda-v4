/**
 * Style presets: one click sets how a picture looks and feels for an age —
 * the tracing look, how strict, how thick the lines are, the author's pen for
 * new strokes, and the brush a child starts colouring with. Everything stays
 * editable afterwards; a picture changed by hand simply shows no preset.
 */

import type { PaintPlan, Sensitivity, TraceItem, TraceLook } from "../geometry/types";
import type { PenSize } from "./StrokeEditor";

export type StylePreset = "young" | "middle" | "older";
export const STYLE_PRESETS_ORDER: StylePreset[] = ["young", "middle", "older"];

export interface StyleSettings {
  /** The tracing look for the whole picture. */
  look: TraceLook;
  sensitivity: Sensitivity;
  /** Every stroke's width, in units (scoring never goes below 30). */
  width: number;
  /** The Studio pen for new strokes. */
  pen: PenSize;
  /** The brush a child starts colouring with: from a big one to a sharp tip. */
  brush: NonNullable<PaintPlan["brush"]>;
  /** Fill (tap a part to colour it) — quick for little ones; older children paint with the brush. */
  allowFill: boolean;
}

export const STYLE_PRESETS: Record<StylePreset, StyleSettings> = {
  // Wide bands with arrows and numbers, forgiving, bold lines; a big brush and Fill.
  young: { look: {}, sensitivity: "relaxed", width: 60, pen: "bold", brush: "l", allowFill: true },
  // A slim guide line, balanced checking, medium lines.
  middle: { look: { thin: true }, sensitivity: "balanced", width: 30, pen: "medium", brush: "m", allowFill: true },
  // A worksheet look — dots, no numbers or arrows — strict, fine lines, a sharp brush and no Fill.
  older: { look: { thin: true, dotted: true, hideNumbers: true, hideArrows: true }, sensitivity: "strict", width: 12, pen: "fine", brush: "xs", allowFill: false },
};

const sameLook = (a: TraceLook | undefined, b: TraceLook) => {
  const keys: (keyof TraceLook)[] = ["thin", "hideNumbers", "hideArrows", "dashed", "dotted"];
  return keys.every((k) => Boolean(a?.[k]) === Boolean(b[k]));
};

/** The preset a picture is set to, or null when it has been set by hand. */
export function presetOf(item: TraceItem): StylePreset | null {
  return (
    STYLE_PRESETS_ORDER.find((p) => {
      const s = STYLE_PRESETS[p];
      const paintMatches = !item.paint || ((item.paint.brush ?? "m") === s.brush && (item.paint.allowFill !== false) === s.allowFill);
      return sameLook(item.look, s.look) && item.sensitivity === s.sensitivity && item.strokes.every((st) => st.width === s.width) && paintMatches;
    }) ?? null
  );
}

/** The picture with a preset's settings. Strokes keep their shapes and their own look overrides. */
export function applyPreset(item: TraceItem, preset: StylePreset): TraceItem {
  const s = STYLE_PRESETS[preset];
  const { look: _l, ...rest } = item;
  const out: TraceItem = {
    ...rest,
    ...(Object.keys(s.look).length ? { look: { ...s.look } } : {}),
    sensitivity: s.sensitivity,
    strokes: item.strokes.map((st) => ({ ...st, width: s.width })),
  };
  if (item.paint) {
    const { allowFill: _a, brush: _b, ...paint } = item.paint;
    out.paint = { ...paint, brush: s.brush, ...(s.allowFill ? {} : { allowFill: false }) };
  }
  return out;
}
