/**
 * From a pasted story to sentences and words.
 *
 * English splits on whitespace. Khmer has no spaces between words, so it goes
 * through a dictionary-based word breaker — and that breaker is *good, not
 * right*. Run on `នាងទិញស្វាយមួយ។` ("she buys one mango") it returns
 * `នាងទិញ` as a single word. So what this file produces is a **proposal**: the
 * Content Studio shows it to a person, who merges or splits it, and only the
 * approved split is ever stored.
 *
 * The breaker is injectable so a test never depends on which ICU data a given
 * machine ships.
 */

import type { Language, Sentence } from "./passage";
import { normalizeKhmer } from "./khmer";

/** The blank a spelling word is replaced with. */
export const GAP = "___";

/** Turns one whitespace-free chunk of text into words. */
export type WordSplitter = (chunk: string) => string[];

let icu: Intl.Segmenter | null | undefined;
/** The platform's Khmer word breaker; a chunk stays whole if there is none. */
export const icuKhmerSplitter: WordSplitter = (chunk) => {
  if (icu === undefined) {
    try {
      icu = new Intl.Segmenter("km", { granularity: "word" });
    } catch {
      icu = null;
    }
  }
  return icu ? [...icu.segment(chunk)].map((s) => s.segment) : [chunk];
};

/** How a language writes a sentence back out of its words. */
export const joiner = (lang: Language): string => (lang === "km" ? "" : " ");

export const sentenceText = (words: readonly string[], lang: Language): string => words.join(joiner(lang));

/**
 * A word with the punctuation around it removed — "mother." → "mother",
 * "ម្តាយ។" → "ម្តាយ". An apostrophe inside a word stays: "don't".
 */
export const core = (token: string): string =>
  token.replace(/^[^\p{L}\p{M}\p{N}]+/u, "").replace(/[^\p{L}\p{M}\p{N}]+$/u, "");

/** The marks that close a quotation or a bracket, which belong to the sentence inside them. */
const CLOSERS = "\u00bb\u201d\u2019\"')\\]";

/**
 * Sentences, split on new lines and on terminal punctuation.
 *
 * A closing quote stays with the sentence it closes. Splitting on the `!` in
 * `…ស្អែក!»` left the `»` behind as a sentence of its own, which became a page
 * with no words on it that an author could not delete — and in English it left
 * every sentence after a quotation starting with a stray `"`. The split is taken
 * after any closer that follows the stop, and never between the stop and it.
 */
export function splitSentences(text: string): string[] {
  return text
    .split(/\n+/)
    .flatMap((line) => line.trim().split(new RegExp(`(?<=[.!?។៕][${CLOSERS}]?)(?![${CLOSERS}.!?។៕])\\s*`, "u")))
    .map((s) => s.trim())
    .filter(Boolean);
}

/** True for a token that is only punctuation or symbols. */
const isPunctuation = (t: string) => /^[\p{P}\p{S}]+$/u.test(t);

export function tokenizeSentence(sentence: string, lang: Language, splitter: WordSplitter = icuKhmerSplitter): string[] {
  if (lang !== "km") return sentence.split(/\s+/).filter(Boolean);
  // Khmer is put in spelling order first, so every word stored is the form a
  // quiz and a child's answer are compared in. A zero-width space — what Khmer
  // keyboards type between words — is a break, like a space.
  const chunks = normalizeKhmer(sentence).split(/[\s\u200B]+/u).filter(Boolean);

  // A space the person typed forces a break: each chunk is broken on its own.
  const words = chunks.flatMap((chunk) => splitter(chunk));
  const glued: string[] = [];
  for (const w of words) {
    if (isPunctuation(w) && glued.length) glued[glued.length - 1] += w;
    else glued.push(w);
  }
  return glued;
}

/**
 * Sentences with ids and a proposed split. `text` is rebuilt from `words`, so
 * the two can never disagree — a Khmer space typed to force a break is a
 * hint to the breaker, not part of the sentence.
 */
export function parseStory(text: string, lang: Language, splitter?: WordSplitter): Sentence[] {
  return splitSentences(text).map((s, i) => {
    const words = tokenizeSentence(s, lang, splitter);
    return { id: `s${i + 1}`, text: sentenceText(words, lang), words };
  });
}

export interface Gap {
  /** The sentence with the word replaced by `GAP`. */
  text: string;
  /** The word exactly as the story spells it — case and all. */
  original: string;
  /** Which word of the sentence was replaced. */
  index: number;
}

/**
 * The sentence with one word blanked, or null when the word is not in it.
 *
 * Matches on the word without its punctuation and without regard to case, and
 * replaces the *first* occurrence. Punctuation stays: "sweet." → "___.".
 */
export function gapOf(sentence: Pick<Sentence, "words">, word: string, lang: Language): Gap | null {
  const norm = (w: string) => (lang === "km" ? normalizeKhmer(w) : w.normalize("NFC").toLowerCase());
  const want = norm(word);
  const index = sentence.words.findIndex((t) => norm(core(t)) === want);
  if (index < 0) return null;
  const original = core(sentence.words[index]);
  const words = sentence.words.slice();
  words[index] = words[index].replace(original, GAP);
  return { text: sentenceText(words, lang), original, index };
}
