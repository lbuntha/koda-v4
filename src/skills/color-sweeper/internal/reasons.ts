import { counted, governed, type Assignment, type Board, type Clue, type Color } from "./board";
import { deduce, type ProofStep } from "./deduction";
import { PALETTE } from "./palette";
import { generatePuzzle, type BoardMode } from "./puzzles";

/**
 * Questions about reasoning, rather than about a board.
 *
 * Three things a child can do with a deduction besides make it: say which
 * clues were enough to force it, say why, and find the clue somebody else
 * broke. None of them is answered from a stored key — sufficiency is checked
 * by re-solving with only the chosen clues, and a violated clue is found by
 * recounting the board as it was painted.
 */

export const LAB_MODES = ["compare_clues", "choose_reason", "find_error"] as const;
export type LabMode = typeof LAB_MODES[number];

export interface LabOption {
  id: string;
  text: string;
  correct: boolean;
  /** `compare_clues`: the clues this option offers as evidence. */
  clueIds?: readonly string[];
  /** Which misconception a wrong option embodies, for the feedback. */
  trap?: "counts-itself" | "wrong-color" | "skips-diagonals" | "not-enough" | "unrelated";
}

export interface Lab {
  id: string;
  seed: number;
  mode: LabMode;
  board: Board;
  /** `find_error`: the board as somebody painted it, mistake included. */
  assignment?: Assignment;
  /** The tile being talked about. */
  target?: number;
  options?: readonly LabOption[];
  /** `find_error`: every clue the painted board actually breaks. */
  violated?: readonly string[];
  expected: string;
  generation: { attempts: number; repeated: boolean };
}

function random(seed: number): () => number {
  let state = seed >>> 0;
  return () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
}
function shuffled<T>(items: readonly T[], rand: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [copy[i], copy[j]] = [copy[j], copy[i]]; }
  return copy;
}

/** A sentence that begins with a clue's name still begins with a capital. */
const sentence = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);

const where = (board: Board, cell: number) =>
  `row ${Math.floor(cell / board.size) + 1}, column ${(cell % board.size) + 1}`;

/** How a clue is referred to in a sentence. */
export function clueName(board: Board, clue: Clue): string {
  const colour = PALETTE[counted(clue)].name.toLowerCase();
  const scope = clue.scope?.kind ?? "neighborhood";
  if (scope === "neighborhood") return `the ${colour} ${clue.count} at ${where(board, clue.cell!)}`;
  if (scope === "board") return `the board total of ${clue.count} ${colour}`;
  if (scope === "region") return `the outlined area's ${clue.count} ${colour}`;
  const line = clue.scope as { axis: "row" | "column"; index: number };
  return `${line.axis === "row" ? "row" : "column"} ${line.index + 1}'s ${clue.count} ${colour}`;
}

/**
 * Whether a set of clues is enough, on its own, to force a tile.
 *
 * The whole judgement for `compare_clues`, and it is a re-solve rather than a
 * comparison with a stored answer: a child who names a set nobody expected is
 * right if their set works.
 */
export function forces(board: Board, clueIds: readonly string[], cell: number): boolean {
  const only: Board = { ...board, clues: board.clues.filter((c) => clueIds.includes(c.id)) };
  const result = deduce(only);
  return result.status !== "contradiction" && result.domains[cell].length === 1;
}

/** The words for a step, and an equally true way of saying the same thing. */
function reasonsFor(board: Board, step: ProofStep, cell: number): [string, string] {
  const colour = PALETTE[step.color].name.toLowerCase();
  const clue = board.clues.find((c) => c.id === step.evidence[0].clueId)!;
  const name = clueName(board, clue);
  const other = board.palette.filter((c) => c !== step.color).map((c) => PALETTE[c].name.toLowerCase()).join(" or ");
  switch (step.rule) {
    case "zero":
      return [`${name} allows no ${colour} at all, so this tile cannot be ${colour}.`,
        `Nothing ${name} touches is ${colour}, and this tile touches it.`];
    case "full":
      return [`${name} needs every tile it touches, so this one is ${colour}.`,
        `There are exactly as many tiles as ${name} needs, so none of them can be ${other}.`];
    case "remaining-exclude":
      return [`${name} already has all the ${colour} it needs, so this tile is not ${colour}.`,
        `Counting the ${colour} already around ${name} reaches its number, leaving none for this tile.`];
    case "remaining-fill":
      return [`${name} still needs more ${colour}, and this is one of the only tiles left for it.`,
        `Take the ${colour} already found away from ${name}, and what is missing exactly fills the spaces left.`];
    case "overlap-exclude":
      return [`Comparing ${name} with the other clue over the same tiles accounts for all its ${colour}, so this tile has none left.`,
        `The tiles the two clues share already carry every ${colour} ${name} allows.`];
    case "overlap-fill":
      return [`Comparing ${name} with the other clue leaves this tile as the one that must be ${colour}.`,
        `Subtracting the smaller clue from the larger one leaves ${colour} with nowhere else to go.`];
    case "run":
      return [`Every arrangement ${name} still allows puts ${colour} here.`,
        `Ruling out the arrangements ${name} forbids leaves only ones where this tile is ${colour}.`];
  }
}

/** Wrong reasons, each one a misconception a child actually holds. */
function wrongReasons(board: Board, step: ProofStep): LabOption[] {
  const colour = PALETTE[step.color].name.toLowerCase();
  const clue = board.clues.find((c) => c.id === step.evidence[0].clueId)!;
  const name = clueName(board, clue);
  const options: LabOption[] = [
    { id: "w-self", correct: false, trap: "counts-itself",
      text: `${name} counts itself as well, and that is what settles this tile.` },
    { id: "w-color", correct: false, trap: "wrong-color",
      text: `${name} is about how many tiles are ${colour} somewhere on the board.` },
  ];
  if ((clue.scope?.kind ?? "neighborhood") === "neighborhood") {
    options.push({ id: "w-diag", correct: false, trap: "skips-diagonals",
      text: `${name} counts only the tiles beside it, not the corners.` });
  } else {
    options.push({ id: "w-near", correct: false, trap: "unrelated",
      text: `${name} counts the tiles nearest to it.` });
  }
  return options;
}

interface LabSpec { mode: LabMode; source?: BoardMode; palette?: readonly Color[] }

function buildOnce(spec: LabSpec, seed: number, attempt: number): Lab | null {
  const source: BoardMode = spec.source ?? (spec.mode === "compare_clues" ? "overlap" : "remaining");
  const puzzle = generatePuzzle({ mode: source, palette: spec.palette }, seed + attempt * 7919, { maxAttempts: 8 });
  const { board } = puzzle;
  const rand = random(seed + attempt * 104729);
  const result = deduce(board);
  const id = `lab-${spec.mode}-${seed}-${attempt}`;

  if (spec.mode === "find_error") {
    /* Somebody's finished board with one tile the wrong colour. Which clue it
       breaks is found by recounting, not by remembering which tile was moved:
       one wrong tile can break more than one clue, and every one of them is a
       correct answer. */
    const blanks = board.givens.flatMap((c, i) => (c === null ? [i] : []));
    const spoiled = blanks[Math.floor(rand() * blanks.length)];
    const painted = [...puzzle.solution] as Color[];
    painted[spoiled] = board.palette.find((c) => c !== painted[spoiled])!;
    const broken = deduce(board, painted).violatedClueIds;
    const onBoard = broken.filter((clueId) => board.clues.find((c) => c.id === clueId)?.cell !== undefined);
    if (!onBoard.length) return null;
    return { id, seed, mode: spec.mode, board, assignment: painted, violated: onBoard,
      expected: onBoard.map((clueId) => clueName(board, board.clues.find((c) => c.id === clueId)!)).join(" / "),
      generation: { attempts: attempt + 1, repeated: false } };
  }

  const step = result.steps.find((s) => s.changes.some((c) => c.after.length === 1));
  if (!step) return null;
  const target = step.changes.find((c) => c.after.length === 1)!.cell;

  if (spec.mode === "choose_reason") {
    const [first, second] = reasonsFor(board, step, target);
    /* Two true statements of the same reason, both accepted. A child who says
       it their own way has not made a different move. */
    const options = shuffled([
      { id: "r-a", text: first, correct: true },
      { id: "r-b", text: second, correct: true },
      ...shuffled(wrongReasons(board, step), rand).slice(0, 2),
    ], rand).map((o) => ({ ...o, text: sentence(o.text) }));
    return { id, seed, mode: spec.mode, board, target, options,
      expected: sentence(first), generation: { attempts: attempt + 1, repeated: false } };
  }

  /* compare_clues: which clues were enough. */
  const enough = [...new Set(step.evidence.map((e) => e.clueId))]
    .filter((clueId) => board.clues.some((c) => c.id === clueId));
  if (!enough.length || !forces(board, enough, target)) return null;
  const others = board.clues.map((c) => c.id).filter((clueId) => !enough.includes(clueId));
  const candidates: LabOption[] = [
    { id: "s-all", clueIds: enough, correct: true, text: enough.map((clueId) => clueName(board, board.clues.find((c) => c.id === clueId)!)).join(" and ") },
    ...enough.slice(0, 2).map((clueId, n) => ({ id: `s-one-${n}`, clueIds: [clueId], correct: false,
      trap: "not-enough" as const, text: clueName(board, board.clues.find((c) => c.id === clueId)!) })),
    ...others.slice(0, 1).map((clueId, n) => ({ id: `s-other-${n}`, clueIds: [clueId], correct: false,
      trap: "unrelated" as const, text: clueName(board, board.clues.find((c) => c.id === clueId)!) })),
  ];
  /* A distractor that happens to be sufficient is not a distractor. Judged by
     the same re-solve the child's answer is judged by. */
  const options = candidates.map((o) => ({ ...o, text: sentence(o.text), correct: forces(board, o.clueIds!, target) }));
  if (options.filter((o) => o.correct).length !== 1 || options.length < 3) return null;
  return { id, seed, mode: spec.mode, board, target, options: shuffled(options, rand),
    expected: options.find((o) => o.correct)!.text, generation: { attempts: attempt + 1, repeated: false } };
}

export const labKey = (lab: Lab): string => `${lab.mode}:${lab.board.givens.join("")}:${lab.target ?? ""}:${lab.assignment?.join("") ?? ""}`;

export function generateLab(spec: LabSpec, seed: number, options: { seen?: Set<string>; maxAttempts?: number } = {}): Lab {
  if (!Number.isSafeInteger(seed)) throw new Error("Seed must be a safe integer");
  if (!LAB_MODES.includes(spec.mode)) throw new Error("Unsupported Color Sweeper reasoning mode");
  const seen = options.seen ?? new Set<string>();
  const attempts = options.maxAttempts ?? 40;
  let last: Lab | undefined;
  for (let attempt = 0; attempt < attempts; attempt++) {
    const lab = buildOnce(spec, seed, attempt);
    if (!lab) continue;
    const key = labKey(lab);
    last = { ...lab, generation: { attempts: attempt + 1, repeated: seen.has(key) } };
    if (!seen.has(key)) { seen.add(key); return last; }
  }
  if (last) return last;
  throw new Error(`No ${spec.mode} question satisfies the declared constraints`);
}
