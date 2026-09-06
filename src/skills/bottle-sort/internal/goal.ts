import type { Bottle, RackSpec } from "./types";
import { shapeOf } from "./paint";

/**
 * What a finished bottle looks like, and what may sit on what.
 *
 * Up to level 24 there was one answer to both: a bottle is finished when it is
 * full of one colour, and a colour may only be poured onto its own kind. From
 * 25 the goal itself is the lesson — build 1,2,3,4 in order; build it
 * backwards; keep odds away from evens; order fractions by size — so both
 * questions move out of the rules and into here.
 *
 * They have to move together. An ordering goal with the matching rule is
 * unreachable: you could never place a 2 on a 1, because they are not the same
 * colour. So each goal carries its own notion of what a bottle will accept,
 * and the rules ask the goal rather than assuming.
 */
export type Goal =
  | { kind: "uniform" }
  /** Every finished bottle reads exactly this, bottom-first. */
  | { kind: "order"; order: number[]; label: string }
  /** A bottle may hold colours from one group only. */
  | { kind: "group"; groups: number[][]; label: string };

export const UNIFORM: Goal = { kind: "uniform" };

/**
 * How many segments of `colour` the bottle will take.
 *
 * Zero means the pour is refused. The count matters because the genre's rule
 * is that a whole run travels together — but in an ordering goal only one
 * segment can ever be right, since the slot above it wants a different colour.
 */
export function accepts(goal: Goal, dest: Bottle, colour: number): number {
  const room = dest.cap - dest.seg.length;
  if (room <= 0) return 0;

  if (goal.kind === "order") {
    // A scrambled bottle whose contents are not a prefix of the order can only
    // be emptied, never added to — which is the puzzle: unpick, then rebuild.
    if (dest.seg.some((c, i) => c !== goal.order[i])) return 0;
    return goal.order[dest.seg.length] === colour ? 1 : 0;
  }

  if (goal.kind === "group") {
    const group = goal.groups.find((g) => g.includes(colour));
    if (!group) return 0;
    return dest.seg.every((c) => group.includes(c)) ? room : 0;
  }

  if (!dest.seg.length) return room;
  return dest.seg[dest.seg.length - 1] === colour ? room : 0;
}

/** Why this bottle will not take that colour, in a child's words. */
export function refusalFor(goal: Goal, dest: Bottle, colour: number): string {
  if (dest.seg.length >= dest.cap) return "That bottle is full.";
  if (goal.kind === "order") {
    if (dest.seg.some((c, i) => c !== goal.order[i])) return "That bottle is not in order yet.";
    return `That is not what comes next. ${goal.label}`;
  }
  if (goal.kind === "group") return goal.label;
  return "Those colours do not match.";
}

/** Empty, or finished. */
export function bottleDone(goal: Goal, b: Bottle): boolean {
  if (!b.seg.length) return true;
  if (goal.kind === "order") {
    return b.seg.length === goal.order.length && b.seg.every((c, i) => c === goal.order[i]);
  }
  if (goal.kind === "group") {
    if (b.seg.length !== b.cap) return false;
    return goal.groups.some((g) => b.seg.every((c) => g.includes(c)));
  }
  return b.seg.length === b.cap && b.seg.every((c) => c === b.seg[0]);
}

/**
 * Fractions in order of size, not of index.
 *
 * The lesson is that ⅓ is smaller than ½, which the numbers do not say: a
 * child reading only the digits gets ⅓ ½ ⅔ ¾ wrong every time. The colours are
 * dealt in index order and this is what puts them in size order.
 */
export const FRACTIONS = ["1/3", "1/2", "2/3", "3/4"] as const;
const FRACTION_VALUE = [1 / 3, 1 / 2, 2 / 3, 3 / 4];

/** The goal a lesson's spec asks for. */
export function goalFor(spec: RackSpec): Goal {
  const up = Array.from({ length: spec.colours }, (_, i) => i);
  switch (spec.goal) {
    case "ascending":
      return { kind: "order", order: up, label: "They go smallest to biggest." };
    case "descending":
      return { kind: "order", order: [...up].reverse(), label: "They go biggest to smallest." };
    case "by-size":
      return {
        kind: "order",
        order: [...up].sort((a, b) => FRACTION_VALUE[a] - FRACTION_VALUE[b]),
        label: "They go from the smallest piece to the biggest.",
      };
    case "count-by-twos":
      return { kind: "order", order: up, label: "They count up in twos." };
    case "pattern":
      // The same ordering rule, but the segments keep their shapes: a rainbow
      // is an order of colours, and numbering them would rename the thing the
      // child is being asked to reproduce.
      return { kind: "order", order: up, label: "Every bottle ends up the same." };
    case "parity":
      return {
        kind: "group",
        groups: [up.filter((n) => n % 2 === 0), up.filter((n) => n % 2 === 1)],
        label: "Odd numbers and even numbers go in different bottles.",
      };
    default:
      return UNIFORM;
  }
}

/**
 * Whether this lesson names its segments with numbers rather than shapes.
 *
 * A shape says *which colour*; a number says *which position in the order*.
 * The ordering lessons are about the order, so they number — except the
 * pattern lesson, where the order is an order of colours and a number would
 * rename the very thing being reproduced.
 */
export const numbered = (spec: RackSpec): boolean =>
  !!spec.goal && spec.goal !== "pattern";

/** What each colour is called on screen, for a goal that numbers them. */
export function labelFor(goal: Goal, spec: RackSpec, colour: number): string {
  if (spec.goal === "by-size") return FRACTIONS[colour] ?? String(colour + 1);
  if (spec.goal === "count-by-twos") return String((colour + 1) * 2);
  if (spec.goal === "pattern") return shapeOf(colour);
  return String(colour + 1);
}
