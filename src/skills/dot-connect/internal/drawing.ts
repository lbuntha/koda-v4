import { adjacent } from "./grid";
import type { Board } from "./types";

/**
 * Drawing, as pure functions — everything a drag does to the lines, with no
 * React and no pointer. The engine turns pointer moves into cells and calls
 * these; tests drive them directly.
 *
 * `lines[k]` is colour k's line, starting on one of its dots. A drag starts on
 * a dot (a fresh line) or on a line (cut back to that square, then continue).
 * Lines cut by the one being drawn are measured against `base`, the lines as
 * they were when the drag began — so pulling back in the same drag gives them
 * back, the way the genre plays.
 */

export type Lines = number[][];
export interface Drag { k: number; base: Lines }
export type Refusal = "wall" | "dot" | "straight" | "edge" | "done" | "far";

export const emptyLines = (board: Board): Lines => board.pairs.map(() => []);
const clone = (lines: Lines): Lines => lines.map((l) => l.slice());

const dotOwner = (board: Board, cell: number) => board.pairs.findIndex(([a, b]) => a === cell || b === cell);
const isBridge = (board: Board, cell: number) => board.bridges?.includes(cell) ?? false;

/** A line's squares as occupancy keys: a bridge square is used across or down. */
function keysOf(board: Board, line: number[]): string[] {
  return line.map((cell, i) => {
    if (!isBridge(board, cell)) return String(cell);
    const prev = line[i - 1];
    return `${cell}:${prev !== undefined && Math.floor(prev / board.size) === Math.floor(cell / board.size) ? "h" : "v"}`;
  });
}

/** Colour whose line covers `cell` (not counting bridges, which two can share), or -1. */
export function lineAt(board: Board, lines: Lines, cell: number): number {
  if (isBridge(board, cell)) return -1;
  return lines.findIndex((line) => line.includes(cell));
}

/** Runs dot to dot. */
export function isJoined(board: Board, lines: Lines, k: number): boolean {
  const line = lines[k];
  if (!line || line.length < 2) return false;
  const [a, b] = board.pairs[k];
  const first = line[0], last = line[line.length - 1];
  return (first === a && last === b) || (first === b && last === a);
}

/** Begin a drag at `cell`. Null when there is nothing there to draw from. */
export function startDrag(board: Board, lines: Lines, cell: number): { lines: Lines; drag: Drag } | null {
  const next = clone(lines);
  const dot = dotOwner(board, cell);
  let k: number;
  if (dot >= 0) {
    k = dot;
    next[k] = [cell];
  } else {
    k = lineAt(board, lines, cell);
    if (k < 0) return null;
    next[k] = next[k].slice(0, next[k].indexOf(cell) + 1);
  }
  return { lines: next, drag: { k, base: clone(next) } };
}

function applyCuts(board: Board, lines: Lines, drag: Drag): Lines {
  const mine = new Set(keysOf(board, lines[drag.k]));
  return lines.map((line, j) => {
    if (j === drag.k) return line;
    const keys = keysOf(board, drag.base[j]);
    const cut = keys.findIndex((key) => mine.has(key));
    return cut < 0 ? drag.base[j].slice() : drag.base[j].slice(0, cut);
  });
}

/**
 * One step of the drawing line into `cell`: forward, or back along itself.
 * Returns the new lines, or why the step is not allowed.
 */
export function stepTo(board: Board, lines: Lines, drag: Drag, cell: number): Lines | Refusal {
  const line = lines[drag.k];
  const head = line[line.length - 1];
  if (cell === head) return lines;
  const size = board.size;

  // Back along itself: drop the squares after `cell`.
  if (cell === line[line.length - 2]) {
    const next = lines.map((l, j) => (j === drag.k ? l.slice(0, -1) : l));
    return applyCuts(board, next, drag);
  }
  const at = isBridge(board, cell) ? -1 : line.indexOf(cell);
  if (at >= 0) {
    const next = lines.map((l, j) => (j === drag.k ? l.slice(0, at + 1) : l));
    return applyCuts(board, next, drag);
  }

  if (!adjacent(head, cell, size)) return "far";
  // On a bridge a line goes straight over.
  if (isBridge(board, head) && line.length > 1 && cell - head !== head - line[line.length - 2]) return "straight";
  if (isJoined(board, lines, drag.k)) return "done";
  if (board.walls.includes(cell)) return "wall";
  const dot = dotOwner(board, cell);
  if (dot >= 0 && (dot !== drag.k || cell === line[0])) return "dot";
  if (isBridge(board, cell)) {
    const beyond = cell + (cell - head);
    const across = Math.abs(cell - head) === 1;
    if (beyond < 0 || beyond >= size * size || (across && Math.floor(beyond / size) !== Math.floor(cell / size))) return "edge";
  }
  const next = lines.map((l, j) => (j === drag.k ? [...l, cell] : l));
  return applyCuts(board, next, drag);
}

/**
 * Steps toward `cell` one square at a time — a finger moves faster than one
 * square per pointer event. Stops at the first refusal and reports it.
 */
export function dragTo(board: Board, lines: Lines, drag: Drag, cell: number): { lines: Lines; refused?: Refusal } {
  let current = lines;
  const size = board.size;
  for (let guard = 0; guard < size * size * 2; guard += 1) {
    const line = current[drag.k];
    const head = line[line.length - 1];
    if (head === cell) return { lines: current };
    let step: number;
    if (line.includes(cell) && !isBridge(board, cell)) step = cell;
    else if (isBridge(board, head) && line.length > 1) step = head + (head - line[line.length - 2]);
    else {
      const hr = Math.floor(head / size), hc = head % size;
      const tr = Math.floor(cell / size), tc = cell % size;
      step = Math.abs(tr - hr) >= Math.abs(tc - hc)
        ? (hr + Math.sign(tr - hr)) * size + hc
        : hr * size + hc + Math.sign(tc - hc);
    }
    const result = stepTo(board, current, drag, step);
    if (typeof result === "string") return { lines: current, refused: result };
    current = result;
  }
  return { lines: current };
}

/**
 * Draws colour k's answer line, cutting whatever was in its way — the third
 * hint rung, done rather than described.
 */
export function placeLine(board: Board, lines: Lines, k: number, answer: number[]): Lines {
  const drag: Drag = { k, base: clone(lines) };
  const next = clone(lines);
  next[k] = answer.slice();
  return applyCuts(board, next, drag);
}

export const sameLines = (a: Lines, b: Lines) =>
  a.length === b.length && a.every((line, k) => line.length === b[k].length && line.every((c, i) => c === b[k][i]));
