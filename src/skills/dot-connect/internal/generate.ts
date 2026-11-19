import { checkLines } from "./check";
import { hasFeature } from "./features";
import { adjacent, neighbours, rng, shuffle } from "./grid";
import { solve } from "./solve";
import type { Board, BoardSpec, GeneratedBoard } from "./types";

/**
 * Where a board comes from.
 *
 * 1. A random path through every square: a serpentine, scrambled by backbite
 *    moves (join an end to a neighbour, reverse the loose tail).
 * 2. Cut into short pieces, then re-join any two pieces whose ends touch until
 *    the pair count is reached. Re-joining at random, not in path order, stops
 *    every dot sitting beside the next colour's dot.
 * 3. Walls are taken from line ends, so every line stays a single path.
 * 4. The board must pass the rule check, the solver (one answer, for
 *    fill-the-board lessons), its difficulty band and its lesson feature.
 *    Otherwise redraw.
 */

const MAX_ATTEMPTS = 300;
const MIN_LINE = 3;

function randomHamiltonian(size: number, random: () => number): number[] {
  const path: number[] = [];
  for (let r = 0; r < size; r += 1) {
    for (let c = 0; c < size; c += 1) path.push(r * size + (r % 2 === 0 ? c : size - 1 - c));
  }
  const pos = new Int32Array(size * size);
  const reindex = (from: number) => { for (let i = from; i < path.length; i += 1) pos[path[i]] = i; };
  reindex(0);
  const moves = size * size * 30;
  for (let m = 0; m < moves; m += 1) {
    if (random() < 0.5) { path.reverse(); reindex(0); }
    const end = path[path.length - 1];
    const prev = path[path.length - 2];
    const options = neighbours(end, size).filter((nb) => nb !== prev);
    if (!options.length) continue;
    const i = pos[options[Math.floor(random() * options.length)]];
    const tail = path.splice(i + 1).reverse();
    path.push(...tail);
    reindex(i + 1);
  }
  return path;
}

function cutAndJoin(path: number[], spec: BoardSpec, target: number, random: () => number): number[][] | null {
  const { size } = spec;
  const pieces: number[][] = [];
  let i = 0;
  while (i < path.length) {
    const len = random() < 0.5 ? 2 : 3;
    pieces.push(path.slice(i, i + len));
    i += len;
  }
  if (pieces.length > 1 && pieces[pieces.length - 1].length < 2) pieces[pieces.length - 2].push(...pieces.pop()!);
  const open = size * size - (spec.walls ?? 0);
  const maxLen = target === 1 ? size * size : Math.ceil((open / target) * 1.8) + (spec.walls ?? 0);

  while (pieces.length > target) {
    const joins: Array<[number, boolean, number, boolean]> = [];
    for (let a = 0; a < pieces.length; a += 1) {
      for (let b = a + 1; b < pieces.length; b += 1) {
        if (pieces[a].length + pieces[b].length > maxLen) continue;
        for (const aEnd of [true, false]) {
          for (const bStart of [true, false]) {
            const ea = aEnd ? pieces[a][pieces[a].length - 1] : pieces[a][0];
            const eb = bStart ? pieces[b][0] : pieces[b][pieces[b].length - 1];
            if (adjacent(ea, eb, size)) joins.push([a, aEnd, b, bStart]);
          }
        }
      }
    }
    if (!joins.length) return null;
    // Favour joining short pieces, so lengths stay even across colours.
    joins.sort((x, y) => (pieces[x[0]].length + pieces[x[2]].length) - (pieces[y[0]].length + pieces[y[2]].length));
    const pool = joins.slice(0, Math.max(1, Math.ceil(joins.length / 2)));
    let merged: number[] | null = null;
    let at = -1, drop = -1;
    while (pool.length && !merged) {
      const [a, aEnd, b, bStart] = pool.splice(Math.floor(random() * pool.length), 1)[0];
      const left = aEnd ? pieces[a] : pieces[a].slice().reverse();
      const right = bStart ? pieces[b] : pieces[b].slice().reverse();
      const line = [...left, ...right];
      // A line running beside itself can almost always be redrawn another way,
      // so fill-the-board lessons never make one — it would not have one answer.
      // Step-count boards want a second answer without the count, so they keep them.
      if (spec.mustFill && !spec.steps && touchesItself(line, size)) continue;
      merged = line; at = a; drop = b;
    }
    if (!merged) return null;
    pieces[at] = merged;
    pieces.splice(drop, 1);
  }
  return pieces;
}

/** Two squares of one line side by side, but not one after the other in it. */
export function touchesItself(line: number[], size: number): boolean {
  const at = new Map(line.map((cell, i) => [cell, i]));
  return line.some((cell, i) => neighbours(cell, size).some((nb) => {
    const j = at.get(nb);
    return j !== undefined && Math.abs(i - j) > 1;
  }));
}

function takeWalls(pieces: number[][], count: number, random: () => number): number[] | null {
  const walls: number[] = [];
  for (let w = 0; w < count; w += 1) {
    const long = pieces.filter((p) => p.length > MIN_LINE + 1);
    if (!long.length) return null;
    const piece = long[Math.floor(random() * long.length)];
    walls.push(random() < 0.5 ? piece.shift()! : piece.pop()!);
  }
  return walls.sort((x, y) => x - y);
}

/**
 * Turns one square into a bridge by joining two lines across another.
 *
 * Needs a square where line P runs straight through, with the ends of two other
 * lines on either side of it the other way. Those two become one line that
 * crosses P there — so the board has one pair fewer and both ways of the bridge
 * are used by the answer.
 */
function addBridge(pieces: number[][], size: number, random: () => number): { pieces: number[][]; bridge: number } | null {
  const order = shuffle(Array.from({ length: size * size }, (_, i) => i), random);
  const sameRow = (a: number, b: number) => Math.floor(a / size) === Math.floor(b / size);
  for (const b of order) {
    const p = pieces.findIndex((piece) => piece.indexOf(b) > 0 && piece.indexOf(b) < piece.length - 1);
    if (p < 0) continue;
    const at = pieces[p].indexOf(b);
    const d = b - pieces[p][at - 1];
    if (pieces[p][at + 1] - b !== d) continue;
    const perp = Math.abs(d) === 1 ? size : 1;
    const u = b - perp, w = b + perp;
    if (u < 0 || w >= size * size || (perp === 1 && (!sameRow(u, b) || !sameRow(w, b)))) continue;
    const endAt = (cell: number) => pieces.findIndex((piece, i) => i !== p && (piece[0] === cell || piece[piece.length - 1] === cell));
    const q1 = endAt(u), q2 = endAt(w);
    if (q1 < 0 || q2 < 0 || q1 === q2) continue;
    const into = pieces[q1][pieces[q1].length - 1] === u ? pieces[q1] : pieces[q1].slice().reverse();
    const out = pieces[q2][0] === w ? pieces[q2] : pieces[q2].slice().reverse();
    const rest = pieces.filter((_, i) => i !== q1 && i !== q2);
    return { pieces: [...rest, [...into, b, ...out]], bridge: b };
  }
  return null;
}

/** Letters run in reading order: A is the first dot met from the top left. */
function toBoard(size: number, walls: number[], pieces: number[][], bridges: number[] = []): Board {
  const lines = pieces
    .map((p) => (p[0] <= p[p.length - 1] ? p.slice() : p.slice().reverse()))
    .sort((x, y) => x[0] - y[0]);
  const board: Board = { size, walls, pairs: lines.map((l) => [l[0], l[l.length - 1]] as [number, number]), solution: lines };
  if (bridges.length) board.bridges = bridges;
  return board;
}

function candidate(spec: BoardSpec, random: () => number): Board | null {
  const lines = spec.pairs + (spec.bridge ? 1 : 0);
  let pieces = cutAndJoin(randomHamiltonian(spec.size, random), spec, lines, random);
  if (!pieces || pieces.length !== lines) return null;
  const walls = takeWalls(pieces, spec.walls ?? 0, random);
  if (!walls) return null;
  const bridges: number[] = [];
  if (spec.bridge) {
    const made = addBridge(pieces, spec.size, random);
    if (!made) return null;
    pieces = made.pieces;
    bridges.push(made.bridge);
  }
  if (pieces.some((p) => p.length < MIN_LINE)) return null;
  return toBoard(spec.size, walls, pieces, bridges);
}

/**
 * Picks the pair whose step count makes a board with two answers have one.
 * The count is the stored answer's own, so the answer always meets it.
 */
function withSteps(board: Board, random: () => number): { board: Board; difficulty: number } | null {
  const free = solve(board, 2);
  if (free.capped || free.count < 2) return null;
  for (const k of shuffle(board.pairs.map((_, i) => i), random)) {
    const steps = { pair: k, steps: board.solution[k].length - 1 };
    const result = solve({ ...board, steps }, 2);
    if (!result.capped && result.count === 1) return { board: { ...board, steps }, difficulty: result.branches };
  }
  return null;
}

/** The rules hold for the stored answer: every pair joined, every square covered. */
export function answerIsValid(board: Board): boolean {
  const check = checkLines(board, board.solution);
  return check.errors.length === 0 && check.joined.length === board.pairs.length && check.covered === check.open;
}

export function generateBoard(spec: BoardSpec, seed: string | number): GeneratedBoard {
  let fallback: GeneratedBoard | null = null;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const random = rng(`${spec.id}:${seed}:${attempt}`);
    let board = candidate(spec, random);
    if (!board || !answerIsValid(board)) continue;
    let difficulty = 0;
    if (spec.steps) {
      const counted = withSteps(board, random);
      if (!counted) continue;
      board = counted.board;
      difficulty = counted.difficulty;
    } else if (spec.mustFill) {
      const result = solve(board);
      if (result.capped || result.count !== 1) continue;
      difficulty = result.branches;
    }
    const [low, high] = spec.difficulty ?? [0, Infinity];
    const inBand = difficulty >= low && difficulty <= high;
    const made: GeneratedBoard = { ...board, specId: spec.id, difficulty, fallback: false };
    if (inBand && (!spec.feature || hasFeature(board, spec.feature))) return made;
    fallback ??= { ...made, fallback: true };
  }
  if (fallback) return fallback;
  throw new Error(`dot-connect: no board for spec "${spec.id}" — check its size, pairs and walls`);
}
