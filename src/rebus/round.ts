/**
 * Building a round out of a bank of puzzles.
 *
 * "Generate a round for this topic" means this, not a model: filter to the
 * category and the child's age, prefer puzzles they have not met, drop repeated
 * answers, and order easy to hard. It is seeded, so a rematch with the same
 * seed is the same round, and it is plain arithmetic, so it works with no
 * connection from a pack saved on the device.
 */

import { fitsAge } from "../lib/ages";
import { answerKey } from "./puzzle";
import { makeRng, shuffled, type Rng } from "./rng";
import { matchesStatus, type Results, type StatusFilter } from "./results";
import type { CategoryId, Difficulty, Puzzle } from "./types";

export interface RoundRequest {
  category: CategoryId | "mixed";
  /** How many puzzles are wanted (5–10 in the product). */
  count: number;
  /** The child's age in years; null or missing suits everybody. */
  age?: number | null;
  /** Ids this child met recently. They come last, so 1,000 puzzles last a long time. */
  seen?: ReadonlySet<string>;
  seed: string | number;
  /** Only this difficulty, or any when missing. */
  difficulty?: Difficulty | null;
  /** Only puzzles with this history; needs `results`. */
  status?: StatusFilter;
  results?: Results;
  /**
   * Play every puzzle that matches, in rounds of at most `count`, instead of a
   * random few. `done` holds the ids already played in this pass; when none are
   * left, a new pass starts.
   */
  all?: boolean;
  done?: ReadonlySet<string>;
}

export interface Round {
  puzzles: Puzzle[];
  /** How many fewer than asked for, when the bank (for this child) is too small. */
  shortBy: number;
  /** All mode: how many matching puzzles are in the set, and how many are still unplayed after this round. */
  total: number;
  remaining: number;
}

/** The puzzles a child can be given for a request: topic, age, level and history. */
export const filterPuzzles = (bank: readonly Puzzle[], request: Pick<RoundRequest, "category" | "age" | "difficulty" | "status" | "results">): Puzzle[] =>
  uniqueByAnswer(bank).filter(
    (p) =>
      (request.category === "mixed" || p.category === request.category) &&
      fitsAge(p.ages, request.age) &&
      (request.difficulty == null || p.difficulty === request.difficulty) &&
      matchesStatus(request.results?.[p.id], request.status ?? "all"),
  );

/** A bank with one puzzle per answer, keeping the first. */
const uniqueByAnswer = (bank: readonly Puzzle[]): Puzzle[] => {
  const keys = new Set<string>();
  return bank.filter((p) => {
    const key = answerKey(p);
    if (keys.has(key)) return false;
    keys.add(key);
    return true;
  });
};

/** Take from each category in turn, so a mixed round is not five of one thing. */
const interleave = (rng: Rng, puzzles: readonly Puzzle[], count: number): Puzzle[] => {
  const groups = new Map<CategoryId, Puzzle[]>();
  for (const p of puzzles) groups.set(p.category, [...(groups.get(p.category) ?? []), p]);
  const lanes = shuffled(rng, [...groups.values()]);
  const out: Puzzle[] = [];
  for (let i = 0; out.length < count && lanes.some((lane) => i < lane.length); i++) {
    for (const lane of lanes) {
      if (out.length < count && i < lane.length) out.push(lane[i]);
    }
  }
  return out;
};

export const buildRound = (bank: readonly Puzzle[], request: RoundRequest): Round => {
  const rng = makeRng(request.seed);
  const seen = request.seen ?? new Set<string>();
  const wanted = Math.max(0, Math.floor(request.count));

  const eligible = filterPuzzles(bank, request);
  const total = eligible.length;
  // All mode works through the whole set; a finished pass starts over.
  const done = request.done ?? new Set<string>();
  const left = eligible.filter((p) => !done.has(p.id));
  const unplayed = request.all ? (left.length > 0 ? left : eligible) : eligible;
  // Fresh puzzles first; seen ones only top up what is missing.
  const fresh = shuffled(rng, unplayed.filter((p) => !seen.has(p.id)));
  const stale = shuffled(rng, unplayed.filter((p) => seen.has(p.id)));
  const pool = request.all ? shuffled(rng, unplayed) : [...fresh, ...stale];

  const picked = request.category === "mixed" && !request.all ? interleave(rng, pool, wanted) : pool.slice(0, wanted);
  // Easy to hard, with a little jitter so equal difficulties do not always sit in the same order.
  const ordered = picked
    .map((p) => ({ p, key: p.difficulty + rng() * 0.9 }))
    .sort((a, b) => a.key - b.key)
    .map((x) => x.p);

  return { puzzles: ordered, shortBy: request.all ? 0 : Math.max(0, wanted - ordered.length), total, remaining: request.all ? Math.max(0, unplayed.length - ordered.length) : 0 };
};
