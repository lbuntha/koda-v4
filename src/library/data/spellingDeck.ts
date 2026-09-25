/**
 * A story's spelling words, ready for the ring.
 *
 * This is where a story stops being content and becomes something a child
 * plays: each spell question becomes the sentence with its word blanked, the
 * tiles to spell it with, and a distractor. A story that fails here throws —
 * "throw for impossible authoring specifications" — because a bad passage must
 * never reach a child as a ring that cannot be completed. `verifyPassage` is
 * how an author finds out first; this is the backstop.
 */

import { RING_MAX, type Passage } from "./passage";
import { gapOf } from "./text";
import { pickExtras, spellsWord, tilesOf, whyUnspellable } from "./tiles";

export interface DeckWord {
  /** `<passage>/<question>` — stable, so a replay logs the same id. */
  id: string;
  sentenceId: string;
  /** The word as authored. */
  word: string;
  /** The word as the story spells it, case and all. */
  original: string;
  tiles: string[];
  extras: string[];
  /** The sentence with the word replaced by a blank. */
  gapped: string;
}

export function buildSpellingDeck(p: Passage): DeckWord[] {
  const deck: DeckWord[] = [];
  for (const q of p.questions) {
    if (q.kind !== "spell") continue;
    const sentence = p.sentences.find((s) => s.id === q.sentence);
    if (!sentence) throw new Error(`${p.id}/${q.id}: sentence ${q.sentence} does not exist`);
    const gap = gapOf(sentence, q.word, p.language);
    if (!gap) throw new Error(`${p.id}/${q.id}: “${q.word}” is not a word of ${sentence.id}`);
    const why = whyUnspellable(q.word, p.language);
    if (why) throw new Error(`${p.id}/${q.id}: “${q.word}” cannot be spelled (${why})`);

    const tiles = tilesOf(q.word, p.language);
    // The ring never grows past RING_MAX: a full word gets no distractor. A
    // Khmer word gets two when there is room: its look-alikes are the lesson.
    const want = p.language === "km" ? 2 : 1;
    const extras = pickExtras(tiles, p.language, Math.max(0, Math.min(want, RING_MAX - tiles.length)));
    deck.push({ id: `${p.id}/${q.id}`, sentenceId: sentence.id, word: q.word, original: gap.original, tiles, extras, gapped: gap.text });
  }
  return deck;
}

/**
 * The tiles as laid out on the ring. The generator is injectable so a test can
 * pin an order; play uses `Math.random`.
 */
export function ringOf(word: DeckWord, rng: () => number = Math.random): string[] {
  const ring = [...word.tiles, ...word.extras];
  for (let i = ring.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [ring[i], ring[j]] = [ring[j], ring[i]];
  }
  return ring;
}

/** A trace is right when its tiles spell the word — by string, not by tile array. */
export const judgeSpelling = (word: DeckWord, chosen: readonly string[], p: Pick<Passage, "language">): "correct" | "wrong" =>
  spellsWord(chosen, word.word, p.language) ? "correct" : "wrong";
