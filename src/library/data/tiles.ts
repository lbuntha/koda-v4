/**
 * What a learner spells with.
 *
 * English spells in letters. Khmer spells the way a Khmer class does, in the
 * order a word is *spelled* rather than drawn (see `khmer.ts`): the consonant,
 * each subscript "foot" (◌្វ), a shifter, the vowel — compound vowels such as
 * ◌ុំ and ◌ោះ whole — and each sign. So ស្វាយ is ស · ◌្វ · ◌ា · យ and ខ្មែរ is
 * ខ · ◌្ម · ◌ែ · រ, even though ◌ែ is drawn to the left.
 *
 * A Khmer word is put in spelling order first (the Khmer Angkor keyboard's
 * silent corrections), so a word typed in the order it looks — or pasted from a
 * PDF — tiles, and compares, exactly like the same word typed correctly.
 *
 * Answers are compared as whole strings in that normal form, never as tile
 * arrays: two tilings that rejoin to the same word are both right.
 */

import type { Language } from "./passage";
import { MAX_TILES, MIN_TILES } from "./passage";
import { isKhmerBase, isKhmerMark, khmerProblem, normalizeKhmer, spellingUnits, type KhmerProblem } from "./khmer";
import { khmerDecoys } from "./khmerCoach";

const isKhmerLetter = (c: number) => isKhmerBase(c) || isKhmerMark(c);

/** A word as compared: NFC and upper case for English; spelling order for Khmer. */
export const normalizeWord = (word: string, lang: Language): string =>
  lang === "en" ? word.normalize("NFC").toUpperCase() : normalizeKhmer(word);

/** The tiles a word is spelled with. Not validated — see `whyUnspellable`. */
export function tilesOf(word: string, lang: Language): string[] {
  if (lang === "en") return [...word.normalize("NFC").toUpperCase()];
  return spellingUnits(word);
}

/**
 * The word a child's tiles make, exactly in the order chosen. Khmer is *not*
 * put back in spelling order here: a child who picks ◌ែ before ◌្ម has spelled
 * it wrong, even though the two orders draw the same — that order is the lesson.
 * Only authored text is corrected (see `normalizeWord`).
 */
export const wordFromTiles = (tiles: readonly string[], lang: Language): string =>
  lang === "en" ? tiles.join("").normalize("NFC").toUpperCase() : tiles.join("").normalize("NFC");

/** True when the chosen tiles spell the word — by string, not by tile array; the word in its corrected form. */
export const spellsWord = (tiles: readonly string[], word: string, lang: Language): boolean =>
  wordFromTiles(tiles, lang) === normalizeWord(word, lang);

export type SpellProblem = "empty" | "not_letters" | KhmerProblem | "too_few_tiles" | "too_many_tiles";

/** What an author reads for each problem. */
export const SPELL_PROBLEM_TEXT: Record<SpellProblem, string> = {
  empty: "there is no word",
  not_letters: "it has characters that are not letters of this language",
  starts_with_mark: "it starts with a mark that has no consonant to sit on",
  dangling_coeng: "a subscript sign (◌្) has no consonant after it",
  two_vowels: "one syllable has two vowels — check how the word was typed",
  two_shifters: "one syllable has two consonant shifters (◌៉ ◌៊)",
  bantoc_misplaced: "a bantoc (◌់) follows a vowel, sign or subscript",
  too_few_tiles: `fewer than ${MIN_TILES} tiles`,
  too_many_tiles: `more than ${MAX_TILES} tiles — it will not fit the ring`,
};

/**
 * Why a word cannot be a spelling word, or null when it can.
 *
 * The order matters: a word is judged as text before it is judged as tiles, so
 * the reason a person reads is the first thing actually wrong.
 */
export function whyUnspellable(word: string, lang: Language): SpellProblem | null {
  const w = word.normalize("NFC");
  if (!w) return "empty";

  if (lang === "en") {
    if (!/^[A-Za-z]+$/.test(w)) return "not_letters";
  } else {
    const cps = [...w].map((ch) => ch.codePointAt(0) ?? 0);
    if (!cps.every(isKhmerLetter)) return "not_letters";
    const problem = khmerProblem(w);
    if (problem) return problem;
  }

  const n = tilesOf(w, lang).length;
  if (n < MIN_TILES) return "too_few_tiles";
  if (n > MAX_TILES) return "too_many_tiles";
  return null;
}

/**
 * Distractor tiles for the ring.
 *
 * Chosen to form as few real words as possible, so a bonus word is never a slip
 * a child is marked down for: Z, Q, X and J almost never complete an English
 * word from a three-letter one. Deterministic — the same word always gets the
 * same distractor, so a round can be replayed.
 */
export function pickExtras(tiles: readonly string[], lang: Language, n = 1): string[] {
  // Khmer: a spare tile a child really confuses with a piece of the word.
  if (lang === "km") return khmerDecoys(tiles, n);
  const bag = [..."ZQXJVWK"];
  return bag.filter((t) => !tiles.includes(t)).slice(0, Math.max(0, n));
}
