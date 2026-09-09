import {
  neighbors,
  positionKind,
  selectionKey,
  validateBoard,
  type Board,
  type BoardSize,
  type Clue,
  type Color,
  type PositionKind,
} from "./board";
import { PALETTE } from "./palette";

/**
 * Questions about reading a board, before anything is painted.
 *
 * The five foundation levels ask what a neighbourhood *is*, what a clue *says*,
 * and what it says about the colour it does not name. None of them is a
 * deduction, so none of them goes through `deduce` or `enumerateSolutions` —
 * those answer "what must this tile be", and nothing here has a tile to decide.
 *
 * Two of the four modes deliberately leave every tile but one blank. A clue's
 * meaning is not something a child should be able to reach by counting the
 * picture: if the neighbours were coloured, level 4 could be answered without
 * reading the clue at all, and level 5 without noticing there is a second
 * colour to count.
 */

export const LENS_MODES = ["select_neighbors", "count_same", "read_clue", "complement"] as const;
export type LensMode = typeof LENS_MODES[number];

const KINDS: readonly PositionKind[] = ["corner", "edge", "center"];

export interface LensSpec {
  mode: LensMode;
  size?: BoardSize;
  /**
   * Board sizes to draw from, when one is not enough to vary the question.
   *
   * A 3x3 board has exactly one centre cell, so a lesson anchored to the
   * centre asks the same question five times with the decoration reshuffled.
   * Drawing the size as well as the position is what gives that lesson more
   * than one board — a middle tile touches eight whatever the board's size,
   * which is the point the lesson is making.
   */
  sizes?: readonly BoardSize[];
  palette?: readonly Color[];
  /** Which positions the question's tile may sit at. Drawn from, in order shuffled. */
  anchors?: readonly PositionKind[];
  /** `count_same` only: keep the answer inside a band, so a level stays countable. */
  minSame?: number;
  maxSame?: number;
}

/** One option in `read_clue`. `trap` names the misconception it embodies. */
export interface Statement {
  id: string;
  text: string;
  correct: boolean;
  trap?: "counts-itself" | "wrong-color" | "skips-diagonals";
}

export interface Lens {
  id: string;
  seed: number;
  mode: LensMode;
  board: Board;
  /** The tile the question is about: outlined, or carrying the clue. */
  target: number;
  neighborhood: readonly number[];
  anchor: PositionKind;
  /** `select_neighbors`: the exact set of tiles that touch the target. */
  expectedCells?: readonly number[];
  /** `count_same` and `complement`: the number asked for. */
  expectedCount?: number;
  /** Number buttons offered, including the answer. */
  choices?: readonly number[];
  /** `read_clue`: the statements to choose between. */
  statements?: readonly Statement[];
  /** `read_clue` and `complement`. */
  clue?: Clue;
  /** `complement`: the colour the answer counts, which the clue does not name. */
  otherColor?: Color;
  /** Canonical answer text for the learning log. */
  expected: string;
  generation: { attempts: number; repeated: boolean };
}

function random(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function shuffled<T>(items: readonly T[], rand: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

const pick = <T,>(items: readonly T[], rand: () => number): T => items[Math.floor(rand() * items.length)];

interface NormalSpec {
  mode: LensMode;
  sizes: readonly BoardSize[];
  palette: readonly Color[];
  anchors: readonly PositionKind[];
  minSame: number;
  maxSame: number;
}

/**
 * The smallest neighbourhood any allowed anchor has.
 *
 * A `count_same` band is checked against this rather than against the target
 * actually drawn, because a level allowing corners *and* edges would otherwise
 * throw on some seeds and pass on others — the kind of failure that reaches a
 * child rather than a test run.
 */
const smallestNeighborhood = (anchors: readonly PositionKind[]): number =>
  Math.min(...anchors.map((kind) => (kind === "corner" ? 3 : kind === "edge" ? 5 : 8)));

function normalize(spec: LensSpec): NormalSpec {
  if (!LENS_MODES.includes(spec.mode)) throw new Error("Unsupported Color Sweeper reading mode");
  const sizes = spec.sizes ?? [spec.size ?? 3];
  if (!sizes.length) throw new Error("A lesson needs at least one board size");
  const palette = spec.palette ?? ["orange", "navy"];
  /* Borrows the board contract's own size and palette rules rather than
     restating them: an unsupported size throws here rather than at render. */
  for (const size of sizes) {
    validateBoard({ size, palette, givens: Array(size * size).fill(null), clues: [] });
  }
  if (spec.mode === "complement" && palette.length !== 2) {
    // "The rest are navy" is a single number only while there is one other
    // colour. With three in play the complement is a pair, and a mode that
    // answered anyway would be confidently wrong.
    throw new Error("complement needs a two-color palette");
  }
  const anchors = spec.anchors ?? KINDS;
  if (!anchors.length || anchors.some((kind) => !KINDS.includes(kind))) throw new Error("Unknown board position");
  const room = smallestNeighborhood(anchors);
  const minSame = spec.minSame ?? 0;
  const maxSame = spec.maxSame ?? room;
  if (!Number.isInteger(minSame) || !Number.isInteger(maxSame) || minSame < 0 || minSame > maxSame) {
    throw new Error("Invalid matching-neighbour range");
  }
  if (maxSame > room) throw new Error(`A ${anchors.join("/")} tile touches at most ${room} tiles`);
  return { mode: spec.mode, sizes, palette, anchors, minSame, maxSame };
}

const cellsOfKind = (size: BoardSize, kind: PositionKind): number[] =>
  Array.from({ length: size * size }, (_, i) => i).filter((i) => positionKind(i, size) === kind);

/** Four distinct counts including the answer, inside what this neighbourhood allows. */
function countChoices(answer: number, room: number, rand: () => number): number[] {
  const near = [answer - 1, answer + 1, answer - 2, answer + 2, answer + 3, answer - 3]
    .filter((n) => n >= 0 && n <= room && n !== answer);
  const wanted = Math.min(4, room + 1);
  const chosen = [answer, ...near.slice(0, wanted - 1)];
  return shuffled(chosen, rand);
}

function buildOnce(spec: NormalSpec, rand: () => number, seed: number): Lens {
  const size = pick(spec.sizes, rand);
  const anchor = pick(spec.anchors, rand);
  const target = pick(cellsOfKind(size, anchor), rand);
  const around = neighbors(target, size);
  const [first, second] = spec.palette;
  const cells = size * size;

  if (spec.mode === "select_neighbors" || spec.mode === "count_same") {
    /* Both modes show a finished board. The difference is what is asked of it,
       which is why they share a builder rather than looking like two puzzles. */
    const same = spec.mode === "count_same"
      ? Math.min(around.length, spec.minSame + Math.floor(rand() * (Math.min(spec.maxSame, around.length) - spec.minSame + 1)))
      : undefined;
    const givens: (Color | null)[] = Array.from({ length: cells }, () => pick(spec.palette, rand));
    givens[target] = first;
    if (same !== undefined) {
      const matching = new Set(shuffled(around, rand).slice(0, same));
      for (const i of around) {
        givens[i] = matching.has(i) ? first : pick(spec.palette.filter((c) => c !== first), rand);
      }
    }
    const board: Board = { size, palette: spec.palette, givens, clues: [] };
    validateBoard(board);
    return {
      id: `lens-${spec.mode}-${seed}-${size}-${target}`,
      seed,
      mode: spec.mode,
      board,
      target,
      neighborhood: around,
      anchor,
      expectedCells: spec.mode === "select_neighbors" ? around : undefined,
      expectedCount: same,
      choices: same === undefined ? undefined : countChoices(same, around.length, rand),
      expected: spec.mode === "select_neighbors" ? selectionKey(around, size) : String(same),
      generation: { attempts: 1, repeated: false },
    };
  }

  /* `read_clue` and `complement` show one clue and nothing else. Every other
     tile stays blank on purpose: a countable board answers both questions
     without reading the clue, which is the one thing these levels teach. */
  const count = spec.mode === "complement"
    ? Math.floor(rand() * (around.length + 1))
    : 1 + Math.floor(rand() * (around.length - 1));
  const givens: (Color | null)[] = Array.from({ length: cells }, () => null);
  givens[target] = first;
  const clue: Clue = { id: `c${target}`, cell: target, color: first, count };
  const board: Board = { size, palette: spec.palette, givens, clues: [clue] };
  validateBoard(board);
  const name = PALETTE[first].name.toLowerCase();

  if (spec.mode === "complement") {
    const answer = around.length - count;
    return {
      id: `lens-complement-${seed}-${size}-${target}-${count}`,
      seed,
      mode: "complement",
      board,
      target,
      neighborhood: around,
      anchor,
      clue,
      otherColor: second,
      expectedCount: answer,
      choices: countChoices(answer, around.length, rand),
      expected: String(answer),
      generation: { attempts: 1, repeated: false },
    };
  }

  const other = PALETTE[second].name.toLowerCase();
  const statements: Statement[] = shuffled(
    [
      { id: "s-correct", text: `${count} of the ${around.length} tiles touching it are ${name}.`, correct: true },
      { id: "s-self", text: `${count} tiles, counting this one, are ${name}.`, correct: false, trap: "counts-itself" as const },
      { id: "s-color", text: `${count} of the tiles touching it are ${other}.`, correct: false, trap: "wrong-color" as const },
      { id: "s-diagonal", text: `${count} tiles beside it, not counting corners, are ${name}.`, correct: false, trap: "skips-diagonals" as const },
    ],
    rand,
  );
  return {
    id: `lens-read_clue-${seed}-${size}-${target}-${count}`,
    seed,
    mode: "read_clue",
    board,
    target,
    neighborhood: around,
    anchor,
    clue,
    statements,
    expected: statements.find((s) => s.correct)!.text,
    generation: { attempts: 1, repeated: false },
  };
}

/**
 * What makes two questions the same question, for a round's `seen` set.
 *
 * What determines the answer, and nothing else. Keying on the painted board
 * looked thorough and was wrong: in `select_neighbors` the colours are pure
 * decoration, so re-colouring the same target produced a board the set called
 * new and a child called identical — which is how level 1 shipped as one
 * question asked five times.
 */
export const lensKey = (lens: Lens): string => {
  const where = `${lens.mode}:${lens.board.size}:${lens.target}`;
  switch (lens.mode) {
    /* Which tiles touch this one. Colour changes nothing about the answer. */
    case "select_neighbors": return where;
    /* The same target with the same count is the same exercise, however the
       matching tiles are arranged around it. */
    case "count_same": return `${where}:${lens.expectedCount}`;
    default: return `${where}:${lens.clue!.count}`;
  }
};

/**
 * One reading question.
 *
 * Seeded rather than random so a failure can be reproduced from its id alone.
 * A tiny question space — a corner target on a 3×3 board has three tiles and
 * four counts — genuinely runs out, so exhausting `seen` returns a repeat
 * instead of throwing. That is the honest outcome: there is no ninth distinct
 * corner question to find.
 */
export function generateLens(
  specification: LensSpec,
  seed: number,
  options: { seen?: Set<string>; maxAttempts?: number } = {},
): Lens {
  if (!Number.isSafeInteger(seed)) throw new Error("Seed must be a safe integer");
  const spec = normalize(specification);
  const seen = options.seen ?? new Set<string>();
  const attempts = options.maxAttempts ?? 24;
  if (!Number.isInteger(attempts) || attempts < 1) throw new Error("maxAttempts must be a positive integer");
  let last: Lens | undefined;
  for (let attempt = 0; attempt < attempts; attempt++) {
    const lens = buildOnce(spec, random(seed + attempt * 7919), seed);
    const key = lensKey(lens);
    last = { ...lens, generation: { attempts: attempt + 1, repeated: seen.has(key) } };
    if (!seen.has(key)) {
      seen.add(key);
      return last;
    }
  }
  /* Every distinct question this specification can pose has been asked. */
  return last!;
}
