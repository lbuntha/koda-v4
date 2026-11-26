import { describe, expect, it } from "vitest";
import { ORDER_SETS, PICK_SETS, SORT_SETS, type OrderSetId, type PickSetId, type SortSetId } from "./internal/bank";
import { buildOrder, buildPick, buildSort, shuffled } from "./internal/build";
import { hasPic } from "./activities/pics";
import en from "./locales/en.json";
import km from "./locales/km.json";

/**
 * The science, checked against an answer key written separately from the bank.
 *
 * The bank says which choice is right; these tables say it again, from the
 * facts, so a slip in either one is caught. Sources: NGSS Grade 1 performance
 * expectations and their clarification statements; Cambodia's monsoon calendar
 * (rainy May–October); lightning safety (shelter in a building, never under a
 * tree); and astronomy (the Moon is lit by the Sun, the Sun rises in the east).
 */

type Tree = { [k: string]: string | Tree };
const at = (tree: Tree, path: string): string | undefined => {
  let node: string | Tree | undefined = tree;
  for (const part of path.split(".")) node = typeof node === "object" ? node[part] : undefined;
  return typeof node === "string" ? node : undefined;
};

const ANSWER_KEY: Record<PickSetId, Record<string, string>> = {
  needs: { "dry-plant": "water", "plant-food": "sunlight", "fish-air": "yes", "no-food": "robot", "rice-water": "grow", puppy: "all" },
  senses: { hear: "ear", smell: "nose", taste: "tongue", see: "eye", feel: "hand", "sun-safe": "no", smoke: "tell" },
  plantparts: { water: "root", hold: "stem", food: "leaf", fruit: "flower", "new-tree": "seed", lotus: "root" },
  animalparts: { fish: "fins", bird: "wings", turtle: "shell", duck: "webbed", elephant: "trunk", rabbit: "hear" },
  young: { tadpole: "frog", chick: "hen", caterpillar: "butterfly", kittens: "alike", "mango-seed": "mango", puppies: "can" },
  care: { "hen-eggs": "warm", "bird-feed": "food", "cat-carry": "safe", "baby-cry": "needs", ducklings: "learn", crocodile: "guard" },
  sound: { hum: "shake", drum: "shakes", bell: "stops", rice: "jump", harder: "louder", string: "stops" },
  see: { cave: "no", moon: "sun", shadow: "block", mirror: "bounce", "dark-room": "light", "cat-dark": "no" },
  sky: { rise: "east", set: "west", high: "midday", stars: "bright", "day-moon": "yes", "short-shadow": "midday", "moon-shape": "changes" },
  seasons: { rainy: "may", dry: "jan", rice: "rains", storm: "inside", "long-day": "june", cool: "shade" },
};

const SORT_KEY: Record<SortSetId, Record<string, string[]>> = {
  living: { living: ["dog", "tree", "fish", "flower", "snail", "rice"], not: ["car", "ball", "robot", "rock", "book", "cup"] },
  lightsource: { makes: ["sun", "lamp", "candle", "torch", "firefly"], none: ["moon", "mirror", "spoon", "book", "rock"] },
  lightpath: { clear: ["window", "glass", "bottle"], some: ["paper", "cloth", "bag"], blocks: ["door", "pot", "wall", "book"] },
};

const ORDER_KEY: Record<OrderSetId, Record<string, string[]>> = {
  growth: {
    mango: ["seed", "sprout", "young", "fruit"],
    chicken: ["egg", "chick", "hen"],
    frog: ["eggs", "tadpole", "froglet", "frog"],
    butterfly: ["egg", "caterpillar", "chrysalis", "butterfly"],
    person: ["baby", "child", "adult"],
    rice: ["seedling", "green", "golden", "harvest"],
  },
  sky: {
    sun: ["sunrise", "midday", "sunset", "night"],
    moon: ["crescent", "half", "full"],
    shadow: ["morning", "midday", "evening"],
  },
};

describe("pick questions", () => {
  const sets = Object.keys(PICK_SETS) as PickSetId[];

  it("agree with the answer key, question by question", () => {
    for (const set of sets) {
      expect(Object.fromEntries(PICK_SETS[set].map((i) => [i.id, i.answer])), set).toEqual(ANSWER_KEY[set]);
    }
  });

  it.each(sets)("%s: every question has 2–4 distinct choices including its answer, and enough to fill a round", (set) => {
    expect(PICK_SETS[set].length).toBeGreaterThanOrEqual(5);
    for (const item of PICK_SETS[set]) {
      const ids = item.choices.map((c) => c.id);
      expect(new Set(ids).size, item.id).toBe(ids.length);
      expect(ids.length, item.id).toBeGreaterThanOrEqual(2);
      expect(ids.length, item.id).toBeLessThanOrEqual(4);
      expect(ids, item.id).toContain(item.answer);
      for (const wrong of item.explained ?? []) {
        expect(wrong, `${item.id}: explains its own answer`).not.toBe(item.answer);
        expect(ids, item.id).toContain(wrong);
      }
    }
  });

  it.each(sets)("%s: every line a question shows exists in English and Khmer", (set) => {
    for (const item of PICK_SETS[set]) {
      const base = `pick.${set}.${item.id}`;
      const lines = ["ask", "clue", "why", ...item.choices.map((c) => `c.${c.id}`), ...(item.explained ?? []).map((w) => `no.${w}`)];
      for (const line of lines) {
        expect(at(en as Tree, `${base}.${line}`), `en ${base}.${line}`).toBeTruthy();
        expect(at(km as Tree, `${base}.${line}`), `km ${base}.${line}`).toBeTruthy();
      }
      // No stray explanations nobody can reach.
      const entry = (en.pick as unknown as Record<string, Record<string, { no?: Record<string, string> }>>)[set][item.id];
      const noKeys = Object.keys(entry.no ?? {});
      expect(noKeys.sort(), item.id).toEqual([...(item.explained ?? [])].sort());
    }
  });

  it.each(sets)("%s: every picture is drawn", (set) => {
    for (const item of PICK_SETS[set]) {
      if (item.pic) expect(hasPic(item.pic), `${item.id} ${item.pic}`).toBe(true);
      for (const c of item.choices) if (c.pic) expect(hasPic(c.pic), `${item.id} ${c.pic}`).toBe(true);
    }
  });

  it("never names the answer in the clue", () => {
    for (const set of sets) {
      for (const item of PICK_SETS[set]) {
        const clue = at(en as Tree, `pick.${set}.${item.id}.clue`)!.toLowerCase();
        const answer = at(en as Tree, `pick.${set}.${item.id}.c.${item.answer}`)!.toLowerCase();
        if (answer.length > 3) expect(clue, `${set}/${item.id}`).not.toContain(answer);
      }
    }
  });

  it("walks a set without repeats until it runs out, and is the same every time", () => {
    for (const set of sets) {
      const n = PICK_SETS[set].length;
      const ids = Array.from({ length: n }, (_, i) => buildPick({ set }, i + 1).item.id);
      expect(new Set(ids).size, set).toBe(n);
      expect(buildPick({ set }, n + 1).item.id).toBe(ids[0]);
      expect(buildPick({ set }, 3)).toEqual(buildPick({ set }, 3));
    }
  });

  it("does not always put the answer in the same place", () => {
    const places = sets.flatMap((set) => PICK_SETS[set].map((_, i) => {
      const q = buildPick({ set }, i + 1);
      return q.choices.findIndex((c) => c.id === q.item.answer);
    }));
    const first = places.filter((p) => p === 0).length / places.length;
    expect(first).toBeGreaterThan(0.2);
    expect(first).toBeLessThan(0.7);
  });

  it("cycles a practice round over every set it names", () => {
    const setsSeen = Array.from({ length: 10 }, (_, i) => buildPick({ sets: ["sound", "see", "sky", "seasons"] }, i + 1).set);
    expect(new Set(setsSeen)).toEqual(new Set(["sound", "see", "sky", "seasons"]));
  });
});

describe("sorting", () => {
  const sets = Object.keys(SORT_SETS) as SortSetId[];

  it("agrees with the answer key, bin by bin", () => {
    for (const set of sets) {
      const byBin: Record<string, string[]> = {};
      for (const item of SORT_SETS[set].items) (byBin[item.bin] ??= []).push(item.id);
      for (const bin of Object.keys(byBin)) byBin[bin].sort();
      const key = Object.fromEntries(Object.entries(SORT_KEY[set]).map(([b, ids]) => [b, [...ids].sort()]));
      expect(byBin, set).toEqual(key);
    }
  });

  it.each(sets)("%s: every bin, item and reason has words in both languages, and a picture", (set) => {
    const bank = SORT_SETS[set];
    for (const line of ["ask", "rule", ...bank.bins.map((b) => `bin.${b.id}`), ...bank.items.flatMap((i) => [`item.${i.id}`, `why.${i.id}`])]) {
      expect(at(en as Tree, `sort.${set}.${line}`), `en ${line}`).toBeTruthy();
      expect(at(km as Tree, `sort.${set}.${line}`), `km ${line}`).toBeTruthy();
    }
    for (const i of bank.items) expect(hasPic(i.pic), i.pic).toBe(true);
    for (const b of bank.bins) expect(hasPic(b.pic!), b.pic).toBe(true);
    for (const i of bank.items) expect(bank.bins.map((b) => b.id), i.id).toContain(i.bin);
  });

  it("walks every item before repeating", () => {
    for (const set of sets) {
      const n = SORT_SETS[set].items.length;
      const ids = Array.from({ length: n }, (_, i) => buildSort({ set }, i + 1).item.id);
      expect(new Set(ids).size, set).toBe(n);
    }
  });
});

describe("putting in order", () => {
  const sets = Object.keys(ORDER_SETS) as OrderSetId[];

  it("agrees with the answer key", () => {
    for (const set of sets) expect(Object.fromEntries(ORDER_SETS[set].map((s) => [s.id, s.steps])), set).toEqual(ORDER_KEY[set]);
  });

  it.each(sets)("%s: every step has words in both languages and a picture", (set) => {
    for (const seq of ORDER_SETS[set]) {
      for (const line of ["ask", "clue", "why", ...seq.steps.map((s) => `step.${s}`)]) {
        expect(at(en as Tree, `order.${set}.${seq.id}.${line}`), `en ${seq.id}.${line}`).toBeTruthy();
        expect(at(km as Tree, `order.${set}.${seq.id}.${line}`), `km ${seq.id}.${line}`).toBeTruthy();
      }
      for (const s of seq.steps) expect(hasPic(`${seq.id}-${s}`), `${seq.id}-${s}`).toBe(true);
    }
  });

  it("never deals the cards already in order", () => {
    for (const set of sets) {
      for (let i = 1; i <= ORDER_SETS[set].length * 2; i += 1) {
        const q = buildOrder({ set }, i);
        expect(q.dealt, `${set} ${i}`).not.toEqual(q.seq.steps);
        expect([...q.dealt].sort()).toEqual([...q.seq.steps].sort());
      }
    }
  });

  it("shuffles deterministically", () => {
    expect(shuffled([1, 2, 3, 4, 5], "x")).toEqual(shuffled([1, 2, 3, 4, 5], "x"));
    expect(() => buildOrder({ set: "nope" as OrderSetId }, 1)).toThrow();
  });
});
