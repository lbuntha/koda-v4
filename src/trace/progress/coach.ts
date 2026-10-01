/**
 * The coach — rule-based and local, one thing at a time.
 * See docs/TRACE_STUDIO_BUILD_PLAN.md §3.2.
 *
 * The same fault twice in a row on a stroke turns on the help that fixes it;
 * that help fades out again after 2 good strokes. A stroke failing 4 times
 * earns a suggestion (practise the part, or watch it again); 5 failed
 * attempts in a row earn a rest.
 */

import type { StrokeShape } from "../geometry/types";
import type { Fault } from "../score/score";

export type Aid = "startRing" | "arrows" | "checkpointStar" | "endDot" | "widerBand" | "numbersDim" | "slow" | "zone";

export const AID_FOR: Record<Fault, Aid> = {
  start: "startRing",
  direction: "arrows",
  checkpoint: "checkpointStar",
  coverage: "endDot",
  path: "widerBand",
  order: "numbersDim",
  missing: "numbersDim",
  scribble: "slow",
  unfit: "slow",
  placement: "zone",
};

export interface CoachState {
  /** Last fault per stroke and how many times in a row. */
  streak: Record<number, { fault: Fault; count: number }>;
  /** Help the coach turned on, per stroke, with good strokes since. */
  aids: Record<number, { aid: Aid; good: number }[]>;
  /** Fails per stroke since it last went well. */
  strokeFails: Record<number, number>;
  /** Failed attempts in a row. */
  attemptFails: number;
}

export type Suggestion = { kind: "drill" | "watch"; order: number } | { kind: "rest" };

export const initialCoach = (): CoachState => ({ streak: {}, aids: {}, strokeFails: {}, attemptFails: 0 });

const DRILLABLE: StrokeShape[] = ["loop", "hook", "curve"];

/** A stroke was tried: `fault` null = accepted. */
export function coachStroke(
  prev: CoachState,
  order: number,
  fault: Fault | null,
  shape: StrokeShape,
): { state: CoachState; suggestion?: Suggestion } {
  const state: CoachState = {
    streak: { ...prev.streak },
    aids: { ...prev.aids, [order]: [...(prev.aids[order] ?? [])] },
    strokeFails: { ...prev.strokeFails },
    attemptFails: prev.attemptFails,
  };

  if (fault === null) {
    delete state.streak[order];
    state.strokeFails[order] = 0;
    state.aids[order] = state.aids[order].map((a) => ({ ...a, good: a.good + 1 })).filter((a) => a.good < 2);
    return { state };
  }

  const last = state.streak[order];
  const count = last?.fault === fault ? last.count + 1 : 1;
  state.streak[order] = { fault, count };
  if (count >= 2) {
    const aid = AID_FOR[fault];
    state.aids[order] = [...state.aids[order].filter((a) => a.aid !== aid), { aid, good: 0 }];
  }

  const fails = (state.strokeFails[order] ?? 0) + 1;
  state.strokeFails[order] = fails;
  if (fails >= 4) {
    state.strokeFails[order] = 0;
    return { state, suggestion: { kind: DRILLABLE.includes(shape) ? "drill" : "watch", order } };
  }
  return { state };
}

/** A whole attempt finished. */
export function coachAttempt(prev: CoachState, accepted: boolean): { state: CoachState; suggestion?: Suggestion } {
  if (accepted) return { state: { ...prev, attemptFails: 0 } };
  const attemptFails = prev.attemptFails + 1;
  if (attemptFails >= 5) return { state: { ...prev, attemptFails: 0 }, suggestion: { kind: "rest" } };
  return { state: { ...prev, attemptFails } };
}

/** The help the coach has on for a stroke right now. */
export const aidsFor = (state: CoachState, order: number): Aid[] => (state.aids[order] ?? []).map((a) => a.aid);
