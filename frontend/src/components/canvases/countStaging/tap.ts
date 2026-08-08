/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * "One-to-One" — the objects lie where they are and the child taps each once.
 *
 * The purest form of the skill: one number said per object, no object left out,
 * none counted twice. Nothing moves, so this is the staging that proves the
 * engine does not assume counting relocates anything.
 *
 * There are no bins. Objects are placed by `oneToOneLayout`, which owns the
 * patterns (grid, line, ring, scatter…) and — crucially — decides the object
 * size from the tightest gap between any two centres, so no pattern can overlap
 * itself at any count.
 */

import { oneToOneLayout, type OneToOnePattern } from "../oneToOneLayout";
import type { Point } from "../oneToOneLayout";
import { allCounted, type CountStaging, type LayoutInput, type LayoutResult } from "./types";

export const tapStaging: CountStaging = {
  id: "tap",
  movesOnCount: false,

  // No bins: counting happens where the objects already are.
  zones: () => [],

  layout({ count, stage, config }: LayoutInput): LayoutResult {
    const { positions: centres, size } = oneToOneLayout({
      count,
      width: stage.width,
      height: stage.height,
      pattern: ((config.pattern as OneToOnePattern) || "grid") as OneToOnePattern,
      gridColumns: config.gridColumns as number | undefined
    });

    const positions: Record<string, Point> = {};
    centres.forEach((centre, index) => {
      positions[`count-item-${index}`] = centre;
    });

    return { size, positions };
  },

  /*
    Only a tap counts, and only once. A counted object that is tapped again does
    nothing: "uncount by tapping" would let a child undo their own count by
    resting a finger on the board, and the trail behind them would unwind.
  */
  resolve({ item, tapped }) {
    if (!tapped || item.counted) return null;
    return { counted: true };
  },

  isComplete: allCounted,

  guidance: ctx =>
    ctx.remaining === 0
      ? `Enter how many you counted (${ctx.count})!`
      : `Tap each ${ctx.objectLabel} once to count it!`
};
