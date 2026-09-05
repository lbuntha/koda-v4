import { signature } from "./pour";
import { minimumPours } from "./solve";
import { topRun, type Bottle, type Rack, type RackSpec } from "./types";

/**
 * Where a rack comes from, and why none of them can be impossible.
 *
 * The plan claimed solvability would be structural: scramble a solved rack with
 * legal pours, and undoing them is a solution. Phase 0 disproved it. A pour
 * moves the *whole* top run, so from a solved rack every move tips one uniform
 * bottle into another — after thirty of them every bottle is still uniform and
 * nothing has mixed. Whole-run scrambling cannot make a puzzle at all.
 *
 * So the scramble moves **partial** amounts, which mixes properly but is not a
 * legal pour and therefore proves nothing about solvability. Every dealt rack is
 * then **checked by the solver** and redrawn if it cannot be finished. Slower
 * than the promise, and honest: `dealRack` never returns an unsolvable rack.
 */

const MIX = 2654435761;
/** Deterministic stream. The same seed deals the same rack, forever. */
export function rng(seed: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  let state = (h ^ (h >>> 16)) >>> 0 || 1;
  return () => {
    state ^= state << 13; state >>>= 0;
    state ^= state >>> 17;
    state ^= state << 5; state >>>= 0;
    return state / 4294967296;
  };
}

/**
 * Twelve vetted hues, as RGB for distance only — rendering reads CSS tokens so
 * both themes keep their own values.
 */
export const POOL: ReadonlyArray<readonly [number, number, number]> = [
  [207, 48, 48], [219, 141, 77], [135, 207, 48], [48, 171, 48], [77, 219, 127],
  [77, 197, 219], [48, 116, 171], [120, 77, 219], [219, 77, 219], [171, 48, 140],
];

/**
 * Far enough apart that no deal puts two blues side by side.
 *
 * Ten rather than twelve, and no amber, yellow or chartreuse: excluding that
 * band costs two slots but every remaining pair clears 94, where twelve could
 * only manage 67 and would have forced the relaxation open on most deals.
 */
export const MIN_COLOUR_DISTANCE = 94;
const distance = (a: readonly number[], b: readonly number[]) =>
  Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

/**
 * The colours for one round.
 *
 * Redrawn every round so a replayed rack is a new puzzle rather than a picture
 * to memorise. Shape is bound to the *deal position* rather than the hue
 * elsewhere, so a colour-blind child plays the same puzzle whatever comes out.
 */
export function drawPalette(k: number, next: () => number): number[] {
  const order = POOL.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i -= 1) {
    const j = Math.floor(next() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  const picked: number[] = [];
  for (const i of order) {
    if (picked.length >= k) break;
    if (picked.every((j) => distance(POOL[i], POOL[j]) >= MIN_COLOUR_DISTANCE)) picked.push(i);
  }
  // Relaxing beats failing: a deal must always be possible, even asking for
  // more colours than the spacing rule can supply.
  for (const i of order) {
    if (picked.length >= k) break;
    if (!picked.includes(i)) picked.push(i);
  }
  return picked.slice(0, k);
}

/** The finished rack a scramble starts from. */
export function solvedRack(spec: RackSpec): Bottle[] {
  const caps = spec.caps ?? Array.from({ length: spec.bottles }, () => spec.cap);
  return caps.map((cap, i) => {
    const b: Bottle = { cap, seg: [] };
    if (spec.oneWay === i) b.oneWay = true;
    if (spec.lock && spec.lock.tube === i) b.lockedBy = spec.lock.on;
    if (spec.linked && spec.linked[0] === i) b.linkedTo = spec.linked[1];
    if (i < spec.colours) for (let k = 0; k < cap; k += 1) b.seg.push(i);
    return b;
  });
}

export interface Deal {
  rack: Bottle[];
  /** Colour index → index into `POOL`. */
  hues: number[];
  /** Pours used to scramble, and the upper bound on the solution. */
  scramble: number;
}

/**
 * Deals one rack for a lesson.
 *
 * Locks and one-way bottles are ignored *while scrambling* and applied after,
 * so a rule that exists to make the solve interesting cannot block the deal
 * itself. The result is still reachable from solved by legal pours, which is
 * what the guarantee rests on.
 */
export function dealRack(spec: RackSpec, seed: string): Deal {
  const next = rng(`${spec.id}:${seed}`);
  const hues = drawPalette(spec.colours, next);
  const rack = solvedRack(spec).map((b) => ({ ...b, oneWay: undefined, lockedBy: undefined, linkedTo: undefined }));

  let applied = 0;
  for (let step = 0; step < spec.scramble; step += 1) {
    const options: Array<{ from: number; to: number; max: number }> = [];
    for (let from = 0; from < rack.length; from += 1) {
      const run = topRun(rack[from]);
      if (!run.n) continue;
      for (let to = 0; to < rack.length; to += 1) {
        if (from === to) continue;
        const b = rack[to];
        const room = b.cap - b.seg.length;
        if (room <= 0) continue;
        if (b.seg.length && b.seg[b.seg.length - 1] !== run.colour) continue;
        // Moving the whole of a uniform bottle into an empty one only renames
        // it, which is why whole-run scrambling never mixes anything.
        const max = Math.min(run.n, room);
        const useful = !(b.seg.length === 0 && run.n === rack[from].seg.length);
        if (useful || max > 1) options.push({ from, to, max });
      }
    }
    if (!options.length) break;
    const choice = options[Math.floor(next() * options.length)];
    const whole = rack[choice.from].seg.length === topRun(rack[choice.from]).n && !rack[choice.to].seg.length;
    // Leave something behind when taking from a bottle that would otherwise
    // empty into an empty one; that single held-back segment is what mixes.
    const cap = whole ? Math.max(1, choice.max - 1) : choice.max;
    const moved = 1 + Math.floor(next() * cap);
    const colour = topRun(rack[choice.from]).colour;
    for (let i = 0; i < moved; i += 1) rack[choice.to].seg.push(rack[choice.from].seg.pop() as number);
    void colour;
    applied += 1;
  }

  const template = solvedRack(spec);
  const dealt: Bottle[] = rack.map((b, i) => ({
    ...b,
    oneWay: template[i].oneWay,
    lockedBy: template[i].lockedBy,
    linkedTo: template[i].linkedTo,
    shown: spec.hidden ? Math.max(0, b.seg.length - 2) : b.seg.length,
  }));

  return { rack: dealt, hues, scramble: applied };
}

/** How many earlier questions a rack is checked against for repeats. */
const ROUND_MEMORY = 9;

/**
 * A rack for question `index` of a round.
 *
 * Redrawn until it is worth playing — not already finished, and finishable,
 * which the generator can no longer promise on its own — and until it differs
 * from the racks this round has already dealt. A child handed the same puzzle
 * twice in one sitting is the failure a large state space was supposed to
 * prevent and, at the short scrambles the early lessons use, does not.
 *
 * Pure: earlier questions are recomputed from the same seed rather than
 * remembered, so the answer depends only on `(spec, seed, index)`.
 */
export function rackFor(spec: RackSpec, seed: string, index: number): Deal {
  // Built forward from question 1, never by recursion: asking each earlier
  // question to look up *its* predecessors makes the cost exponential in the
  // question number, which hung the suite outright.
  const earlier = new Set<string>();
  const from = Math.max(1, index - ROUND_MEMORY);
  let deal = dealOne(spec, seed, from, earlier);
  for (let i = from; i < index; i += 1) {
    earlier.add(signature(deal.rack));
    deal = dealOne(spec, seed, i + 1, earlier);
  }
  return deal;
}

/**
 * One question, given what the round has already dealt.
 *
 * Three things are wanted and they can conflict: the rack must not arrive
 * finished, it must be finishable, and it should differ from what this round
 * has already shown. When a small rack cannot satisfy all three, uniqueness is
 * the one to give up — a repeated puzzle is a disappointment, a finished or
 * unsolvable one is a broken question.
 */
function dealOne(spec: RackSpec, seed: string, index: number, earlier: ReadonlySet<string>): Deal {
  const finished = (deal: Deal) => deal.rack.every((b) => b.seg.length === 0
    || (b.seg.length === b.cap && b.seg.every((c) => c === b.seg[0])));
  const playable = (deal: Deal) => !finished(deal) && deal.scramble >= 1
    && minimumPours(deal.rack).moves !== null;

  let fallback: Deal | null = null;
  for (let attempt = 0; attempt <= 40; attempt += 1) {
    const deal = dealRack(spec, attempt === 0 ? `${seed}:${index}` : `${seed}:${index}:retry${attempt}`);
    if (!playable(deal)) continue;
    if (!earlier.has(signature(deal.rack))) return deal;
    fallback ??= deal;
  }
  // Every attempt repeated something, or none was playable. A repeat beats a
  // rack the child cannot play.
  return fallback ?? dealRack(spec, `${seed}:${index}:last`);
}
