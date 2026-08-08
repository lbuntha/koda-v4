/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Levels are built backwards, from the finished board.
 *
 * Every board here starts *solved* and is then scrambled with legal moves. Where a
 * puzzle's moves are reversible — which is the case for every sort, slide and stack
 * puzzle — replaying the scramble backwards always finishes the board, so solvability
 * is a property of how the level was made rather than something to hope for and
 * discover later.
 *
 * That matters because the alternative has already shipped twice in this codebase.
 * Liquid Sort's 40 levels were typed out by hand: two of them were unsolvable and one
 * was a byte-for-byte duplicate of another, and a child on that level sorts what they
 * can, never completes it, and the activity sits unfinished on their path forever.
 * Goods Sort was rewritten to generate instead, and this is that idea lifted out so
 * every puzzle gets it.
 *
 * The scramble is seeded, so a level id always produces the same board: a child who
 * retries gets the puzzle they were learning, a teacher previewing sees what the child
 * will see, and the export can certify a specific board rather than "whatever came out
 * this time".
 */

import { PuzzleRules } from "./rules";
import { solve } from "./solve";

/** Small, fast, seedable PRNG. Same seed ⇒ same board, on any machine or runtime. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** FNV-1a over a level id, so a seed can be derived from the name rather than tracked. */
export function seedFromId(id: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    hash ^= id.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export interface ScrambleOptions {
  /** How many legal moves to walk back from the solved board. Higher ⇒ usually harder. */
  moves: number;
  /** Seed, or a level id to derive one from. */
  seed: number | string;
  /**
   * How many recent positions the walk refuses to step back into.
   *
   * Without this the walk undoes itself constantly and a nominally 40-move scramble
   * lands three moves from solved. Comparing *positions* rather than moves keeps this
   * rules-agnostic — no puzzle has to say what the inverse of a move is.
   */
  avoidRecent?: number;
  /**
   * Reject a board whose shortest solution is shorter than this, and try another seed.
   *
   * Scramble depth is only a *proxy* for difficulty, and on a small state space it is a
   * bad one: a random walk saturates, so a 22-move scramble of a 4-disk Hanoi tower can
   * land 3 moves from solved. Certification caught exactly that on two rungs here. Where
   * a puzzle needs a real difficulty ramp, state it as the thing you actually mean —
   * how far from home the board is — and let the generator search for a seed that
   * delivers it.
   *
   * Costs a solve per attempt, so it belongs on puzzles with small state spaces, or at
   * build time via `certifyLadder`.
   */
  minSolution?: number;
  /** Solver budget when `minSolution` is set. */
  solveBudget?: number;
}

/** How many seeds `generateBoard` will try before settling for the best it saw. */
const MAX_SEED_ATTEMPTS = 40;

/**
 * Walk `moves` legal moves out from a solved board.
 *
 * Returns the scrambled board. Because every step was legal and puzzles of this shape
 * have reversible moves, the result is always solvable.
 */
export function scramble<Board, Move>(
  rules: PuzzleRules<Board, Move>,
  solved: Board,
  options: ScrambleOptions,
): Board {
  const random = mulberry32(
    typeof options.seed === "string" ? seedFromId(options.seed) : options.seed,
  );
  const memory = Math.max(1, options.avoidRecent ?? 3);
  let board = solved;
  const recent: string[] = [rules.key(board)];

  for (let step = 0; step < options.moves; step++) {
    const candidates = rules.legalMoves(board);
    if (candidates.length === 0) break;

    // Prefer a move that does not walk back into a position we just left. If every
    // move does, take one anyway — the board stays legal and solvable, just less mixed.
    const fresh = candidates.filter(move => !recent.includes(rules.key(rules.apply(board, move))));
    const pool = fresh.length > 0 ? fresh : candidates;
    board = rules.apply(board, pool[Math.floor(random() * pool.length)]);

    recent.push(rules.key(board));
    if (recent.length > memory) recent.shift();
  }
  return board;
}

/**
 * The board a level actually ships: scrambled, never already finished, and — where the
 * level asks for it — a stated distance from home.
 *
 * Deterministic despite the retries: attempt *n* uses the seed `<seed>#<n>`, so the same
 * level id always lands on the same board no matter which attempt won.
 */
export function generateBoard<Board, Move>(
  rules: PuzzleRules<Board, Move>,
  solved: Board,
  options: ScrambleOptions,
): Board {
  const attempts = options.minSolution ? MAX_SEED_ATTEMPTS : 20;
  let best: Board | null = null;
  let bestDistance = -1;

  for (let attempt = 0; attempt < attempts; attempt++) {
    const board = scramble(rules, solved, {
      ...options,
      seed: attempt === 0 ? options.seed : `${options.seed}#${attempt}`,
    });
    if (rules.isSolved(board)) continue;

    if (!options.minSolution) return board;

    const plan = solve(rules, board, { budget: options.solveBudget });
    const distance = plan ? plan.length : -1;
    if (distance >= options.minSolution) return board;
    if (distance > bestDistance) {
      bestDistance = distance;
      best = board;
    }
  }

  // Nothing hit the target — hand back the hardest board seen rather than none, and let
  // `certifyLadder` be the thing that reports the ladder is asking for the impossible.
  return best ?? scramble(rules, solved, options);
}
