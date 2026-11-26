/**
 * Questions for MeasureStory: word problems with measures, solved with a bar
 * model. Phase 5 has `same_unit` only: add or subtract two amounts in one unit.
 *
 *   join     a + b: "You pour 300 ml, then 250 ml more."
 *   left     a − b: "The bag holds 900 g. You use 350 g."
 *   compare  a − b: "The red ribbon is 80 cm, the blue one 45 cm. How much longer?"
 *
 * Pure. Money is never used (it is its own skill). Amounts are round, as on a
 * scale or jug (multiples of 5, 10 or 50), and every total stays ≤ 1000.
 */

export type StoryKind = "join" | "left" | "compare";
export type StoryQuantity = "length" | "mass" | "capacity";

export interface StoryQuestion {
  mode: "same_unit";
  template: string;
  kind: StoryKind;
  quantity: StoryQuantity;
  /** The unit id (cm, g, mL); the region picks its symbol. */
  unit: "cm" | "g" | "mL";
  a: number;
  b: number;
  answer: number;
}

export interface StorySetup {
  mode?: "same_unit";
  questionsPerRound?: number;
  practice?: boolean;
}

/** Each template: what kind of sum it is, and what it measures. Words live in the locales under story.t.<id>. */
export const STORY_TEMPLATES: readonly { id: string; kind: StoryKind; quantity: StoryQuantity; unit: "cm" | "g" | "mL"; round: number }[] = [
  { id: "juice", kind: "join", quantity: "capacity", unit: "mL", round: 50 },
  { id: "jug", kind: "left", quantity: "capacity", unit: "mL", round: 50 },
  { id: "bottles", kind: "compare", quantity: "capacity", unit: "mL", round: 50 },
  { id: "flour", kind: "left", quantity: "mass", unit: "g", round: 50 },
  { id: "fruit", kind: "join", quantity: "mass", unit: "g", round: 10 },
  { id: "parcels", kind: "compare", quantity: "mass", unit: "g", round: 10 },
  { id: "ribbon", kind: "left", quantity: "length", unit: "cm", round: 5 },
  { id: "tower", kind: "join", quantity: "length", unit: "cm", round: 5 },
  { id: "plants", kind: "compare", quantity: "length", unit: "cm", round: 5 },
];

const pick = <T,>(xs: readonly T[], rand: () => number): T => xs[Math.floor(rand() * xs.length)];
const randInt = (lo: number, hi: number, rand: () => number) => lo + Math.floor(rand() * (hi - lo + 1));

export function buildStory(_setup: StorySetup, seen: Set<string>, rand: () => number = Math.random): StoryQuestion {
  let q = draw(rand);
  for (let i = 0; i < 40 && seen.has(`${q.template}:${q.a}:${q.b}`); i += 1) q = draw(rand);
  seen.add(`${q.template}:${q.a}:${q.b}`);
  return q;
}

function draw(rand: () => number): StoryQuestion {
  const t = pick(STORY_TEMPLATES, rand);
  const top = t.unit === "cm" ? 100 : 1000;
  const r = t.round;
  let a: number;
  let b: number;
  if (t.kind === "join") {
    a = randInt(1, top / r - 2, rand) * r;
    b = randInt(1, top / r - a / r - 1, rand) * r;
    // Two different parts, so the bar model shows two different pieces (a + b stays ≤ top).
    if (a === b) a += r;
  } else {
    a = randInt(3, top / r, rand) * r;
    b = randInt(1, a / r - 1, rand) * r;
  }
  return { mode: "same_unit", template: t.id, kind: t.kind, quantity: t.quantity, unit: t.unit, a, b, answer: t.kind === "join" ? a + b : a - b };
}

/** Four choices: the answer, the wrong operation, and near misses by one rounding step. */
export function storyChoices(q: StoryQuestion): number[] {
  const r = STORY_TEMPLATES.find((t) => t.id === q.template)!.round;
  const wrongOp = q.kind === "join" ? Math.abs(q.a - q.b) : q.a + q.b;
  const out = [q.answer];
  for (const v of [wrongOp, q.answer + r, q.answer - r, q.answer + 10 * r, q.answer - 10 * r, q.answer + 2 * r]) {
    if (out.length === 4) break;
    if (v > 0 && !out.includes(v)) out.push(v);
  }
  return out;
}
