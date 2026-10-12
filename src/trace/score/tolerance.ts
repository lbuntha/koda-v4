/**
 * How close is close enough. One radius `r`, in canvas units, drives every
 * measure: r = (band width / 2) × sensitivity × step × age band.
 * Starting values from the plan (§2.5); calibration tunes them.
 */

import type { AgeBand, Sensitivity, StepId } from "../geometry/types";

export const SENSITIVITY: Record<Sensitivity, number> = { relaxed: 1.6, balanced: 1.0, strict: 0.7 };

export const STEP_FACTOR: Record<StepId, number> = {
  watch: 1,
  big: 1.5,
  guided: 1,
  faded: 1,
  copy: 1.3,
  memory: 1.3,
};

/**
 * The narrowest band scoring ever uses. A stroke can be drawn as thin as the
 * author likes (a fine dashed outline), but a child is never held to a line
 * thinner than this.
 */
export const MIN_TOLERANCE_WIDTH = 30;

export const AGE_FACTOR: Record<AgeBand, number> = { A: 1.2, B: 1, C: 0.9 };

export interface ToleranceOptions {
  sensitivity?: Sensitivity;
  step?: StepId;
  ageBand?: AgeBand;
}

export function radius(width: number, { sensitivity = "balanced", step = "guided", ageBand = "B" }: ToleranceOptions = {}): number {
  return (Math.max(width, MIN_TOLERANCE_WIDTH) / 2) * SENSITIVITY[sensitivity] * STEP_FACTOR[step] * AGE_FACTOR[ageBand];
}
