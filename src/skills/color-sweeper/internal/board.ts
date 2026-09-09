/** Public puzzle data deliberately has no hidden answer. Solvers and hints take this type. */
export const COLOR_IDS = ["orange", "navy", "cyan"] as const;
export type Color = typeof COLOR_IDS[number];
export type BoardSize = 3 | 4;
export type PositionKind = "corner" | "edge" | "center";
/**
 * The cells a clue counts over.
 *
 * Three of the five clue kinds in §2 differ only in this: a neighbourhood, a
 * row, an outlined region and the whole board are all "a set of cells", and
 * once a clue can name its own set, zero / full / remaining / reduction work
 * on every one of them without a new rule each. A run adds a condition on top
 * of a line rather than a new scope.
 */
export type ClueScope =
  | { readonly kind: "neighborhood" }
  | { readonly kind: "line"; readonly axis: "row" | "column"; readonly index: number }
  | { readonly kind: "region"; readonly cells: readonly number[] }
  | { readonly kind: "board" };

export interface Clue {
  readonly id: string;
  /** The tile it is written on. Absent for a line, region or board clue. */
  readonly cell?: number;
  /** The tile the clue is written on. Absent for a clue drawn beside the board. */
  readonly color?: Color;
  readonly count: number;
  /**
   * The colour this clue counts, when it is not the colour it sits on.
   *
   * Two colours that were one field until level 15. A 1-2-1 wall needs three
   * clues that count the tiles above them without being that colour
   * themselves, and while a clue could only count its own colour the printed
   * numbers came out as 2-4-2 — arithmetically the same deduction, and not
   * the pattern the lesson is named after.
   *
   * Optional, so every board written before this still means what it said.
   */
  readonly countedColor?: Color;
  /** Which cells it counts. A neighbourhood when unstated. */
  readonly scope?: ClueScope;
  /**
   * Whether the counted tiles sit together, for a clue along a line.
   *
   * Hexcells writes these `{n}` and `-n-`. The count alone is the same either
   * way — what changes is which arrangements of it are allowed, which is why
   * a board whose count already decides the line teaches nothing here.
   */
  readonly run?: "together" | "apart";
}

export const scopeOf = (clue: Clue): ClueScope => clue.scope ?? { kind: "neighborhood" };

/** The colour a clue counts. Never read `clue.color` for this. */
export const counted = (clue: Clue): Color => clue.countedColor ?? clue.color!;

/** Every cell a clue counts over. The one question each clue kind answers differently. */
export function governed(clue: Clue, size: BoardSize): number[] {
  const scope = scopeOf(clue);
  const all = Array.from({ length: size * size }, (_, i) => i);
  switch (scope.kind) {
    case "neighborhood": return neighbors(clue.cell!, size);
    case "line": return scope.axis === "row"
      ? all.filter((i) => Math.floor(i / size) === scope.index)
      : all.filter((i) => i % size === scope.index);
    case "region": return [...scope.cells];
    case "board": return all;
  }
}
export interface Board {
  readonly size: BoardSize;
  readonly palette: readonly Color[];
  readonly givens: readonly (Color | null)[];
  readonly clues: readonly Clue[];
}
export type Assignment = readonly (Color | null)[];

export function neighbors(cell: number, size: BoardSize): number[] {
  if (![3, 4].includes(size) || !Number.isInteger(cell) || cell < 0 || cell >= size * size) throw new Error("Invalid board position");
  const row = Math.floor(cell / size), col = cell % size, result: number[] = [];
  for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
    const r = row + dr, c = col + dc;
    if ((dr || dc) && r >= 0 && r < size && c >= 0 && c < size) result.push(r * size + c);
  }
  return result;
}
export function positionKind(cell: number, size: BoardSize): PositionKind {
  neighbors(cell, size); // Bounds check shares the public geometry contract.
  const row = Math.floor(cell / size), col = cell % size;
  const edges = Number(row === 0 || row === size - 1) + Number(col === 0 || col === size - 1);
  return edges === 2 ? "corner" : edges === 1 ? "edge" : "center";
}
export function validateBoard(board: Board): void {
  if (![3, 4].includes(board.size) || board.givens.length !== board.size ** 2) throw new Error("Board size and givens disagree");
  if (![2, 3].includes(board.palette.length) || new Set(board.palette).size !== board.palette.length || board.palette.some(c => !COLOR_IDS.includes(c))) throw new Error("Palette needs two or three distinct supported colors");
  if (board.givens.some(c => c !== null && !board.palette.includes(c))) throw new Error("Given color is outside the palette");
  const ids = new Set<string>(), cells = new Set<number>();
  for (const clue of board.clues) {
    const scope = scopeOf(clue);
    if (!clue.id.trim() || ids.has(clue.id)) throw new Error("Clues need unique nonempty IDs");
    if (scope.kind === "neighborhood") {
      if (clue.cell === undefined || clue.color === undefined) throw new Error("A neighborhood clue needs a tile of its own");
      neighbors(clue.cell, board.size); // Bounds check via the shared geometry.
      if (cells.has(clue.cell)) throw new Error("Two clues share a tile");
      if (!board.palette.includes(clue.color) || board.givens[clue.cell] !== clue.color) throw new Error("A clue must be on a fixed tile of its own color");
      cells.add(clue.cell);
    } else if (clue.cell !== undefined) {
      throw new Error("A line, region or board clue is drawn beside the board, not on a tile");
    }
    if (scope.kind === "line" && (!Number.isInteger(scope.index) || scope.index < 0 || scope.index >= board.size)) {
      throw new Error("A line clue names a row or column outside the board");
    }
    if (scope.kind === "region") {
      if (!scope.cells.length || new Set(scope.cells).size !== scope.cells.length) throw new Error("A region needs distinct cells");
      scope.cells.forEach((i) => neighbors(i, board.size));
    }
    if (clue.run !== undefined && scope.kind !== "line") throw new Error("A run condition belongs to a line clue");
    if (clue.run !== undefined && board.palette.length !== 2) throw new Error("A run needs a two-color palette");
    if (!board.palette.includes(counted(clue))) throw new Error("A clue counts a color outside the palette");
    const over = governed(clue, board.size);
    if (!Number.isInteger(clue.count) || clue.count < 0 || clue.count > over.length) throw new Error("Clue count exceeds what it counts over");
    ids.add(clue.id);
  }
}
export function validateAssignment(board: Board, assignment: Assignment): void {
  if (assignment.length !== board.givens.length) throw new Error("Assignment has the wrong size");
  assignment.forEach((c, i) => {
    if (c !== null && !board.palette.includes(c)) throw new Error("Assignment color is outside the palette");
    if (board.givens[i] !== null && c !== board.givens[i]) throw new Error("Fixed tiles cannot be changed or erased");
  });
}
/** An unordered cell selection has one answer representation, regardless of tap order. */
export function selectionKey(cells: readonly number[], size: BoardSize): string {
  cells.forEach(c => neighbors(c, size));
  return [...new Set(cells)].sort((a, b) => a - b).join(",");
}
export function boardKey(board: Board): string {
  validateBoard(board);
  return JSON.stringify({ size: board.size, palette: [...board.palette].sort(), givens: board.givens,
    clues: [...board.clues].map((c) => [c.id, c.cell ?? -1, c.count, counted(c), JSON.stringify(scopeOf(c))])
      .sort((a, b) => String(a[0]).localeCompare(String(b[0]))) });
}
export function answerKey(board: Board, assignment: Assignment): string {
  validateAssignment(board, assignment);
  if (assignment.some(c => c === null)) throw new Error("An incomplete board is not an answer");
  return assignment.map((c, i) => board.givens[i] === null ? `${i}:${c}` : null).filter(c => c !== null).join(",");
}
