/**
 * Questions for CompareBench: which is longer, taller, heavier; order three;
 * line them up; compare two things that cannot sit side by side.
 *
 * Pure and React-free so a test can check every answer against the lengths
 * without rendering anything. Lengths are whole "spaces" (one twentieth of the
 * bench's width), so what is drawn is exactly what is asked.
 */

export type CompareMode = "attribute" | "pick" | "pick_vertical" | "align" | "order" | "indirect";
export const COMPARE_MODES: readonly CompareMode[] = ["attribute", "pick", "pick_vertical", "align", "order", "indirect"];

/** The bench is this many spaces wide; nothing drawn is longer. */
export const BENCH = 20;

export type Colour = "purple" | "blue" | "pink" | "green";
export const COLOURS: readonly Colour[] = ["purple", "blue", "pink", "green"];

/** Things that lie down and can be any length. Each is drawn by stretching its middle. */
export type LyingThing = "pencil" | "crayon" | "ribbon" | "straw";
export const LYING: readonly LyingThing[] = ["pencil", "crayon", "ribbon", "straw"];

/** Things that stand up and can be any height. */
export type StandingThing = "sunflower" | "candle" | "tower" | "flag";
export const STANDING: readonly StandingThing[] = ["sunflower", "candle", "tower", "flag"];

/** Big things that stay where they are, for comparing with a string. */
export type FixedThing = "door" | "bookcase" | "window" | "cupboard";
export const FIXED: readonly FixedThing[] = ["door", "bookcase", "window", "cupboard"];

export type Ask = "longer" | "shorter" | "taller" | "lower" | "heavier" | "lighter" | "holdsMore";
export type Tool = "ruler" | "balance" | "jug";

export interface Item {
  /** Stable id within the question, used in button labels' order and in tests. */
  key: string;
  colour: Colour;
  thing: LyingThing | StandingThing | FixedThing;
  /** Length or height in spaces. */
  size: number;
  /** Where it starts, in spaces from the start line. 0 for everything except `align`. */
  start: number;
}

export interface CompareQuestion {
  mode: CompareMode;
  items: Item[];
  ask: Ask;
  /** The item key that answers the question; for `order`, keys shortest first; for `attribute`, the tool. */
  answer: string;
  order?: string[];
  tool?: Tool;
  /** For `attribute`: the two everyday things the question is about. */
  pair?: [Everyday, Everyday];
}

/** Everyday things for "what would you use to find out", with which question each pair raises. */
export type Everyday = "apple" | "car" | "cup" | "bath" | "key" | "bus" | "carrot" | "bed" | "book" | "feather";
const ATTRIBUTE_SETS: { pair: [Everyday, Everyday]; ask: Ask; tool: Tool }[] = [
  { pair: ["key", "bus"], ask: "longer", tool: "ruler" },
  { pair: ["bed", "carrot"], ask: "shorter", tool: "ruler" },
  { pair: ["carrot", "bed"], ask: "longer", tool: "ruler" },
  { pair: ["book", "feather"], ask: "heavier", tool: "balance" },
  { pair: ["apple", "car"], ask: "heavier", tool: "balance" },
  { pair: ["feather", "apple"], ask: "lighter", tool: "balance" },
  { pair: ["cup", "bath"], ask: "holdsMore", tool: "jug" },
  { pair: ["bath", "cup"], ask: "holdsMore", tool: "jug" },
];

export interface CompareSetup {
  mode?: CompareMode;
  /** Smallest gap between two lengths, as a fraction of the longer one. */
  minGap?: number;
  minSize?: number;
  maxSize?: number;
  questionsPerRound?: number;
  practice?: boolean;
  /** Modes a practice round cycles through. */
  modes?: CompareMode[];
}

const ATTEMPTS = 40;
const randInt = (lo: number, hi: number, rand: () => number) => lo + Math.floor(rand() * (hi - lo + 1));
const pickOne = <T,>(items: readonly T[], rand: () => number): T => items[Math.floor(rand() * items.length)];
function shuffle<T>(items: readonly T[], rand: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Whether two sizes are far enough apart for this lesson to be fair. */
export const farEnough = (a: number, b: number, minGap: number): boolean =>
  a !== b && Math.abs(a - b) / Math.max(a, b) >= minGap - 1e-9;

/** `count` sizes, every pair at least `minGap` apart. Throws if the range cannot hold them. */
export function drawSizes(count: number, lo: number, hi: number, minGap: number, rand: () => number = Math.random): number[] {
  for (let tries = 0; tries < ATTEMPTS * 10; tries += 1) {
    const sizes = Array.from({ length: count }, () => randInt(lo, hi, rand));
    if (sizes.every((a, i) => sizes.every((b, j) => i === j || farEnough(a, b, minGap)))) return sizes;
  }
  // Deterministic fallback: spread evenly from the top down, which always satisfies the gap if any choice does.
  const out: number[] = [hi];
  while (out.length < count) {
    const prev = out[out.length - 1];
    const next = Math.floor(prev * (1 - minGap));
    if (next < lo) throw new Error(`Cannot fit ${count} sizes ${minGap * 100}% apart between ${lo} and ${hi}`);
    out.push(next);
  }
  return out;
}

const keyOf = (q: CompareQuestion): string =>
  q.mode === "attribute"
    ? `${q.pair?.join("-")}`
    : `${q.ask}:${q.items.map((i) => `${i.size}@${i.start}`).join(",")}`;

/**
 * One question. `seen` holds the keys already asked this round; the draw is
 * retried a bounded number of times to avoid them, then allowed to repeat
 * rather than hang.
 */
export function buildCompare(setup: CompareSetup, mode: CompareMode, seen: Set<string>, rand: () => number = Math.random): CompareQuestion {
  let q = draw(setup, mode, rand);
  for (let i = 0; i < ATTEMPTS && seen.has(keyOf(q)); i += 1) q = draw(setup, mode, rand);
  seen.add(keyOf(q));
  return q;
}

function draw(setup: CompareSetup, mode: CompareMode, rand: () => number): CompareQuestion {
  const minGap = setup.minGap ?? 0.2;
  const lo = setup.minSize ?? 3;
  const hi = Math.min(setup.maxSize ?? 16, BENCH - 1);
  const colours = shuffle(COLOURS, rand);

  if (mode === "attribute") {
    const set = pickOne(ATTRIBUTE_SETS, rand);
    return { mode, items: [], ask: set.ask, answer: set.tool, tool: set.tool, pair: set.pair };
  }

  if (mode === "pick" || mode === "pick_vertical") {
    const [a, b] = drawSizes(2, lo, hi, minGap, rand);
    const thing = pickOne(mode === "pick" ? LYING : STANDING, rand);
    const items = [a, b].map((size, i) => ({ key: `item${i}`, colour: colours[i], thing, size, start: 0 }));
    const ask: Ask = mode === "pick" ? pickOne<Ask>(["longer", "shorter"], rand) : pickOne<Ask>(["taller", "lower"], rand);
    const want = ask === "longer" || ask === "taller" ? Math.max(a, b) : Math.min(a, b);
    return { mode, items, ask, answer: items.find((it) => it.size === want)!.key };
  }

  if (mode === "align") {
    // The shorter one starts late, far enough that its end passes the longer one's.
    // Lined up by eye from the right, it looks longer; that is the lesson.
    for (let t = 0; t < ATTEMPTS; t += 1) {
      const [x, y] = drawSizes(2, lo, hi - 2, minGap, rand);
      const long = Math.max(x, y);
      const short = Math.min(x, y);
      const start = long - short + randInt(1, 3, rand);
      if (start + short > BENCH) continue;
      const thing = pickOne(LYING, rand);
      const shortFirst = rand() < 0.5;
      const items = [
        { key: "item0", colour: colours[0], thing, size: shortFirst ? short : long, start: shortFirst ? start : 0 },
        { key: "item1", colour: colours[1], thing, size: shortFirst ? long : short, start: shortFirst ? 0 : start },
      ];
      return { mode, items, ask: "longer", answer: items.find((it) => it.size === long)!.key };
    }
    throw new Error("align: no lengths fit the bench");
  }

  if (mode === "order") {
    const sizes = drawSizes(3, lo, hi, setup.minGap ?? 0.15, rand);
    const thing = pickOne(LYING, rand);
    const items = sizes.map((size, i) => ({ key: `item${i}`, colour: colours[i], thing, size, start: 0 }));
    const order = [...items].sort((p, r) => p.size - r.size).map((it) => it.key);
    return { mode, items, ask: "shorter", answer: order.join(","), order };
  }

  // indirect: two big things in different places; a string carries one's height to the other.
  const [a, b] = drawSizes(2, 8, 18, setup.minGap ?? 0.12, rand);
  const things = shuffle(FIXED, rand).slice(0, 2);
  const items = [a, b].map((size, i) => ({ key: `item${i}`, colour: colours[i], thing: things[i], size, start: 0 }));
  const ask: Ask = pickOne<Ask>(["taller", "lower"], rand);
  const want = ask === "taller" ? Math.max(a, b) : Math.min(a, b);
  return { mode, items, ask, answer: items.find((it) => it.size === want)!.key };
}

/** The mode for question `index` (1-based): the lesson's own, or a practice round's cycle. */
export function compareModeAt(setup: CompareSetup, index: number): CompareMode {
  const cycle = setup.modes?.length ? setup.modes : [setup.mode ?? "pick"];
  return cycle[(index - 1) % cycle.length];
}
