/**
 * Guards the puzzle kit and both ladders built on it.
 *
 * The assertions here are the ones four separate level-table tests in this repo each
 * wrote their own version of. They live once now, so a new puzzle inherits them.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { solve, findHint } from "./solve";
import { generateBoard, scramble, mulberry32, seedFromId } from "./generate";
import { certifyLadder } from "./certify";
import { makeLadder, TIERS } from "./ladder";
import { starsFor, formatTime } from "./usePuzzlePlay";
import {
  slidingTileRules,
  slidingTileLadder,
  solvedTileBoard,
  type TileBoard,
} from "./games/slidingTile";
import { hanoiRules, hanoiLadder, solvedHanoiBoard } from "./games/hanoi";

// ── The engine ──────────────────────────────────────────────────────────────────

test("solve returns an empty plan for a board that is already finished", () => {
  assert.deepEqual(solve(slidingTileRules, solvedTileBoard({ size: 3 })), []);
  assert.deepEqual(solve(hanoiRules, solvedHanoiBoard({ disks: 3, pegs: 3 })), []);
});

test("an empty plan and no plan are different answers", () => {
  // A shell shows "done" for one and "no hint available" for the other; conflating
  // them is how a finished board ends up offering a hint.
  assert.equal(findHint(slidingTileRules, solvedTileBoard({ size: 3 })), null);
  const stuck = solve(slidingTileRules, solvedTileBoard({ size: 3 }));
  assert.notEqual(stuck, null);
  assert.equal(stuck!.length, 0);
});

test("a plan actually finishes the board it was made for", () => {
  for (const level of slidingTileLadder.all) {
    const solved = solvedTileBoard(level.params);
    const board = generateBoard(slidingTileRules, solved, {
      moves: level.scramble,
      seed: level.id,
    });
    const plan = solve(slidingTileRules, board);
    assert.notEqual(plan, null, `${level.id}: no plan found`);

    let played = board;
    for (const move of plan!) {
      assert.ok(
        slidingTileRules.legalMoves(played).includes(move),
        `${level.id}: plan contains an illegal move`,
      );
      played = slidingTileRules.apply(played, move);
    }
    assert.ok(slidingTileRules.isSolved(played), `${level.id}: plan did not finish the board`);
  }
});

test("A* returns a shortest plan — Manhattan distance is a floor on it", () => {
  const level = slidingTileLadder.getLevel("st_3");
  const board = generateBoard(slidingTileRules, solvedTileBoard(level.params), {
    moves: level.scramble,
    seed: level.id,
  });
  const plan = solve(slidingTileRules, board)!;
  assert.ok(plan.length >= slidingTileRules.heuristic!(board));
  assert.ok(plan.length <= level.scramble, "a plan longer than the scramble is not shortest");
});

test("apply never mutates the board it was given", () => {
  const board = solvedTileBoard({ size: 3 });
  const before = slidingTileRules.key(board);
  slidingTileRules.apply(board, slidingTileRules.legalMoves(board)[0]);
  assert.equal(slidingTileRules.key(board), before);

  const pegs = solvedHanoiBoard({ disks: 3, pegs: 3 });
  const pegsBefore = hanoiRules.key(pegs);
  hanoiRules.apply(pegs, hanoiRules.legalMoves(pegs)[0]);
  assert.equal(hanoiRules.key(pegs), pegsBefore);
});

// ── The generator ───────────────────────────────────────────────────────────────

test("the same seed always produces the same board", () => {
  const solved = solvedTileBoard({ size: 4 });
  const first = generateBoard(slidingTileRules, solved, { moves: 30, seed: "st_x" });
  const second = generateBoard(slidingTileRules, solved, { moves: 30, seed: "st_x" });
  assert.equal(slidingTileRules.key(first), slidingTileRules.key(second));

  const other = generateBoard(slidingTileRules, solved, { moves: 30, seed: "st_y" });
  assert.notEqual(slidingTileRules.key(first), slidingTileRules.key(other));
});

test("mulberry32 and seedFromId are stable across runs", () => {
  assert.equal(mulberry32(seedFromId("level_1"))(), mulberry32(seedFromId("level_1"))());
});

test("scrambling never creates or destroys material", () => {
  const solved = solvedHanoiBoard({ disks: 5, pegs: 3 });
  const board = scramble(hanoiRules, solved, { moves: 40, seed: "mix" });
  assert.deepEqual(hanoiRules.invariants(board), hanoiRules.invariants(solved));
});

test("a generated board is never handed over already solved", () => {
  // A short scramble on a small board can walk straight back to the goal.
  for (let seed = 0; seed < 40; seed++) {
    const board = generateBoard(hanoiRules, solvedHanoiBoard({ disks: 3, pegs: 3 }), {
      moves: 2,
      seed,
    });
    assert.ok(!hanoiRules.isSolved(board), `seed ${seed} produced a finished board`);
  }
});

// ── The ladders ─────────────────────────────────────────────────────────────────

test("every sliding tile level is playable", () => {
  const report = certifyLadder(slidingTileRules, slidingTileLadder, solvedTileBoard);
  const broken = report.filter(level => !level.ok);
  assert.deepEqual(broken.map(l => `${l.id}: ${l.problems.join("; ")}`), []);
  assert.equal(report.length, slidingTileLadder.all.length);
});

test("every tower of hanoi level is playable", () => {
  const report = certifyLadder(hanoiRules, hanoiLadder, solvedHanoiBoard);
  const broken = report.filter(level => !level.ok);
  assert.deepEqual(broken.map(l => `${l.id}: ${l.problems.join("; ")}`), []);
});

test("certify catches a level that cannot be solved", () => {
  // A board whose only "solved" state is unreachable — the check that stands between a
  // broken board and a child's learning path.
  const impossible = makeLadder([
    { id: "bad", title: "Bad", blurb: "", tier: "beginner" as const, params: { size: 3 }, scramble: 8 },
  ]);
  const neverSolved = { ...slidingTileRules, isSolved: () => false };
  const [level] = certifyLadder(neverSolved, impossible, solvedTileBoard, { budget: 2000 });
  assert.equal(level.ok, false);
  assert.ok(level.problems.some(p => p.includes("no solution")));
});

test("certify catches a duplicated level id", () => {
  const twice = makeLadder([
    { id: "same", title: "A", blurb: "", tier: "beginner" as const, params: { size: 3 }, scramble: 6 },
    { id: "same", title: "B", blurb: "", tier: "beginner" as const, params: { size: 3 }, scramble: 6 },
  ]);
  const report = certifyLadder(slidingTileRules, twice, solvedTileBoard);
  assert.ok(report[1].problems.some(p => p.includes("duplicate level id")));
});

test("certify reports the shortest solution as the difficulty signal", () => {
  const report = certifyLadder(slidingTileRules, slidingTileLadder, solvedTileBoard);
  for (const level of report) {
    assert.equal(typeof level.solutionMoves, "number");
    assert.ok(level.solutionMoves! > 0, `${level.id} has nothing to do`);
  }
});

test("tiers never go backwards down a ladder", () => {
  for (const ladder of [slidingTileLadder, hanoiLadder]) {
    let rank = -1;
    for (const level of ladder.all) {
      const current = TIERS.indexOf(level.tier);
      assert.ok(current >= rank, `${level.id} drops below the rung above it`);
      rank = Math.max(rank, current);
    }
  }
});

test("getLevel falls back to the first rung rather than returning undefined", () => {
  assert.equal(slidingTileLadder.getLevel("nope").id, slidingTileLadder.all[0].id);
  assert.equal(slidingTileLadder.getLevel(undefined).id, slidingTileLadder.all[0].id);
  assert.equal(slidingTileLadder.getLevel("st_3").id, "st_3");
  assert.equal(slidingTileLadder.positionOf("st_3"), 3);
});

// ── Play helpers ────────────────────────────────────────────────────────────────

test("stars reward a tidy solve without punishing a slow one", () => {
  assert.equal(starsFor(10, 10), 3);
  assert.equal(starsFor(12, 10), 3);
  assert.equal(starsFor(18, 10), 2);
  assert.equal(starsFor(40, 10), 1);
  // No par known — finishing is the achievement.
  assert.equal(starsFor(99, undefined), 3);
});

test("formatTime pads the seconds", () => {
  assert.equal(formatTime(0), "0:00");
  assert.equal(formatTime(9), "0:09");
  assert.equal(formatTime(75), "1:15");
});
