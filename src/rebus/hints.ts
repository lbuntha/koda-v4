/**
 * The hint ladder, and what a hint costs.
 *
 * Rule-based and offline, the same shape as the counting guide: nothing here
 * asks a server or a model, so help arrives at the same moment on any
 * connection. Three rungs, each giving a little more away:
 *   1  the category            ("a country")
 *   2  the letters and length  ("G _ _ _ _ _ _  (7)")
 *   3  the name of each picture ("germ · money")
 * The first unlocks after the owner's delay, and each next one a full delay
 * after the last, so hints cannot be mashed through.
 */

import { compactAnswer, normalizeAnswer } from "./answer";
import { translate } from "../lib/i18n";
import { categoryLabel } from "./categories";
import { answerRange, isMathSpec, mathAnswer, mathProblem } from "./math";
import { meaningfulPieces, pieceName } from "./puzzle";
import type { RebusSettings } from "./settings";
import type { Puzzle } from "./types";

export type HintRung = 1 | 2 | 3;
export type HintKind = "category" | "letters" | "pieces" | "digits" | "range";

export interface Hint {
  rung: HintRung;
  kind: HintKind;
  text: string;
}

/**
 * What a puzzle is worth inside a round, set by the owner (see `settings.ts`).
 *
 * These are the points a child and the Machine race for, and have nothing to
 * do with XP, which follows the deployment's scoring rules. A win is always
 * worth at least `MIN_POINTS`, however many hints it took: a child who solved
 * it has not scored nothing.
 */
export interface PointRules {
  /** A win with no hints. */
  pointsPerPuzzle: number;
  /** Taken off a win for each hint used. */
  hintCost: number;
  /** What the Machine scores for a puzzle it wins. */
  machinePoints: number;
}

export const MIN_POINTS = 1;

/** What the game used before these were settings, and what an owner who changes nothing gets. */
export const DEFAULT_POINT_RULES: PointRules = { pointsPerPuzzle: 3, hintCost: 1, machinePoints: 3 };

/** What a child scores for a win after using `hintsUsed` hints. */
export const pointsFor = (hintsUsed: number, rules: PointRules = DEFAULT_POINT_RULES): number =>
  Math.max(MIN_POINTS, rules.pointsPerPuzzle - rules.hintCost * Math.max(0, hintsUsed));

const graphemes = (text: string): string[] => {
  if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
    return [...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(text)].map((s) => s.segment);
  }
  return [...text];
};

/**
 * The letters of an answer with all but each word's first hidden:
 * "slice of cake" → "S _ _ _ _   O _   C _ _ _  (11 letters)". Counts what a
 * child would count, so Khmer clusters are one letter each.
 */
export const lettersMask = (answer: string): string => {
  const words = normalizeAnswer(answer).split(" ").filter(Boolean);
  const mask = words
    .map((word) => {
      const [first, ...rest] = graphemes(word);
      return [first.toLocaleUpperCase(), ...rest.map(() => "_")].join(" ");
    })
    .join("   ");
  return `${mask}  ${translate("rebus.hint.count", { n: graphemes(compactAnswer(answer)).length })}`;
};

export const hintFor = (puzzle: Puzzle, rung: HintRung): Hint => {
  // A number is not spelled, so a math question narrows it down instead: how many digits, then which ten.
  if (puzzle.kind === "math" && isMathSpec(puzzle.math) && mathProblem(puzzle.math) === null && rung > 1) {
    const answer = mathAnswer(puzzle.math);
    if (rung === 2) return { rung, kind: "digits", text: translate("rebus.hint.digits", { n: String(answer).length }) };
    const [low, high] = answerRange(answer);
    return { rung, kind: "range", text: translate("rebus.hint.range", { low, high }) };
  }
  if (rung === 1) return { rung, kind: "category", text: translate("rebus.hint.category", { name: categoryLabel(puzzle.category).toLowerCase() }) };
  if (rung === 2) return { rung, kind: "letters", text: translate("rebus.hint.letters", { mask: lettersMask(puzzle.answer) }) };
  const names = meaningfulPieces(puzzle.pieces).map(pieceName).filter(Boolean);
  return { rung, kind: "pieces", text: translate("rebus.hint.pieces", { names: names.join(" · ") }) };
};

export type HintState =
  /** Wait this many more seconds. */
  | { state: "locked"; secondsLeft: number }
  | { state: "ready"; rung: HintRung }
  | { state: "exhausted" };

/**
 * Where the hint button stands. `lastAt` is when the puzzle started, or when
 * the last hint was taken, in seconds on whatever clock `now` uses.
 */
export const hintState = (settings: Pick<RebusSettings, "hintDelaySec" | "hintRungs">, used: number, lastAt: number, now: number): HintState => {
  if (used >= settings.hintRungs) return { state: "exhausted" };
  const left = settings.hintDelaySec - (now - lastAt);
  if (left > 0) return { state: "locked", secondsLeft: left };
  return { state: "ready", rung: (used + 1) as HintRung };
};
