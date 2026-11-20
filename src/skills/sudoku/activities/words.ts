import { bit, colOf, rowOf, type House } from "../internal/board";
import { PLACES, apply, cloneState, findsWith, nextStep, upTo, type Move, type State, type Step, type Technique } from "../internal/techniques";
import { tx } from "../internal/i18n";

/** "Row 3", "Column 5", "Box 2" — 1-based, as a child counts. */
export const houseName = (h: House): string => tx(`house.${h.kind}`, { n: String(h.index + 1) });

export const cellName = (n: number, cell: number): string =>
  tx("cell", { row: String(rowOf(n, cell) + 1), col: String(colOf(n, cell) + 1) });

export const techniqueName = (t: Technique): string => tx(`technique.${t}`);

/** What a hint rung points at on the board. */
export interface HintFocus {
  /** Light shading: the house or houses the rung talks about. */
  area: number[];
  /** Cells that make the pattern. */
  cells: number[];
  /** Notes to take out. */
  struck: Move[];
  /** The cell to fill, on the last rung. */
  target?: Move;
}

export interface TechniqueHint {
  rungs: string[];
  focus: HintFocus[];
}

/**
 * The placement a step leads to: its own, or — for a step that only removes
 * notes — the first number the solve can place after it, using nothing harder.
 */
export function placementAfter(s: State, step: Step, answer: number[], prefer: Move[] = []): Move | undefined {
  if (step.placements.length) return step.placements[0];
  const work = cloneState(s);
  apply(work, step);
  for (let guard = 0; guard < 40; guard += 1) {
    const open = findsWith(work, "naked-single").filter((m) => answer[m.cell] === m.value);
    const liked = open.find((m) => prefer.some((p) => p.cell === m.cell && p.value === m.value));
    if (liked ?? open[0]) return liked ?? open[0];
    const next = nextStep(work, upTo(step.technique));
    if (!next) return undefined;
    apply(work, next);
  }
  return undefined;
}

/**
 * Three rungs for one step: where to look and what to look for, why it works,
 * and the move. Each rung brings its own focus, so the board can show what the
 * words say.
 */
export function techniqueHint(s: State, step: Step, answer: number[], name: (d: number) => string = String, prefer: Move[] = []): TechniqueHint {
  const t = step.technique;
  const n = s.n;
  const d = step.digits[0];
  const vars = {
    house: step.house ? houseName(step.house) : "",
    other: step.other ? houseName(step.other) : "",
    d: name(d),
    a: name(step.digits[0]),
    b: name(step.digits[1] ?? step.digits[0]),
    cell: cellName(n, step.cells[0]),
    lines: tx(step.house?.kind === "row" ? "lines.cols" : "lines.rows"),
    have: step.house
      ? step.house.cells.filter((x) => s.grid[x]).map((x) => s.grid[x]).sort((p, q) => p - q).map(name).join(", ")
      : "",
  };
  const area = [...(step.house?.cells ?? []), ...(step.other?.cells ?? [])];
  const target = placementAfter(s, step, answer, prefer);
  const rungs = [tx(`hint.where.${t}`, vars), tx(`hint.why.${t}`, vars)];
  const focus: HintFocus[] = [
    { area, cells: step.cells, struck: [] },
    { area, cells: step.cells, struck: step.eliminations },
  ];
  if (target) {
    rungs.push(
      PLACES.has(t)
        ? tx("hint.answer", { d: name(target.value), cell: cellName(n, target.cell) })
        : tx("hint.answerAfter", { d: name(target.value), cell: cellName(n, target.cell) }),
    );
    focus.push({ area, cells: step.cells, struck: step.eliminations, target });
  }
  return { rungs, focus };
}

/** Struck notes as cell → mask, the shape the board takes. */
export function struckMap(moves: Move[]): Map<number, number> {
  const out = new Map<number, number>();
  for (const m of moves) out.set(m.cell, (out.get(m.cell) ?? 0) | bit(m.value));
  return out;
}

/** "1:05" */
export function clock(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** "4.2" seconds, for a quick find. */
export const seconds = (ms: number): string => (Math.max(0, ms) / 1000).toFixed(1);
