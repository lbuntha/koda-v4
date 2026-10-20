/**
 * What every math question set is built from.
 *
 * A question is written once as English and Khmer text plus its answer. The
 * answer is always worked out by the generator from the numbers it picked,
 * never typed, so a set cannot disagree with itself. Numbers are written
 * with plain digits in both languages: the player shows them as Khmer
 * numerals in Khmer (see `localize.ts`).
 *
 * Questions are read in under a minute: one short line, one step for the
 * youngest and no more than a few for the oldest, one answer.
 */

import type { AgeRange } from "../../../lib/ages";
import { ICON_PREFIX } from "../../icons/library";
import { makeRng, shuffled, type Rng } from "../../rng";
import type { Difficulty, Piece, Puzzle } from "../../types";

export type Grade = 1 | 2 | 3 | 4 | 5 | 6;

/** Grade N is for children of N + 5 and N + 6. */
export const agesOf = (grade: Grade): AgeRange => [grade + 5, grade + 6];

export interface Q {
  grade: Grade;
  /** The id's tail: made from the numbers, so it never changes when the list around it does. */
  key: string;
  en: string;
  km: string;
  /** What is typed, or (with `options`) the tapped option's text. */
  answer: string;
  whyEn: string;
  whyKm: string;
  /** Drawings shown above the question. */
  pics?: Piece[];
  /** Two to four neutral answers (numbers, times): a tap-an-answer question. */
  options?: string[];
  d?: Difficulty;
  accepts?: string[];
}

const word = (text: string): Piece => ({ kind: "word", text });

export const pic = (drawing: string, name: string = drawing): Piece => ({ kind: "icon", id: ICON_PREFIX + drawing, name });
export const plus: Piece = { kind: "op", op: "+" };
export const minus: Piece = { kind: "op", op: "-" };
/** `n` copies of one drawing, for counting. */
export const many = (drawing: string, n: number, name: string = drawing): Piece[] => Array.from({ length: n }, () => pic(drawing, name));

export const build = (q: Q): Puzzle => {
  const id = `mq-g${q.grade}-${q.key}`;
  const choice = q.options ? { options: q.options, correct: q.options.indexOf(q.answer) } : undefined;
  // A long row of pictures (counting, shapes) is drawn small so it stays one glance.
  const all = q.pics ?? [];
  const icons = all.filter((p) => p.kind === "icon").length;
  // One drawing with detail to read (a clock, a thermometer, an angle) is drawn big; a long row (counting, shapes) small, so it stays one glance.
  const pics = icons === 1 ? all.map((p): Piece => (p.kind === "icon" ? { ...p, scale: "big" } : p)) : icons > 6 ? all.map((p): Piece => (p.kind === "icon" ? { ...p, scale: "small" } : p)) : all;
  return {
    id,
    category: "math",
    ages: agesOf(q.grade),
    difficulty: q.d ?? (q.grade <= 2 ? 1 : q.grade <= 4 ? 2 : 3),
    trick: "compound",
    kind: choice ? "choice" : "quiz",
    ...(choice ? { choice } : {}),
    pieces: [...pics, word(q.en)],
    km: { pieces: [...pics, word(q.km)], explanation: q.whyKm },
    answer: q.answer,
    accepts: q.accepts ?? [],
    explanation: q.whyEn,
    source: "official",
  };
};

// ---- who and what the stories are about -----------------------------------------

export const NAMES: ReadonlyArray<{ en: string; km: string }> = [
  { en: "Sok", km: "សុខ" },
  { en: "Dara", km: "ដារ៉ា" },
  { en: "Sophea", km: "សុភា" },
  { en: "Vanna", km: "វណ្ណា" },
  { en: "Rith", km: "រិទ្ធ" },
  { en: "Chenda", km: "ចិន្តា" },
  { en: "Bopha", km: "បុប្ផា" },
  { en: "Kosal", km: "កុសល" },
];

export interface Thing {
  /** The drawing. */
  icon: string;
  one: string;
  many: string;
  km: string;
  /** What Khmer counts it in (ផ្លែ for fruit, ក្បាល for animals). May be empty. */
  cls: string;
  kind: "food" | "animal" | "object";
  /** For animals: what they do to leave and arrive, in English and Khmer. */
  leaveEn?: string;
  leaveKm?: string;
}

export const THINGS: readonly Thing[] = [
  { icon: "apple", one: "apple", many: "apples", km: "ផ្លែប៉ោម", cls: "ផ្លែ", kind: "food" },
  { icon: "banana", one: "banana", many: "bananas", km: "ចេក", cls: "ផ្លែ", kind: "food" },
  { icon: "orange", one: "orange", many: "oranges", km: "ក្រូច", cls: "ផ្លែ", kind: "food" },
  { icon: "pear", one: "pear", many: "pears", km: "ផ្លែពែរ", cls: "ផ្លែ", kind: "food" },
  { icon: "cookie", one: "cookie", many: "cookies", km: "នំ", cls: "ដុំ", kind: "food" },
  { icon: "egg", one: "egg", many: "eggs", km: "ស៊ុត", cls: "គ្រាប់", kind: "food" },
  { icon: "candy", one: "sweet", many: "sweets", km: "ស្ករគ្រាប់", cls: "គ្រាប់", kind: "food" },
  { icon: "pencil", one: "pencil", many: "pencils", km: "ខ្មៅដៃ", cls: "ដើម", kind: "object" },
  { icon: "book", one: "book", many: "books", km: "សៀវភៅ", cls: "ក្បាល", kind: "object" },
  { icon: "ball", one: "ball", many: "balls", km: "បាល់", cls: "គ្រាប់", kind: "object" },
  { icon: "flower", one: "flower", many: "flowers", km: "ផ្កា", cls: "ទង", kind: "object" },
  { icon: "star", one: "star", many: "stars", km: "ផ្កាយ", cls: "", kind: "object" },
  { icon: "duck", one: "duck", many: "ducks", km: "ទា", cls: "ក្បាល", kind: "animal", leaveEn: "swim away", leaveKm: "ហែលចេញទៅ" },
  { icon: "bird", one: "bird", many: "birds", km: "សត្វស្លាប", cls: "ក្បាល", kind: "animal", leaveEn: "fly away", leaveKm: "ហើរចេញទៅ" },
  { icon: "frog", one: "frog", many: "frogs", km: "កង្កែប", cls: "ក្បាល", kind: "animal", leaveEn: "hop away", leaveKm: "លោតចេញទៅ" },
  { icon: "cat", one: "cat", many: "cats", km: "ឆ្មា", cls: "ក្បាល", kind: "animal", leaveEn: "run away", leaveKm: "រត់ចេញទៅ" },
  { icon: "fish", one: "fish", many: "fish", km: "ត្រី", cls: "ក្បាល", kind: "animal", leaveEn: "swim away", leaveKm: "ហែលចេញទៅ" },
  { icon: "hen", one: "hen", many: "hens", km: "មាន់", cls: "ក្បាល", kind: "animal", leaveEn: "walk away", leaveKm: "ដើរចេញទៅ" },
];

/** "5 apples", and in Khmer "ផ្លែប៉ោម 5 ផ្លែ". */
export const countEn = (t: Thing, n: number): string => `${n} ${n === 1 ? t.one : t.many}`;
export const countKm = (t: Thing, n: number): string => `${t.km} ${n}${t.cls ? ` ${t.cls}` : ""}`;
/** The Khmer for "how many apples": "ផ្លែប៉ោមប៉ុន្មានផ្លែ". */
export const howKm = (t: Thing): string => `${t.km}ប៉ុន្មាន${t.cls}`;

// ---- picking without repeating -----------------------------------------------------

export const rngFor = (seed: string): Rng => makeRng(seed);
export const pickOne = <T>(rng: Rng, items: readonly T[]): T => items[Math.floor(rng() * items.length)];
export const intBetween = (rng: Rng, lo: number, hi: number): number => lo + Math.floor(rng() * (hi - lo + 1));

/**
 * `count` different questions from a generator that takes a fresh random source
 * each time: duplicates (same key) are skipped, and it gives up after a fixed
 * number of tries so a generator that has run dry cannot loop forever.
 */
export const distinct = (seed: string, count: number, make: (rng: Rng, i: number) => Q | null): Q[] => {
  const rng = makeRng(seed);
  const seen = new Set<string>();
  const out: Q[] = [];
  for (let tries = 0; out.length < count && tries < count * 60; tries++) {
    const q = make(rng, tries);
    if (q && !seen.has(q.key)) {
      seen.add(q.key);
      out.push(q);
    }
  }
  return out;
};

/** Wrong answers near the right one, as numbers, mixed with it in a fixed order. */
export const nearby = (seed: string, right: number, spread: number, count = 3): string[] => {
  const rng = makeRng(seed);
  const set = new Set<number>([right]);
  for (let i = 0; set.size < count && i < 50; i++) {
    const d = intBetween(rng, 1, spread) * (rng() < 0.5 ? -1 : 1);
    if (right + d >= 0) set.add(right + d);
  }
  return shuffled(rng, [...set]).map(String);
};

// ---- pure-number questions ---------------------------------------------------------

import { mathAnswer, mathExplanation, mathPrompt, type MathOp, type MathUnknown } from "../../math";

const OP_NAME: Record<MathOp, string> = { "+": "plus", "−": "minus", "×": "times", "÷": "by" };

/** A sum written as numbers, on the existing math kind: the app works the answer out itself. */
export const sumQ = (grade: Grade, a: number, op: MathOp, b: number, unknown: MathUnknown = "result", d?: Difficulty): Puzzle => {
  const spec = { a, op, b, unknown };
  return {
    id: `math-${a}-${OP_NAME[op]}-${b}-${unknown}`,
    category: "math",
    ages: agesOf(grade),
    difficulty: d ?? (grade <= 2 ? 1 : grade <= 4 ? 2 : 3),
    trick: "compound",
    kind: "math",
    math: spec,
    pieces: [word(mathPrompt(spec))],
    answer: String(mathAnswer(spec)),
    accepts: [],
    explanation: mathExplanation(spec),
    source: "official",
  };
};

/** Shape names, in the two languages. */
export const SHAPE_NAMES: Record<string, { en: string; km: string; plural: string; sides: number }> = {
  triangle: { en: "triangle", plural: "triangles", km: "ត្រីកោណ", sides: 3 },
  square: { en: "square", plural: "squares", km: "ការ៉េ", sides: 4 },
  rectangle: { en: "rectangle", plural: "rectangles", km: "ចតុកោណកែង", sides: 4 },
  circle: { en: "circle", plural: "circles", km: "រង្វង់", sides: 0 },
  pentagon: { en: "pentagon", plural: "pentagons", km: "បញ្ចកោណ", sides: 5 },
  hexagon: { en: "hexagon", plural: "hexagons", km: "ឆកោណ", sides: 6 },
  octagon: { en: "octagon", plural: "octagons", km: "អដ្ឋកោណ", sides: 8 },
};
