import type { Board } from "./types";

/**
 * Judges a child's lines against the rules alone.
 *
 * Deliberately shares nothing with the generator or the solver: it never looks
 * at `board.solution`, so a different valid answer is still a solve, and a bug in
 * generation cannot hide behind a check written the same way.
 */
export interface LineCheck {
  /** Colours whose line runs dot to dot. */
  joined: number[];
  /** Open squares (not walls) covered. A bridge counts once both ways are used. */
  covered: number;
  /** Open squares on the board. */
  open: number;
  /** Rule breaks found; empty for any board a player could legally draw. */
  errors: string[];
  /** The step-count pair is joined with the wrong number of steps. */
  stepsOff: boolean;
}

export function checkLines(board: Board, lines: number[][]): LineCheck {
  const { size, pairs } = board;
  const walls = new Set(board.walls);
  const bridges = new Set(board.bridges ?? []);
  const dotOwner = new Map<number, number>();
  pairs.forEach(([a, b], k) => { dotOwner.set(a, k); dotOwner.set(b, k); });
  /** Cell, or `cell:h` / `cell:v` on a bridge, to the line using it. */
  const used = new Map<string, number>();
  const errors: string[] = [];
  const joined: number[] = [];
  const row = (c: number) => Math.floor(c / size);
  const col = (c: number) => c % size;

  lines.forEach((line, k) => {
    if (!line || line.length === 0) return;
    const [a, b] = pairs[k] ?? [];
    if (line[0] !== a && line[0] !== b) errors.push(`line ${k} does not start on its dot`);
    for (let i = 0; i < line.length; i += 1) {
      const cell = line[i];
      if (cell < 0 || cell >= size * size || !Number.isInteger(cell)) { errors.push(`line ${k} leaves the board`); continue; }
      if (walls.has(cell)) errors.push(`line ${k} enters a wall`);
      const dot = dotOwner.get(cell);
      if (dot !== undefined && dot !== k) errors.push(`line ${k} enters another colour's dot`);
      if (i > 0) {
        const prev = line[i - 1];
        if (Math.abs(row(cell) - row(prev)) + Math.abs(col(cell) - col(prev)) !== 1) errors.push(`line ${k} jumps`);
      }
      let key = String(cell);
      if (bridges.has(cell)) {
        const prev = line[i - 1];
        const next = line[i + 1];
        const across = prev !== undefined && row(prev) === row(cell);
        key = `${cell}:${across ? "h" : "v"}`;
        if (prev === undefined) errors.push(`line ${k} starts on a bridge`);
        if (prev !== undefined && next !== undefined && next - cell !== cell - prev) errors.push(`line ${k} turns on a bridge`);
      }
      if (used.has(key)) errors.push(`line ${k} overlaps line ${used.get(key)}`);
      used.set(key, k);
    }
    const first = line[0], last = line[line.length - 1];
    if (line.length > 1 && ((first === a && last === b) || (first === b && last === a))) joined.push(k);
  });

  const open = size * size - walls.size;
  let covered = 0;
  for (let cell = 0; cell < size * size; cell += 1) {
    if (walls.has(cell)) continue;
    if (bridges.has(cell) ? used.has(`${cell}:h`) && used.has(`${cell}:v`) : used.has(String(cell))) covered += 1;
  }
  const s = board.steps;
  const stepsOff = !!s && joined.includes(s.pair) && lines[s.pair].length - 1 !== s.steps;
  return { joined, covered, open, errors, stepsOff };
}

/** Solved: no rule broken, every pair joined, the step count met, and — when the lesson asks — every square covered. */
export function isSolved(board: Board, lines: number[][], mustFill: boolean): boolean {
  const result = checkLines(board, lines);
  if (result.errors.length || result.stepsOff) return false;
  if (result.joined.length !== board.pairs.length) return false;
  return !mustFill || result.covered === result.open;
}
