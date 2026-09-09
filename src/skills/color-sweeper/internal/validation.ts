import { counted, governed, validateAssignment, validateBoard, type Assignment, type Board, type Color } from "./board";

export interface ValidationResult {
  status: "none" | "unique" | "multiple" | "budget-exhausted";
  solutions: Color[][]; visited: number;
}
/**
 * Independent exhaustive check: its geometry, counting, and search do not call the
 * teaching solver or neighbors(). Finding one solution before timeout is NOT uniqueness.
 */
export function enumerateSolutions(board: Board, options: { maxNodes?: number; assigned?: Assignment } = {}): ValidationResult {
  validateBoard(board);
  const assigned = options.assigned ?? board.givens;
  validateAssignment(board, assigned);
  const budget = options.maxNodes ?? 100_000;
  if (!Number.isInteger(budget) || budget < 1) throw new Error("Validation needs a positive node budget");
  const cells = [...assigned], solutions: Color[][] = [];
  let visited = 0, exhausted = false;
  /* Its own geometry, not the solver's: for a neighbourhood clue this walks the
     eight offsets by hand rather than calling `neighbors`, which is the whole
     point of an independent checker. Other scopes have one obvious reading and
     are taken from `governed`. */
  const sets = board.clues.map(clue => {
    const scope = clue.scope ?? { kind: "neighborhood" as const };
    let indices: number[] = [];
    if (scope.kind === "neighborhood") {
      const cell = clue.cell!;
      for (let i = 0; i < cells.length; i++) {
        if (i !== cell && Math.abs(Math.floor(i / board.size) - Math.floor(cell / board.size)) <= 1 && Math.abs(i % board.size - cell % board.size) <= 1) indices.push(i);
      }
    } else {
      indices = governed(clue, board.size);
    }
    return { ...clue, color: counted(clue), indices };
  });
  const unknown = cells.flatMap((c, i) => c === null ? [i] : []);
  // Most-constrained first improves pruning but does not remove any candidate.
  unknown.sort((a, b) => sets.filter(c => c.indices.includes(b)).length - sets.filter(c => c.indices.includes(a)).length || a - b);
  const feasible = () => sets.every(clue => {
    let same = 0, blank = 0;
    for (const i of clue.indices) { if (cells[i] === null) blank++; else if (cells[i] === clue.color) same++; }
    if (same > clue.count || same + blank < clue.count) return false;
    /*
     * A run condition, checked once the line is fully coloured.
     *
     * Its own reading of "together", written out here rather than shared with
     * the solver — an independent checker that borrowed the solver's idea of
     * contiguity would agree with it by construction, including when both are
     * wrong. Only complete lines are judged: a half-filled line has not
     * decided its arrangement yet, and pruning it would throw away answers.
     */
    if (!clue.run || blank > 0) return true;
    const at = clue.indices.map((i, k) => (cells[i] === clue.color ? k : -1)).filter(k => k >= 0);
    let contiguous = true;
    for (let n = 1; n < at.length; n++) if (at[n] !== at[n - 1] + 1) contiguous = false;
    return clue.run === "together" ? contiguous : !contiguous;
  });
  const visit = (index: number): void => {
    if (solutions.length >= 2 || exhausted) return;
    if (visited >= budget) { exhausted = true; return; }
    visited++;
    if (!feasible()) return;
    if (index === unknown.length) { solutions.push([...cells] as Color[]); return; }
    for (const color of board.palette) { cells[unknown[index]] = color; visit(index + 1); }
    cells[unknown[index]] = null;
  };
  visit(0);
  return { status: solutions.length >= 2 ? "multiple" : exhausted ? "budget-exhausted" : solutions.length === 1 ? "unique" : "none", solutions, visited };
}
export function isSolution(board: Board, assignment: Assignment): boolean {
  validateBoard(board); validateAssignment(board, assignment);
  if (assignment.some(c => c === null)) return false;
  return enumerateSolutions(board, { assigned: assignment }).status === "unique";
}
