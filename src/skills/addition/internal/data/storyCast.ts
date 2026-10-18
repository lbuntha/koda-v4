/**
 * Who the word problems are about, and what they are counting.
 *
 * A short fixed list rather than anything generated, for three reasons. A child
 * meets the same handful of names across fifty questions and they become
 * familiar rather than noise. The nouns are things a six-year-old can picture
 * and, more to the point, *count* — nothing abstract, nothing that comes in
 * halves. And a fixed cast is a recordable one: the voice recorder expands a
 * template over its values, so six names and eight nouns is a known number of
 * clips rather than an open set.
 *
 * Names are short, easy to read, and deliberately drawn from several places.
 */
import { ta } from "../i18n";

/** In the language on screen: Khmer stories are about Khmer names. See `names.*`. */
export const NAMES = (): string[] => Array.from({ length: 6 }, (_, i) => ta(`names.${i}`));

export interface Thing {
  /** The `things.*` entry in this skill's catalogs. */
  key: string;
  /** As it appears after a number: "7 shells". */
  readonly many: string;
  /** For a sentence that needs the singular. */
  readonly one: string;
}

/** Named through the catalog, so each form is written per language rather than derived. */
const thing = (key: string): Thing => ({
  key,
  get one() {
    return ta(`things.${key}.one`);
  },
  get many() {
    return ta(`things.${key}.many`);
  },
});

export const THINGS: Thing[] = ["shell", "sticker", "marble", "apple", "card", "block", "button", "acorn"].map(thing);

/** Two different names, for the comparison stories. */
export const twoNames = (pick: <T>(items: readonly T[]) => T): [string, string] => {
  const names = NAMES();
  const first = pick(names);
  const rest = names.filter((n) => n !== first);
  return [first, pick(rest)];
};
