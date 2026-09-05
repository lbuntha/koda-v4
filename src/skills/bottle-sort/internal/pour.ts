import { isBottleDone, topRun, type Bottle, type Pour, type Rack } from "./types";

/**
 * The rules of a pour, and nothing else.
 *
 * Pure and rack-in/rack-out, so the solver can search thousands of states
 * without defensive copying and a test can hold a before and an after. The
 * activity will render these results; it will not re-decide them.
 */

/**
 * Why this pour cannot happen, or `null` if it can.
 *
 * A reason rather than a boolean because a refusal is shown to the child, not
 * scored: "That bottle is full." is the whole feedback, and the plan's first
 * risk is that a refusal must never be recorded as a wrong answer.
 */
export function refuseReason(rack: Rack, from: number, to: number): string | null {
  if (from === to) return "Pick a different bottle to pour into.";
  const a = rack[from], b = rack[to];
  if (!a || !b) return "That bottle is not there.";
  if (isCorked(rack, from) || isCorked(rack, to)) return "That bottle is corked.";
  if (!a.seg.length) return "That bottle is empty.";
  if (a.oneWay) return "That bottle only receives.";
  if (b.seg.length >= b.cap) return "That bottle is full.";
  const run = topRun(a);
  if (b.seg.length && b.seg[b.seg.length - 1] !== run.colour) return "Those colours do not match.";
  return null;
}

/** A corked bottle opens the moment the bottle it waits on is finished. */
export function isCorked(rack: Rack, index: number): boolean {
  const b = rack[index];
  if (!b || b.lockedBy === undefined) return false;
  const on = rack[b.lockedBy];
  return !on || !on.seg.length || !isBottleDone(on);
}

export const canPour = (rack: Rack, from: number, to: number): boolean =>
  refuseReason(rack, from, to) === null;

/**
 * Pours the top run, and returns a new rack.
 *
 * The whole run of one colour moves together — the genre's defining rule —
 * capped by the room the destination has.
 *
 * There is deliberately no linked-bottle rule here. The plan's version filled a
 * twin alongside the destination, which creates liquid out of nothing: colour
 * counts stop being multiples of a bottle and the rack can never be finished.
 * Phase 0's colour-count invariant caught it on the first draw. Linked needs a
 * definition that conserves what it moves before it can exist.
 */
export function pour(rack: Rack, from: number, to: number): Rack {
  if (!canPour(rack, from, to)) return rack;
  const next: Bottle[] = rack.map((b) => ({ ...b, seg: [...b.seg] }));
  const a = next[from], b = next[to];
  const run = topRun(a);
  const moved = Math.min(run.n, b.cap - b.seg.length);

  for (let i = 0; i < moved; i += 1) b.seg.push(a.seg.pop() as number);

  // Hidden rounds reveal only what a pour uncovers.
  if (a.shown !== undefined) a.shown = Math.min(a.shown, a.seg.length);
  if (b.shown !== undefined) b.shown = b.seg.length;
  return next;
}

/**
 * The same pour, decomposed one segment at a time.
 *
 * Presentation only. The rule is unchanged — a pour moves the whole run and is
 * judged as one move — but liquid that jumps in a single frame reads as a
 * relabelling rather than a pour, so the drawing walks through the states in
 * between. The last element is exactly `pour(rack, from, to)`, and a test holds
 * that: the animation must never be able to change the outcome.
 */
export function pourSteps(rack: Rack, from: number, to: number): Rack[] {
  if (!canPour(rack, from, to)) return [];
  const final = pour(rack, from, to);
  const moved = final[to].seg.length - rack[to].seg.length;
  const steps: Rack[] = [];
  let current = rack;
  for (let i = 0; i < moved; i += 1) {
    const next: Bottle[] = current.map((b) => ({ ...b, seg: [...b.seg] }));
    next[to].seg.push(next[from].seg.pop() as number);
    if (next[from].shown !== undefined) next[from].shown = Math.min(next[from].shown, next[from].seg.length);
    if (next[to].shown !== undefined) next[to].shown = next[to].seg.length;
    steps.push(next);
    current = next;
  }
  return steps;
}

/** Every pour the rack allows right now. */
export function legalPours(rack: Rack): Pour[] {
  const out: Pour[] = [];
  for (let from = 0; from < rack.length; from += 1) {
    if (!topRun(rack[from]).n) continue;
    for (let to = 0; to < rack.length; to += 1) {
      if (from !== to && canPour(rack, from, to)) out.push({ from, to });
    }
  }
  return out;
}

/**
 * Nothing left to do, and not finished.
 *
 * Checked across every ordered pair rather than inferred, because telling a
 * child they are stuck while a legal pour exists is worse than not checking.
 */
export const isDeadlock = (rack: Rack): boolean =>
  !isSolvedRack(rack) && legalPours(rack).length === 0;

export const isSolvedRack = (rack: Rack): boolean => rack.every(isBottleDone);

/**
 * A pour that only rearranges nothing.
 *
 * Emptying a whole bottle into an empty one leaves the rack the same shape with
 * different labels; the solver would explore it forever and a child would learn
 * nothing from it.
 */
export function isPointless(rack: Rack, from: number, to: number): boolean {
  const a = rack[from], b = rack[to];
  if (!a || !b) return false;
  return b.seg.length === 0 && topRun(a).n === a.seg.length;
}

/**
 * A rack as a comparable string.
 *
 * Bottles are interchangeable unless one of them is special, so a plain rack is
 * canonicalised by sorting — which collapses the many orderings of the same
 * position into one state and is what makes the search finish.
 */
export function signature(rack: Rack): string {
  const special = rack.some((b) => b.oneWay || b.lockedBy !== undefined || b.linkedTo !== undefined);
  const parts = rack.map((b) => `${b.cap}:${b.seg.join(",")}`);
  return special ? parts.join("|") : [...parts].sort().join("|");
}
