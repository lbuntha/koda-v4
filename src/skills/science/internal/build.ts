import {
  ORDER_SETS,
  PICK_SETS,
  SORT_SETS,
  type Choice,
  type OrderSetId,
  type PickItem,
  type PickSetId,
  type SortSetId,
} from "./bank";

/**
 * Questions from the bank, pure and seeded.
 *
 * Question n of a lesson is always the same question, so StrictMode's double
 * render, a resumed practice round and a test all agree about what was asked.
 * Within a set the order is shuffled once per lesson (seeded by the set list),
 * then walked, so a round never repeats until the set runs out — and then it
 * starts the walk again rather than hanging.
 *
 * A lesson names one `set`. A practice lesson names `sets` and gets them in
 * turn, so ten questions over three sets cover all three.
 */

export interface BankSetup<S extends string> {
  set?: S;
  sets?: S[];
  questionsPerRound?: number;
  practice?: boolean;
}

/** A small deterministic PRNG (FNV-1a seed, xorshift steps). */
export function seeded(seed: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h ^= h << 13;
    h ^= h >>> 17;
    h ^= h << 5;
    return (h >>> 0) / 4294967296;
  };
}

export function shuffled<T>(items: readonly T[], seed: string): T[] {
  const rand = seeded(seed);
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Which set question `index` (1-based) draws from, and its place in that set's walk. */
export function slotFor<S extends string>(setup: BankSetup<S>, index: number, fallback: S): { set: S; turn: number } {
  const cycle = setup.sets && setup.sets.length > 0 ? setup.sets : [setup.set ?? fallback];
  const k = (index - 1) % cycle.length;
  return { set: cycle[k], turn: Math.floor((index - 1) / cycle.length) };
}

const walk = <T,>(items: readonly T[], set: string, turn: number): T => {
  const order = shuffled(items, `science:${set}`);
  return order[turn % order.length];
};

/* ---------- pick one ---------- */

export interface PickQuestion {
  set: PickSetId;
  item: PickItem;
  /** The choices in the order shown — never the bank's order, where the answer is often first. */
  choices: Choice[];
}

export function buildPick(setup: BankSetup<PickSetId>, index: number): PickQuestion {
  const { set, turn } = slotFor(setup, index, "needs");
  const items = PICK_SETS[set];
  if (!items?.length) throw new Error(`science: no pick set "${set}"`);
  const item = walk(items, set, turn);
  return { set, item, choices: shuffled(item.choices, `${set}:${item.id}`) };
}

/* ---------- sort ---------- */

export interface SortQuestion {
  set: SortSetId;
  item: { id: string; pic: string; bin: string };
}

export function buildSort(setup: BankSetup<SortSetId>, index: number): SortQuestion {
  const { set, turn } = slotFor(setup, index, "living");
  const bank = SORT_SETS[set];
  if (!bank) throw new Error(`science: no sort set "${set}"`);
  // Items are already authored alternating between bins; shuffle once per set, then walk.
  return { set, item: walk(bank.items, set, turn) };
}

/* ---------- put in order ---------- */

export interface OrderQuestion {
  set: OrderSetId;
  seq: { id: string; steps: string[] };
  /** The cards as dealt — never already in order. */
  dealt: string[];
}

export function buildOrder(setup: BankSetup<OrderSetId>, index: number): OrderQuestion {
  const { set, turn } = slotFor(setup, index, "growth");
  const seqs = ORDER_SETS[set];
  if (!seqs?.length) throw new Error(`science: no order set "${set}"`);
  const seq = walk(seqs, set, turn);
  let dealt = shuffled(seq.steps, `${set}:${seq.id}`);
  // A deal that happens to be the answer is no question: rotate it by one.
  if (dealt.every((s, i) => s === seq.steps[i])) dealt = [...dealt.slice(1), dealt[0]];
  return { set, seq, dealt };
}
