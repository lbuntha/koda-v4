import { canPour, isPointless, legalPours, pour, signature } from "./pour";
import { rackFor, rng } from "./racks";
import type { RackSpec } from "./types";
import { topRun, type Pour, type Rack } from "./types";

/**
 * "What does the rack look like after this pour?"
 *
 * The engine for lessons 23 and 24, kept pure for the same reason the rules
 * are: the distractors are the pedagogy here, and they have to be checkable
 * without a browser. A wrong answer a child would never pick teaches nothing —
 * four racks where three are obviously impossible is a spot-the-odd-one-out,
 * not a prediction. So each distractor is a *misconception*, applied properly:
 * moving one segment instead of the run, stopping after the first pour, pouring
 * the wrong way round. Each is a rack the child could genuinely have expected.
 */
export interface Prediction {
  /** The rack as dealt, which the child reads before choosing. */
  start: Rack;
  /** The pour, or pours, to imagine. */
  moves: Pour[];
  /** Four candidate results, in the order they are shown. */
  choices: Rack[];
  /** Index into `choices` of the one that is right. */
  answer: number;
  hues: number[];
}

/** Applies every move in order. */
const applyAll = (rack: Rack, moves: Pour[]): Rack =>
  moves.reduce((r, m) => pour(r, m.from, m.to), rack);

/**
 * Moves one segment, checking only that there is one to move and room to put
 * it, not that the colours match.
 *
 * Used to fill out a set of candidates when a tidy rack cannot produce three
 * distinct mistakes from legal pours alone. A mismatched stack is a perfectly
 * plausible thing to show: every dealt rack in this skill is full of them.
 */
function moveOne(rack: Rack, from: number, to: number): Rack {
  if (!rack[from]?.seg.length || rack[to].seg.length >= rack[to].cap) return rack;
  return shiftOne(rack, from, to);
}

/** Moves a single segment, however long the run is: the commonest mistake. */
function pourOne(rack: Rack, from: number, to: number): Rack {
  if (!canPour(rack, from, to)) return rack;
  return shiftOne(rack, from, to);
}

function shiftOne(rack: Rack, from: number, to: number): Rack {
  const next = rack.map((b) => ({ ...b, seg: [...b.seg] }));
  next[to].seg.push(next[from].seg.pop() as number);
  if (next[from].shown !== undefined) next[from].shown = Math.max(next[from].seg.length ? 1 : 0, next[from].shown - 1);
  if (next[to].shown !== undefined) next[to].shown = Math.min(next[to].seg.length, next[to].shown + 1);
  return next;
}

/** Empties the source rather than moving only its top run. */
function pourEverything(rack: Rack, from: number, to: number): Rack {
  if (!canPour(rack, from, to)) return rack;
  const next = rack.map((b) => ({ ...b, seg: [...b.seg] }));
  const room = next[to].cap - next[to].seg.length;
  const moved = Math.min(next[from].seg.length, room);
  for (let i = 0; i < moved; i += 1) next[to].seg.push(next[from].seg.pop() as number);
  if (next[from].shown !== undefined) next[from].shown = next[from].seg.length ? 1 : 0;
  if (next[to].shown !== undefined) next[to].shown = next[to].seg.length;
  return next;
}

/**
 * The pours to ask about.
 *
 * A move that finishes the rack, or that moves nothing, makes a poor question,
 * so both are skipped. For a two-step question the second is chosen from what
 * the first leaves behind — otherwise the child is asked to imagine a pour that
 * the first pour has already made illegal.
 */
function chooseMoves(rack: Rack, steps: 1 | 2, next: () => number): Pour[] {
  const worthwhile = (r: Rack) =>
    legalPours(r).filter((m) => !isPointless(r, m.from, m.to) && topRun(r[m.from]).n > 0);

  const first = worthwhile(rack);
  if (!first.length) return [];
  const one = first[Math.floor(next() * first.length)];
  if (steps === 1) return [one];

  const after = pour(rack, one.from, one.to);
  const second = worthwhile(after);
  if (!second.length) return [one];
  return [one, second[Math.floor(next() * second.length)]];
}

export function buildPrediction(
  spec: RackSpec,
  seed: string,
  index: number,
  steps: 1 | 2,
): Prediction {
  const { rack, hues } = rackFor(spec, seed, index);
  const next = rng(`${seed}:predict:${spec.id}:${index}`);
  const moves = chooseMoves(rack, steps, next);
  const correct = applyAll(rack, moves);

  // Candidates in the order they are tried. The first three that differ from
  // the answer and from each other are the ones shown; the rack unchanged is
  // the last resort, and is always different because a chosen move always moves
  // something.
  const candidates: Rack[] = [
    moves.reduce((r, m) => pourOne(r, m.from, m.to), rack),
    steps === 2 && moves.length === 2 ? pour(rack, moves[0].from, moves[0].to)
      : pourEverything(rack, moves[0].from, moves[0].to),
    applyAll(rack, moves.map((m) => ({ from: m.to, to: m.from }))),
    pourEverything(rack, moves[0].from, moves[0].to),
    rack,
  ];

  const seen = new Set([signature(correct)]);
  const wrong: Rack[] = [];
  for (const candidate of candidates) {
    if (wrong.length === 3) break;
    const key = signature(candidate);
    if (seen.has(key)) continue;
    seen.add(key);
    wrong.push(candidate);
  }

  // A rack too tidy to produce three distinct mistakes still has to ask four
  // questions, so the shortfall is made up by nudging a segment somewhere else.
  let spare = 0;
  while (wrong.length < 3 && spare < rack.length * rack.length) {
    const from = spare % rack.length;
    const to = Math.floor(spare / rack.length);
    spare += 1;
    if (from === to) continue;
    const candidate = moveOne(rack, from, to);
    if (candidate === rack) continue;
    const key = signature(candidate);
    if (seen.has(key)) continue;
    seen.add(key);
    wrong.push(candidate);
  }

  // Shuffled, because a right answer that is always in the same place is a
  // button position to learn rather than a rack to read.
  const choices = [correct, ...wrong];
  for (let i = choices.length - 1; i > 0; i -= 1) {
    const j = Math.floor(next() * (i + 1));
    [choices[i], choices[j]] = [choices[j], choices[i]];
  }

  return { start: rack, moves, choices, answer: choices.indexOf(correct), hues };
}
