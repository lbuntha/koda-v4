/**
 * Help switches — what is shown on the slate. See docs/TRACE_STUDIO_BUILD_PLAN.md §3.1.
 *
 * In Steps mode each step sets them and they are locked, so "can write" is
 * earned honestly. In My way the child flips any switch; an attempt counts
 * toward "can write" only with Ghost and Strokes both off.
 */

import type { StepId } from "../geometry/types";

export const SWITCHES = ["ghost", "strokes", "arrows", "numbers", "startDot", "grid"] as const;
export type Switch = (typeof SWITCHES)[number];
export type Switches = Record<Switch, boolean>;

export type PlayMode = "steps" | "myWay" | "justDraw";

const ALL_ON: Switches = { ghost: true, strokes: true, arrows: true, numbers: true, startDot: true, grid: true };

export function stepSwitches(step: StepId): Switches {
  switch (step) {
    case "watch":
    case "big":
    case "guided":
      return { ...ALL_ON };
    case "faded":
      return { ghost: true, strokes: false, arrows: false, numbers: true, startDot: true, grid: true };
    case "copy":
    case "memory":
      return { ghost: false, strokes: false, arrows: false, numbers: false, startDot: false, grid: true };
  }
}

/**
 * How a My way attempt is scored, and whether it counts toward "can write".
 * With a guide on the slate the expected stroke is known (a guided kind of
 * attempt); with none, it is scored like writing from memory.
 */
export function myWayScoring(s: Switches): { step: StepId; counts: boolean } {
  if (!s.ghost && !s.strokes) return { step: "memory", counts: true };
  if (s.strokes) return { step: "guided", counts: false };
  return { step: "faded", counts: false };
}
