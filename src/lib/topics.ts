/**
 * What content is about — the layer Think, Read and Write share.
 *
 * Lesson concepts (`make-ten`, `count-on`) are fine-grained and belong to one
 * skill each, so they cannot say that a counting lesson, a counting story and
 * tracing the numbers 1–10 are about the same thing. Two coarser kinds of tag
 * can, and every lesson, book and trace collection carries both:
 *
 * - **Topics**: one short shared list, chosen by people. Skills declare theirs
 *   in their manifest; authors pick a book's or a collection's in the Studio.
 *   `server/app/topics.py` holds the same ids and refuses any other.
 * - **Units**: worked out from the content itself, never typed. The letters a
 *   book's words use, the letter a trace item writes, the numbers either
 *   holds. They make the precise links: a child who has just learned to write
 *   ក can be offered the books that use it.
 *
 * Units are strings so a set of them is cheap to compare: `letter:km:ក`,
 * `letter:en:a`, `number:7`.
 */

export const TOPICS = [
  "numbers",
  "counting",
  "addition",
  "subtraction",
  "multiplication",
  "division",
  "fractions",
  "money",
  "time",
  "measurement",
  "shapes",
  "colours",
  "patterns",
  "logic",
  "letters",
  "words",
  "reading",
  "writing",
  "drawing",
  "animals",
  "food",
  "family",
  "nature",
  "school",
  "places",
  "feelings",
  "health",
  "culture",
] as const;

export type Topic = (typeof TOPICS)[number];

/** The known topics in `values`, once each, in the list's order. Unknown ones are dropped. */
export const cleanTopics = (values: readonly unknown[] | null | undefined): Topic[] =>
  TOPICS.filter((topic) => values?.includes(topic));

/**
 * A topic from a book shelf's name, so a shelf called "Animals" files its
 * books under animals before anyone picks topics by hand.
 */
export const topicForShelf = (shelf: string | null | undefined): Topic | null => {
  const key = shelf?.trim().toLowerCase();
  if (!key) return null;
  const singular = key.endsWith("s") ? key : `${key}s`;
  return (TOPICS.find((topic) => topic === key || topic === singular) as Topic | undefined) ?? null;
};

// Khmer consonants and independent vowels: the letters a child learns to write.
const KHMER_LETTER = /[ក-ឳ]/gu;
const KHMER_DIGITS = "០១២៣៤៥៦៧៨៩";
const LATIN_LETTER = /[a-z]/g;
const NUMBER = /[0-9០-៩]+/gu;
/** Numbers above this are not something the catalogue links by. */
const MAX_NUMBER = 100;

const toArabic = (digits: string) => [...digits].map((d) => { const k = KHMER_DIGITS.indexOf(d); return k >= 0 ? String(k) : d; }).join("");

/**
 * The units a piece of text uses: its letters (by script) and its numbers.
 *
 * Latin letters only when `latinLetters` is set — an English story uses most
 * of the alphabet, so its letters say nothing, while a Khmer one is read with
 * the consonants a Grade 1 child has met. Numbers are kept whatever the
 * script, written in either set of digits.
 */
export const unitsOfText = (text: string, options: { latinLetters?: boolean } = {}): Set<string> => {
  const units = new Set<string>();
  for (const letter of text.match(KHMER_LETTER) ?? []) units.add(`letter:km:${letter}`);
  if (options.latinLetters) for (const letter of text.toLowerCase().match(LATIN_LETTER) ?? []) units.add(`letter:en:${letter}`);
  for (const raw of text.match(NUMBER) ?? []) {
    const n = Number(toArabic(raw));
    if (Number.isInteger(n) && n <= MAX_NUMBER) units.add(`number:${n}`);
  }
  return units;
};

/** Everything a piece of content is about: its topics, and the units it uses. */
export interface ContentTags {
  topics: ReadonlySet<Topic>;
  units: ReadonlySet<string>;
}

export const tags = (topics: Iterable<Topic>, units: Iterable<string> = []): ContentTags => ({
  topics: new Set(topics),
  units: new Set(units),
});

/**
 * How much two pieces of content share, for ranking "goes with this" — a unit
 * in common counts for more than a topic, being the more precise link.
 * Zero when they share nothing.
 */
export const overlap = (a: ContentTags, b: ContentTags): number => {
  let score = 0;
  for (const topic of a.topics) if (b.topics.has(topic)) score += 1;
  for (const unit of a.units) if (b.units.has(unit)) score += 2;
  return score;
};
