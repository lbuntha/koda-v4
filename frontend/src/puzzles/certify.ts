/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Proves a ladder is playable before a child ever sees it.
 *
 * Four `.test.ts` files and four export scripts currently assert versions of the same
 * handful of things — ids unique, boards distinct, tier never regresses, the solver
 * finishes every board — each slightly differently, and the one ladder with no test
 * (`xtraMathLevels`) is also the one with unseeded randomness. This is that checklist
 * in one place, so a new puzzle inherits it by existing rather than by remembering.
 *
 * Run it from a unit test *and* from the export that feeds the seed, so an unsolvable
 * level fails the build rather than reaching a learner's path.
 */

import { PuzzleRules } from "./rules";
import { Ladder, LadderLevel, TIERS } from "./ladder";
import { solve } from "./solve";
import { generateBoard } from "./generate";

export interface CertifiedLevel<Params> {
  id: string;
  title: string;
  blurb: string;
  tier: string;
  /** Ladder position, 1-based. */
  position: number;
  /** False if anything below failed — the seed refuses to author these. */
  ok: boolean;
  problems: string[];
  /** Shortest plan the solver found, the honest difficulty signal. */
  solutionMoves: number | null;
  /** The board's material, carried to the server as the private grading key. */
  invariants: Record<string, number>;
}

export interface CertifyOptions {
  /** Positions the solver may generate per level. */
  budget?: number;
}

/**
 * Build every board on the ladder and check it.
 *
 * Per level: the board must not arrive already solved, must be solvable, must be
 * distinct from every other level's board, and must hold exactly the material the
 * solved layout started with — a scramble that creates or loses a piece is a
 * generator bug, and the invariants are what the server grades against later.
 *
 * Across the ladder: ids unique, tiers never regress, and solution length trends
 * upward *within* a tier (across tiers it can dip, because a new mechanic is
 * introduced gently — that is the ramp working, not breaking).
 */
export function certifyLadder<Board, Move, Params>(
  rules: PuzzleRules<Board, Move>,
  ladder: Ladder<Params>,
  buildSolved: (params: Params) => Board,
  options: CertifyOptions = {},
): CertifiedLevel<Params>[] {
  const seenIds = new Set<string>();
  const seenBoards = new Map<string, string>();
  let previousTierRank = -1;
  let previousLength = -1;
  let previousTier = "";

  return ladder.all.map((level: LadderLevel<Params>, index) => {
    const problems: string[] = [];

    if (seenIds.has(level.id)) problems.push(`duplicate level id "${level.id}"`);
    seenIds.add(level.id);

    const tierRank = TIERS.indexOf(level.tier);
    if (tierRank < previousTierRank) {
      problems.push(`tier goes backwards: ${level.tier} after ${TIERS[previousTierRank]}`);
    }

    const solved = buildSolved(level.params);
    if (!rules.isSolved(solved)) {
      // The solved layout is the generator's anchor; if it is wrong, every guarantee
      // built on "scramble backwards from solved" is void.
      problems.push("buildSolved() did not produce a solved board");
    }
    const expected = rules.invariants(solved);

    const board = generateBoard(rules, solved, {
      moves: level.scramble,
      seed: level.id,
      minSolution: level.minSolution,
      solveBudget: options.budget,
    });

    if (rules.isSolved(board)) problems.push("board arrives already solved — nothing to do");

    const boardKey = rules.key(board);
    const twin = seenBoards.get(boardKey);
    if (twin) problems.push(`board is identical to "${twin}"`);
    seenBoards.set(boardKey, level.id);

    const invariants = rules.invariants(board);
    for (const [piece, count] of Object.entries(expected)) {
      if (invariants[piece] !== count) {
        problems.push(`scramble changed the board: ${piece} ${count} → ${invariants[piece] ?? 0}`);
      }
    }

    const plan = solve(rules, board, { budget: options.budget });
    if (plan === null) problems.push("no solution found within budget");

    const solutionMoves = plan ? plan.length : null;
    if (level.minSolution && solutionMoves !== null && solutionMoves < level.minSolution) {
      // The generator searched and could not reach it — the rung is asking this board
      // shape for more difficulty than it holds. Raise the params, not the seed count.
      problems.push(
        `asked for ${level.minSolution}+ moves, hardest board found needs ${solutionMoves}`,
      );
    }
    if (solutionMoves !== null && previousLength >= 0 && level.tier === previousTier) {
      if (solutionMoves < previousLength) {
        problems.push(
          `easier than the rung below it (${solutionMoves} moves vs ${previousLength})`,
        );
      }
    }

    previousTierRank = Math.max(previousTierRank, tierRank);
    previousTier = level.tier;
    if (solutionMoves !== null) previousLength = solutionMoves;

    return {
      id: level.id,
      title: level.title,
      blurb: level.blurb,
      tier: level.tier,
      position: index + 1,
      ok: problems.length === 0,
      problems,
      solutionMoves,
      invariants,
    };
  });
}
