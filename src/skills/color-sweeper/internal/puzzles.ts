import { answerKey, boardKey, governed, neighbors, positionKind, validateBoard, type Board, type BoardSize, type Clue, type Color, type PositionKind } from "./board";
import { deduce, type ProofStep } from "./deduction";
import { enumerateSolutions, isSolution } from "./validation";

export const BOARD_MODES = ["zero", "full", "remaining", "chain", "overlap", "pattern", "complement", "global", "line", "region", "run_together", "run_apart", "three_color", "cross_color", "totals", "mixed"] as const;
/**
 * The named walls, and the wall that only looks like one.
 *
 * `121` and `1221` are the shapes minesweepergame.com teaches. `121-lookalike`
 * reads 1-2-1 and does not resolve to 1-2-1's answer: the wall sits one tile
 * along, so a child applying the memorised outcome — ends marked, middle safe
 * — gets it wrong, and only the subtraction gets it right. Every pattern
 * lesson draws from a canonical wall and a look-alike for exactly that reason.
 */
export const PATTERN_KINDS = ["121", "121-lookalike", "1221"] as const;
export type PatternKind = typeof PATTERN_KINDS[number];
export type BoardMode = typeof BOARD_MODES[number];
export interface PuzzleSpec {
  mode: BoardMode;
  size?: BoardSize;
  palette?: readonly Color[];
  anchor?: PositionKind;
  remainingCase?: "met" | "one" | "all";
  patternKind?: PatternKind;
  knownMatches?: number;
  minUnknowns?: number;
  maxUnknowns?: number;
}
export interface Puzzle {
  id: string; seed: number; mode: BoardMode; board: Board;
  /** Private grading data. Never pass this object to a board renderer or hint solver. */
  solution: readonly Color[];
  expected: string; proof: readonly ProofStep[];
  generation: { source: "seeded" | "fallback"; attempts: number; repeated: boolean };
}
/**
 * A clue in a template, before the board exists.
 *
 * `at` anchors a neighbourhood clue to a tile and takes its count from the
 * solution. The other three name their own cells and carry the palette index
 * they count, because a line, a region and a whole board have no tile to sit
 * on and no colour of their own.
 */
type TemplateClue =
  | { at: number; counts: "own" | "other" | number }
  | { scope: "board"; color: number }
  | { scope: "row" | "column"; index: number; color: number; run?: "together" | "apart" }
  | { scope: "region"; cells: number[]; color: number };

interface Template {
  size: BoardSize; colors: number[]; unknown: number[]; clues: TemplateClue[];
  /**
   * Skip the eight symmetries.
   *
   * A rotation turns a row into a column and moves a region's cells, so a
   * template carrying those clues is generated in place and takes its variety
   * from the positions the generator draws instead.
   */
  fixed?: boolean;
}
interface NormalSpec { mode: BoardMode; size: BoardSize; palette: readonly Color[]; anchor: PositionKind; remainingCase: "met" | "one" | "all"; patternKind: PatternKind; knownMatches?: number; minUnknowns: number; maxUnknowns: number }
const SEARCH_ATTEMPTS = 8;
function random(seed: number): () => number {
  let state = seed >>> 0;
  return () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
}
function shuffled<T>(items: readonly T[], rand: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [copy[i], copy[j]] = [copy[j], copy[i]]; }
  return copy;
}
function normalize(spec: PuzzleSpec): NormalSpec {
  if (!BOARD_MODES.includes(spec.mode)) throw new Error("Unsupported Color Sweeper mode");
  const advanced = ["overlap", "three_color", "pattern", "mixed"].includes(spec.mode);
  const size = spec.size ?? (advanced || ["line", "run_together", "run_apart"].includes(spec.mode) ? 4 : 3);
  const anySize = ["chain", "line", "run_together", "run_apart"].includes(spec.mode);
  if (["cross_color", "totals"].includes(spec.mode) && size !== 3) throw new Error("Board size is unsupported for this technique");
  if (![3, 4].includes(size) || (advanced && size !== 4) || (!advanced && !anySize && size !== 3)) throw new Error("Board size is unsupported for this technique");
  const threeColor = ["three_color", "cross_color", "totals"].includes(spec.mode);
  const palette = spec.palette ?? (threeColor ? ["orange", "navy", "cyan"] : ["orange", "navy"]);
  validateBoard({ size, palette, givens: Array(size * size).fill(null), clues: [] });
  if (palette.length !== (threeColor ? 3 : 2)) throw new Error("Palette size does not match the technique");
  const simple = ["zero", "full", "remaining"].includes(spec.mode);
  if (spec.anchor !== undefined && (!simple || !["corner", "edge", "center"].includes(spec.anchor))) throw new Error("Anchor is unsupported for this technique");
  if ((spec.remainingCase !== undefined || spec.knownMatches !== undefined) && spec.mode !== "remaining") throw new Error("Remaining-match constraints require remaining mode");
  if (spec.remainingCase !== undefined && !["met", "one", "all"].includes(spec.remainingCase)) throw new Error("Unknown remaining-match case");
  if (spec.patternKind !== undefined && spec.mode !== "pattern") throw new Error("A pattern kind requires pattern mode");
  if (spec.patternKind !== undefined && !PATTERN_KINDS.includes(spec.patternKind)) throw new Error("Unknown wall pattern");
  if (spec.knownMatches !== undefined && (!Number.isInteger(spec.knownMatches) || spec.knownMatches < 1 || spec.knownMatches > 7)) throw new Error("knownMatches must be an integer from 1 to 7");
  const minUnknowns = spec.minUnknowns ?? 1, maxUnknowns = spec.maxUnknowns ?? size * size - 1;
  if (!Number.isInteger(minUnknowns) || !Number.isInteger(maxUnknowns) || minUnknowns < 1 || maxUnknowns >= size * size || minUnknowns > maxUnknowns) throw new Error("Invalid unknown-cell range");
  return { mode: spec.mode, size, palette: [...palette], anchor: spec.anchor ?? "center", remainingCase: spec.remainingCase ?? "one", patternKind: spec.patternKind ?? "121", knownMatches: spec.knownMatches, minUnknowns, maxUnknowns };
}
function template(spec: NormalSpec, rand: () => number): Template {
  if (spec.mode === "cross_color") {
    /*
     * Three colours, and three clues counting different ones over the same
     * three tiles. Only the middle tile is forced: the row and the centre clue
     * between them say how much orange there is, and the two orange clues then
     * disagree about where it can be unless it is the tile they share.
     */
    /* Colour 0 is what the two side clues count, 1 what the middle clue
       counts, 2 the filler. Named by index rather than by "the other one":
       with three colours in play "other" picks whichever comes first, which
       silently made all three clues count the same colour. */
    const colors = [1, 0, 2, 2, 2, 2, 2, 2, 2];
    return { size: 3, colors, unknown: [0, 1, 2], fixed: true,
      clues: [
        { scope: "row", index: 0, color: 2 },
        { at: 3, counts: 0 }, { at: 5, counts: 0 },
        { at: 4, counts: 1 },
      ] };
  }
  if (spec.mode === "totals") {
    /*
     * One total per colour, and a clue that decides which of the last two
     * tiles is which. The totals alone narrow the blanks to a pair; the
     * neighbourhood clue separates them.
     */
    const colors = [0, 1, 2, 2, 0, 2, 2, 2, 1];
    return { size: 3, colors, unknown: [7, 8], fixed: true,
      clues: [
        { scope: "board", color: 0 }, { scope: "board", color: 1 }, { scope: "board", color: 2 },
        { at: 6, counts: 1 },
      ] };
  }
  if (spec.mode === "mixed") {
    /*
     * A board carrying several kinds of clue at once, drawn at random and kept
     * only if it certifies. The point of the level is choosing which clue can
     * still say something, so the mixture has to be real rather than staged.
     */
    const size = 4;
    const colors = Array.from({ length: 16 }, () => rand() < 0.4 ? 0 : 1);
    const cells = shuffled(Array.from({ length: 16 }, (_, i) => i), rand);
    const unknown = cells.slice(0, 4 + Math.floor(rand() * 3));
    const anchor = cells.slice(unknown.length).find(i => neighbors(i, size).some(j => unknown.includes(j)))!;
    const axis = rand() < 0.5 ? "row" as const : "column" as const;
    const index = Math.floor(rand() * size);
    const shape = shuffled(cells, rand).slice(0, 5);
    return { size, colors, unknown, fixed: true,
      clues: [
        { scope: "board", color: 0 },
        { scope: axis, index, color: 0 },
        { scope: "region", cells: shape, color: 0 },
        { at: anchor, counts: "own" },
      ] };
  }
  if (spec.mode === "complement") {
    /* Two clues over the same three tiles, counting different colours. The
       board is deliberately not fully determined: one tile is forced and the
       other two are not, which is the honest state of a board this small. */
    const colors = [0, 1, 0, 1, 1, 1, 1, 1, 1];
    return { size: 3, colors, unknown: [0, 1, 2],
      clues: [{ at: 3, counts: "other" }, { at: 4, counts: "own" }] };
  }
  if (spec.mode === "global") {
    /* A count for the whole board and no clue anywhere near the blanks, so the
       header is the only thing that can decide them. */
    const colors = Array(9).fill(1) as number[];
    const oranges = shuffled([0, 1, 2, 3, 4, 5, 6, 7, 8], rand).slice(0, 3);
    oranges.forEach(i => { colors[i] = 0; });
    const unknown = shuffled([0, 1, 2, 3, 4, 5, 6, 7, 8].filter(i => !oranges.includes(i)), rand).slice(0, 3);
    return { size: 3, colors, unknown, clues: [{ scope: "board", color: 0 }], fixed: true };
  }
  if (spec.mode === "line") {
    const size = 4;
    const axis = rand() < 0.5 ? "row" as const : "column" as const;
    const index = Math.floor(rand() * size);
    const colors = Array(size * size).fill(1) as number[];
    const line = Array.from({ length: size }, (_, k) => axis === "row" ? index * size + k : k * size + index);
    const marked = line[Math.floor(rand() * size)];
    colors[marked] = 0;
    return { size, colors, unknown: line.filter(i => i !== marked), clues: [{ scope: axis, index, color: 0 }], fixed: true };
  }
  if (spec.mode === "run_together" || spec.mode === "run_apart") {
    /*
     * A line the count alone cannot finish.
     *
     * `{2}` on a four-tile line with one end already marked leaves only the
     * pair beside it; the bare count would allow three arrangements. `-2-`
     * with the far end ruled out leaves only the split pair, where the count
     * would again allow three. The condition has to change the answer or the
     * lesson is level 19 with different punctuation.
     */
    const size = 4;
    const axis = rand() < 0.5 ? "row" as const : "column" as const;
    const index = Math.floor(rand() * size);
    const colors = Array(size * size).fill(1) as number[];
    const line = Array.from({ length: size }, (_, k) => axis === "row" ? index * size + k : k * size + index);
    const together = spec.mode === "run_together";
    const flip = rand() < 0.5;
    if (together) {
      /* One end marked; the block must be the pair beside it. */
      const [head, next] = flip ? [line[0], line[1]] : [line[3], line[2]];
      colors[head] = 0; colors[next] = 0;
      return { size, colors, unknown: line.filter(i => i !== head),
        clues: [{ scope: axis, index, color: 0, run: "together" }], fixed: true };
    }
    /* The far end fixed to the other colour; the pair must straddle a gap. */
    const cells = flip ? line : [...line].reverse();
    colors[cells[0]] = 0; colors[cells[2]] = 0;
    return { size, colors, unknown: [cells[0], cells[1], cells[2]],
      clues: [{ scope: axis, index, color: 0, run: "apart" }], fixed: true };
  }
  if (spec.mode === "region") {
    /* An L, never a rectangle: a region clue that happens to outline a block
       is indistinguishable from a shape a child could have guessed. */
    const colors = Array(9).fill(1) as number[];
    const shapes = [[0, 1, 3, 4, 6], [1, 2, 4, 5, 8], [2, 5, 8, 7, 4], [0, 3, 6, 7, 4]];
    const cells = shapes[Math.floor(rand() * shapes.length)];
    const marked = cells[Math.floor(rand() * cells.length)];
    colors[marked] = 0;
    return { size: 3, colors, unknown: cells.filter(i => i !== marked),
      clues: [{ scope: "region", cells, color: 0 }], fixed: true };
  }
  if (spec.mode === "pattern") {
    /* A row of clues counting the row above them. Every other tile is the
       clue's own colour, so nothing outside the wall enters the counts and
       the printed numbers are the pattern itself. */
    const colors = Array(16).fill(0) as number[];
    if (spec.patternKind === "121") {
      [0, 2].forEach(i => { colors[i] = 1; });
      return { size: 4, colors, unknown: [0, 1, 2], clues: [4, 5, 6].map(at => ({ at, counts: "other" as const })) };
    }
    if (spec.patternKind === "1221") {
      [1, 2].forEach(i => { colors[i] = 1; });
      return { size: 4, colors, unknown: [0, 1, 2, 3], clues: [4, 5, 6, 7].map(at => ({ at, counts: "other" as const })) };
    }
    [1, 3].forEach(i => { colors[i] = 1; });
    return { size: 4, colors, unknown: [0, 1, 2, 3], clues: [5, 6, 7].map(at => ({ at, counts: "other" as const })) };
  }
  if (spec.mode === "overlap") return { size: 4,
    colors: [1,0,1,0, 1,1,0,0, 0,1,1,0, 0,0,1,1], unknown: [2,5,7,9], clues: [3,6,10].map(at => ({ at, counts: "own" as const })) };
  if (spec.mode === "three_color") return { size: 4,
    colors: [0,1,2,2, 2,2,2,2, 2,2,2,2, 2,2,2,2], unknown: [5], clues: [0,1].map(at => ({ at, counts: "own" as const })) };
  if (spec.mode === "chain") {
    const colors = Array(spec.size ** 2).fill(1) as number[];
    [0, spec.size, 2 * spec.size, 2 * spec.size + 1].forEach(i => { colors[i] = 0; });
    return { size: spec.size, colors, unknown: [spec.size, 2 * spec.size + 1], clues: [0, 2 * spec.size].map(at => ({ at, counts: "own" as const })) };
  }
  const anchor = shuffled(Array.from({ length: 9 }, (_, i) => i).filter(i => positionKind(i, 3) === spec.anchor), rand)[0];
  const around = shuffled(neighbors(anchor, 3), rand);
  const colors = Array.from({ length: 9 }, () => rand() < 0.5 ? 0 : 1);
  colors[anchor] = 0;
  if (spec.mode === "zero" || spec.mode === "full") {
    around.forEach(i => { colors[i] = spec.mode === "zero" ? 1 : 0; });
    return { size: 3, colors, unknown: around, clues: [{ at: anchor, counts: "own" }] };
  }
  const blanks = spec.remainingCase === "one" ? 1 : 2;
  const known = spec.knownMatches ?? Math.min(spec.remainingCase === "met" ? 2 : 1, around.length - blanks);
  if (known + blanks > around.length) throw new Error("Not enough neighbor positions for known matches and blanks");
  around.forEach(i => { colors[i] = 1; });
  around.slice(blanks, blanks + known).forEach(i => { colors[i] = 0; });
  if (spec.remainingCase !== "met") around.slice(0, blanks).forEach(i => { colors[i] = 0; });
  return { size: 3, colors, unknown: around.slice(0, blanks), clues: [{ at: anchor, counts: "own" }] };
}
function transformed(t: Template, symmetry: number, palette: readonly Color[]): { board: Board; solution: Color[] } {
  const map = (i: number) => {
    let row = Math.floor(i / t.size), col = i % t.size;
    if (symmetry >= 4) col = t.size - 1 - col;
    for (let turn = 0; turn < symmetry % 4; turn++) [row, col] = [col, t.size - 1 - row];
    return row * t.size + col;
  };
  const solution = Array<Color>(t.size ** 2);
  t.colors.forEach((c, i) => { solution[map(i)] = palette[c]; });
  const unknown = new Set(t.unknown.map(map));
  const board: Board = { size: t.size, palette: [...palette], givens: solution.map((c, i) => unknown.has(i) ? null : c),
    clues: t.clues.map((c, n): Clue => {
      if ("at" in c) {
        const cell = map(c.at), color = solution[cell];
        /* "own" and "other" are shorthands; a number names the palette colour
           outright, which is the only way to say "count navy" on a board where
           three colours are in play and "other" would pick whichever came first. */
        const countedColor = typeof c.counts === "number" ? palette[c.counts]
          : c.counts === "other" ? palette.find(x => x !== color)! : color;
        return { id: `clue-${cell}`, cell, color, countedColor,
          count: neighbors(cell, t.size).filter(i => solution[i] === countedColor).length };
      }
      const countedColor = palette[c.color];
      const scope = c.scope === "board" ? { kind: "board" as const }
        : c.scope === "region" ? { kind: "region" as const, cells: c.cells.map(map) }
        : { kind: "line" as const, axis: c.scope, index: c.index };
      const over = governed({ id: "", count: 0, countedColor, scope }, t.size);
      return { id: `clue-${c.scope}-${n}`, countedColor, scope,
        ...("run" in c && c.run ? { run: c.run as "together" | "apart" } : {}),
        count: over.filter(i => solution[i] === countedColor).length };
    }) };
  return { board, solution };
}
function certify(spec: NormalSpec, candidate: { board: Board; solution: Color[] }): ProofStep[] | null {
  const { board, solution } = candidate;
  const unknown = board.givens.filter(c => c === null).length;
  if (unknown < spec.minUnknowns || unknown > spec.maxUnknowns) return null;
  if (["zero", "full", "remaining"].includes(spec.mode) && positionKind(board.clues[0].cell!, board.size) !== spec.anchor) return null;
  const result = deduce(board);
  if (spec.mode === "complement") {
    /* Deliberately under-determined: some tiles are forced and some are not,
       and the lesson is about telling which. What must hold is that the
       complement reading is what forces them — without it the board stalls
       with nothing settled at all. */
    const settled = result.domains.filter((d, i) => d.length === 1 && board.givens[i] === null).length;
    const withoutComplement = deduce(board, board.givens, { complement: false });
    const settledPlain = withoutComplement.domains.filter((d, i) => d.length === 1 && board.givens[i] === null).length;
    const unknown2 = board.givens.filter(c => c === null).length;
    if (result.status === "contradiction" || settled === 0 || settled === unknown2 || settledPlain >= settled) return null;
    if (!result.steps.some(step => step.evidence.some(e => e.derived))) return null;
    return result.steps;
  }
  if (spec.mode === "cross_color") {
    /* Partly open on purpose — a board this small cannot settle every tile —
       and only the cross-colour reading opens it at all. */
    const settled = result.domains.filter((d, i) => d.length === 1 && board.givens[i] === null).length;
    const open = board.givens.filter(c => c === null).length;
    if (result.status === "contradiction" || settled === 0 || settled === open) return null;
    if (deduce(board, board.givens, { complement: false }).steps.length) return null;
    if (!result.steps.some(step => step.evidence.some(e => e.derived))) return null;
    return result.steps;
  }
  if (result.status !== "solved" || !isSolution(board, solution) || result.domains.some((d, i) => d[0] !== solution[i])) return null;
  if (spec.mode === "run_together" || spec.mode === "run_apart") {
    /* §5 rule 7a: the condition must change the answer. Strip it and the count
       alone has to leave the line genuinely open. */
    const bare = { ...board, clues: board.clues.map(({ run, ...rest }) => rest) };
    if (enumerateSolutions(bare).status !== "multiple") return null;
  }
  if (spec.mode === "chain" && !result.steps.some(step => step.depth >= 2)) return null;
  /*
   * §5 rule 6, for the two techniques that have a rule to remove.
   *
   * A board is re-solved with subset reduction switched off. If it still
   * finishes, the lesson's technique was never needed and the board teaches
   * something else under its name.
   */
  if ((spec.mode === "overlap" || spec.mode === "pattern")
    && (deduce(board, board.givens, { overlap: false }).status === "solved" || !result.steps.some(step => step.rule.startsWith("overlap")))) return null;
  if (spec.mode === "pattern" && !board.clues.every(c => c.countedColor !== c.color)) return null;
  if (spec.mode === "totals" && !board.clues.filter(c => c.scope?.kind === "board").length) return null;
  if (spec.mode === "mixed") {
    /* At least three kinds on the board, and at least two of them used. The
       first is a promise about the picture; the second is about the reasoning. */
    const kinds = new Set(board.clues.map(c => c.scope?.kind ?? "neighborhood"));
    if (kinds.size < 3) return null;
    const used = new Set(result.steps.flatMap(s => s.evidence)
      .map(e => board.clues.find(c => c.id === e.clueId)?.scope?.kind ?? "neighborhood"));
    if (used.size < 2) return null;
  }
  if (spec.mode === "three_color" && !result.steps.some(step => step.changes.some(c => c.before.length === 3 && c.after.length === 2))) return null;
  const independent = enumerateSolutions(board);
  if (independent.status !== "unique" || independent.solutions[0].some((c, i) => c !== solution[i])) return null;
  return result.steps;
}
/**
 * Technique-directed templates, seeded positions/filler, eight symmetries and color
 * permutations. Finite replay space is intentional; no claim of infinite puzzle variety.
 * Each draw and fallback passes exactly the same visible-evidence certification.
 */
export function generatePuzzle(specification: PuzzleSpec, seed: number, options: { seen?: Set<string>; maxAttempts?: number } = {}): Puzzle {
  if (!Number.isSafeInteger(seed)) throw new Error("Seed must be a safe integer");
  const spec = normalize(specification), limit = options.maxAttempts ?? SEARCH_ATTEMPTS;
  if (!Number.isInteger(limit) || limit < 0 || limit > 64) throw new Error("Attempt budget must be an integer from 0 to 64");
  const rand = random(seed), seen = options.seen ?? new Set<string>();
  let repeated: Puzzle | undefined;
  const accept = (candidate: ReturnType<typeof transformed>, source: "seeded" | "fallback", attempts: number): Puzzle | undefined => {
    const proof = certify(spec, candidate);
    if (!proof) return undefined;
    const id = boardKey(candidate.board);
    const puzzle: Puzzle = { id, seed, mode: spec.mode, ...candidate, proof, expected: answerKey(candidate.board, candidate.solution), generation: { source, attempts, repeated: seen.has(id) } };
    if (seen.has(id)) { repeated ??= puzzle; return undefined; }
    seen.add(id); return puzzle;
  };
  for (let attempt = 0; attempt < limit; attempt++) {
    const draft = template(spec, rand);
    const found = accept(transformed(draft, draft.fixed ? 0 : Math.floor(rand() * 8), shuffled(spec.palette, rand)), "seeded", attempt + 1);
    if (found) return found;
  }
  // Exhaust a finite fallback catalog. Never relax shape, palette, anchor, or technique.
  const fallback = template(spec, random(0));
  const permutations = spec.palette.length === 2 ? [spec.palette, [...spec.palette].reverse()] :
    spec.palette.flatMap(a => spec.palette.filter(b => b !== a).map(b => [a, b, spec.palette.find(c => c !== a && c !== b)!]));
  for (let symmetry = 0; symmetry < (fallback.fixed ? 1 : 8); symmetry++) for (const palette of permutations) {
    const found = accept(transformed(fallback, symmetry, palette), "fallback", limit);
    if (found) return found;
  }
  if (repeated) return repeated;
  throw new Error(`No ${spec.mode} puzzle satisfies the declared constraints`);
}
