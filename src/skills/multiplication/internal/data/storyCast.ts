/**
 * The people and things every multiplication story is told about.
 *
 * A fixed cast rather than a fresh noun each question. A child reading five
 * word problems in a round should be spending their attention on the numbers
 * and the structure, not on decoding "a punnet of gooseberries" — and a story
 * whose objects change every sentence quietly makes each question harder than
 * the last for reasons that have nothing to do with multiplying.
 *
 * Nobody in this cast is given a pronoun. Names carry no reliable information
 * about how a person should be referred to, and a story can always be written
 * so it does not need to guess: "Maya has four boxes" needs no pronoun, and
 * neither does anything else here.
 */
import { tm } from "../i18n";


export interface Container {
  /** "box" — used after a number: "4 boxes". */
  one: string;
  many: string;
}

export interface Item {
  one: string;
  many: string;
}

/** The cast's names, read from the catalog each time so they follow the language on screen. */
const ACTOR_COUNT = 10;
export const actors = (): readonly string[] => Array.from({ length: ACTOR_COUNT }, (_, i) => tm(`cast.actors.${i}`));

/** A noun that reads its words from the catalog when asked, not when the module loads. */
const noun = (section: "containers" | "items", key: string): Container & Item => ({
  get one() {
    return tm(`cast.${section}.${key}.one`);
  },
  get many() {
    return tm(`cast.${section}.${key}.many`);
  },
});

export const CONTAINERS: readonly Container[] = Object.freeze(
  ["box", "bag", "tray", "packet", "basket", "shelf"].map((key) => noun("containers", key)),
);

export const ITEMS: readonly Item[] = Object.freeze(
  ["pencil", "apple", "sticker", "marble", "card", "button", "conker", "shell"].map((key) => noun("items", key)),
);

/** A number and its noun, agreeing: "1 box", "4 boxes". */
export const count = (n: number, thing: Container | Item): string =>
  tm("count", { n, noun: n === 1 ? thing.one : thing.many });

export interface StoryCast {
  actor: string;
  other: string;
  container: Container;
  item: Item;
}

/**
 * One cast, chosen by the question's own id.
 *
 * Derived rather than drawn, so a question keeps the same people and objects
 * across a re-render and a replay. A story whose characters changed while a
 * child was reading it would be a different story.
 */
export function castFor(seed: string): StoryCast {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const at = (offset: number, size: number) => Math.abs((hash >> offset) % size);
  const names = actors();
  const first = at(0, names.length);
  /* The offset is at least one and less than the cast size, so the second name
     can never come back round to the first — a story comparing someone with
     themselves is not a comparison. */
  const step = 1 + at(8, names.length - 1);
  const actor = names[first];
  const other = names[(first + step) % names.length];
  return {
    actor,
    other,
    container: CONTAINERS[at(16, CONTAINERS.length)],
    item: ITEMS[at(24, ITEMS.length)],
  };
}
