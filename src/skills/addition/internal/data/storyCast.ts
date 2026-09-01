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
export const NAMES = ["Mia", "Sam", "Ava", "Leo", "Zoe", "Kai"] as const;

export interface Thing {
  /** As it appears after a number: "7 shells". */
  many: string;
  /** For a sentence that needs the singular. */
  one: string;
}

export const THINGS: Thing[] = [
  { one: "shell", many: "shells" },
  { one: "sticker", many: "stickers" },
  { one: "marble", many: "marbles" },
  { one: "apple", many: "apples" },
  { one: "card", many: "cards" },
  { one: "block", many: "blocks" },
  { one: "button", many: "buttons" },
  { one: "acorn", many: "acorns" },
];

/** Two different names, for the comparison stories. */
export const twoNames = (pick: <T>(items: readonly T[]) => T): [string, string] => {
  const first = pick(NAMES);
  const rest = NAMES.filter((n) => n !== first);
  return [first, pick(rest)];
};
