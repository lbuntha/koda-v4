/**
 * The writing steps — how the app confirms a child can write (or draw) an item.
 * Pure: the store and the player call these; nothing here touches storage.
 * See docs/TRACE_STUDIO_BUILD_PLAN.md §3.
 *
 * Up: meet a step's bar `times` times → next step.
 * Down: fail twice in a row → back one step, never to the start.
 * "Can write" is earned only at a step with no guide, then re-checked from
 * memory 3 days later and 10 days after that. Pass both → learned.
 * Fail a re-check → needs practice, back to the step before.
 */

import type { StepId, TraceItem } from "../geometry/types";
import type { Fault } from "../score/score";
import { modeOf } from "../geometry/types";

export interface StepRule {
  id: StepId;
  /** Score bar 0–100; 0 = every stroke accepted is enough. */
  pass: number;
  times: number;
}

export interface StepPlan {
  steps: StepRule[];
  canDoAt: StepId;
}

const WRITING: StepPlan = {
  steps: [
    { id: "watch", pass: 0, times: 1 },
    { id: "big", pass: 0, times: 1 },
    { id: "guided", pass: 70, times: 2 },
    { id: "faded", pass: 70, times: 1 },
    { id: "copy", pass: 60, times: 1 },
    { id: "memory", pass: 60, times: 1 },
  ],
  canDoAt: "memory",
};

const DRAWING: StepPlan = {
  steps: WRITING.steps.slice(0, 4),
  canDoAt: "faded",
};

export const defaultPlan = (item: Pick<TraceItem, "kind">): StepPlan => (modeOf(item.kind) === "writing" ? WRITING : DRAWING);

export const DAY = 24 * 60 * 60 * 1000;
export const RECHECK_DAYS = [3, 10] as const;

export type Status = "learning" | "canDo" | "learned" | "needsPractice";

export interface ItemProgress {
  step: StepId;
  /** Passes at the current step, and fails in a row. */
  passes: number;
  fails: number;
  status: Status;
  /** When "can do" was (last) earned. */
  earnedAt?: number;
  /** 0 = waiting for the 3-day re-check, 1 = waiting for the 10-day one. */
  recheckRound?: 0 | 1;
  dueAt?: number;
  /** Best score per step, for the parent report later. */
  best: Partial<Record<StepId, number>>;
  /** Attempts made, and how often each mistake happened — the parent report's tip. */
  attempts?: number;
  faults?: Partial<Record<Fault, number>>;
  /** So a report can name an item that is not (or no longer) published. */
  title?: string;
  kind?: TraceItem["kind"];
  /** A colouring item: the best painting's accuracy, 0–100. */
  paintBest?: number;
  updatedAt: number;
}

export type LadderEvent = "stay" | "up" | "down" | "canDo" | "rechecked" | "learned" | "lost";

export const initialProgress = (now = Date.now()): ItemProgress => ({
  step: "watch",
  passes: 0,
  fails: 0,
  status: "learning",
  best: {},
  updatedAt: now,
});

export const isRecheckDue = (p: ItemProgress, now = Date.now()) => p.status === "canDo" && p.dueAt !== undefined && p.dueAt <= now;

const indexOf = (plan: StepPlan, step: StepId) => Math.max(0, plan.steps.findIndex((s) => s.id === step));

export const ruleFor = (plan: StepPlan, step: StepId) => plan.steps[indexOf(plan, step)];

export interface AttemptSummary {
  step: StepId;
  accepted: boolean;
  score: number;
  /** The mistake the child was told about, if any. */
  fault?: Fault;
}

/** Passed the step's bar? Watch always passes once watched. */
export function passes(plan: StepPlan, a: AttemptSummary): boolean {
  if (a.step === "watch") return true;
  const rule = ruleFor(plan, a.step);
  return a.accepted && a.score >= rule.pass;
}

/**
 * Apply one attempt. `recheck` = this attempt was the due check-up (always
 * at the can-do step).
 */
export function applyAttempt(
  prev: ItemProgress,
  plan: StepPlan,
  a: AttemptSummary,
  now = Date.now(),
  recheck = false,
): { progress: ItemProgress; event: LadderEvent } {
  const p: ItemProgress = { ...prev, best: { ...prev.best }, faults: { ...prev.faults }, updatedAt: now };
  if (a.accepted) p.best[a.step] = Math.max(p.best[a.step] ?? 0, a.score);
  if (a.step !== "watch") p.attempts = (p.attempts ?? 0) + 1;
  if (a.fault) p.faults![a.fault] = (p.faults![a.fault] ?? 0) + 1;
  const ok = passes(plan, a);

  if (recheck) {
    if (ok) {
      if ((p.recheckRound ?? 0) === 0) {
        p.recheckRound = 1;
        p.dueAt = now + RECHECK_DAYS[1] * DAY;
        return { progress: p, event: "rechecked" };
      }
      p.status = "learned";
      p.dueAt = undefined;
      p.recheckRound = undefined;
      return { progress: p, event: "learned" };
    }
    p.status = "needsPractice";
    p.dueAt = undefined;
    p.recheckRound = undefined;
    p.step = plan.steps[Math.max(1, indexOf(plan, plan.canDoAt) - 1)].id;
    p.passes = 0;
    p.fails = 0;
    return { progress: p, event: "lost" };
  }

  // Practice at a step the child has not reached counts as practice only.
  if (a.step !== p.step) return { progress: p, event: "stay" };

  const i = indexOf(plan, p.step);
  if (ok) {
    p.passes++;
    p.fails = 0;
    if (p.passes < plan.steps[i].times) return { progress: p, event: "stay" };
    if (p.step === plan.canDoAt) {
      p.passes = 0;
      if (p.status === "canDo" || p.status === "learned") return { progress: p, event: "stay" };
      p.status = "canDo";
      p.earnedAt = now;
      p.recheckRound = 0;
      p.dueAt = now + RECHECK_DAYS[0] * DAY;
      return { progress: p, event: "canDo" };
    }
    p.step = plan.steps[Math.min(plan.steps.length - 1, i + 1)].id;
    p.passes = 0;
    return { progress: p, event: "up" };
  }

  p.fails++;
  if (p.fails < 2) return { progress: p, event: "stay" };
  p.fails = 0;
  p.passes = 0;
  // Back one step, never to "watch".
  const back = Math.max(1, i - 1);
  if (back === i) return { progress: p, event: "stay" };
  p.step = plan.steps[back].id;
  return { progress: p, event: "down" };
}
