/**
 * How a story is set on the page, as plain data.
 *
 * Pages, headings and emphasis are decided here and drawn by `BookReader`. Kept
 * pure so the rules — which words are bold, where a page breaks — can be tested
 * without a screen, and so the same book always lays out the same way.
 *
 * Nothing here changes a story. A heading is a way of *showing* the start of a
 * sentence; the sentence, its words, its recording and its questions are exactly
 * what the author published.
 */

import type { Band, Passage, PicturePlace, Sentence } from "./data/passage";
import { core } from "./data/text";

export type Emphasis = "key" | "name" | null;

export interface SetToken {
  /** The token as written, punctuation included. */
  text: string;
  /** The word without its punctuation — what a tap looks up. */
  word: string;
  emphasis: Emphasis;
}

export interface SetSentence {
  sentence: Sentence;
  /** "The Straw House" from "The Straw House: The first pig…", or null. */
  heading: string | null;
  /** The sentence's words after any heading. */
  tokens: SetToken[];
}

/** Sentences per page, and roughly how many characters a page holds. */
const PAGE: Record<Band, { sentences: number; chars: number }> = {
  A: { sentences: 2, chars: 170 },
  B: { sentences: 3, chars: 340 },
};

/**
 * Pages of sentences. A page holds up to its band's sentence count and about its
 * band's characters; a sentence is never split, so a single long one gets a page
 * to itself.
 */
export function paginate(book: Pick<Passage, "band" | "sentences">): Sentence[][] {
  const { sentences: max, chars } = PAGE[book.band] ?? PAGE.A;
  const pages: Sentence[][] = [];
  let cur: Sentence[] = [];
  let size = 0;
  for (const s of book.sentences) {
    const len = [...s.text].length;
    if (cur.length && (cur.length >= max || size + len > chars)) {
      pages.push(cur);
      cur = [];
      size = 0;
    }
    cur.push(s);
    size += len;
  }
  if (cur.length) pages.push(cur);
  return pages;
}

/** The words the quiz will ask about: every Words and Spell word. Lower case for English. */
export function keyWordsOf(book: Pick<Passage, "language" | "questions">): Set<string> {
  const low = (w: string) => (book.language === "km" ? w.normalize("NFC") : w.toLowerCase());
  const out = new Set<string>();
  for (const q of book.questions) if (q.kind === "vocab" || q.kind === "spell") out.add(low(q.word));
  return out;
}

/**
 * A heading at the start of a sentence: up to five capitalised words and a
 * colon, then more of the sentence. "Setting Out: Three young pigs…" has one;
 * "Then Dara said: come here" does not, because "said" is not capitalised.
 * English only — Khmer has no capitals to tell a heading from a sentence.
 */
export function headingLength(s: Sentence, lang: Passage["language"]): number {
  if (lang !== "en") return 0;
  for (let n = 1; n <= Math.min(5, s.words.length - 1); n++) {
    const head = s.words.slice(0, n);
    if (!head.every((t) => /^[A-Z0-9]/.test(t))) return 0;
    if (head[n - 1].endsWith(":")) return n;
  }
  return 0;
}

/** Does the word at `i` begin a sentence? The first word does, and so does one after closing punctuation. */
function startsSentence(tokens: readonly string[], i: number): boolean {
  if (/^["“‘'(]/.test(tokens[i])) return true;
  let j = i - 1;
  while (j >= 0 && !core(tokens[j])) {
    if (/[.!?:;]/.test(tokens[j])) return true; // a lone mark: ` ! " He`
    j--;
  }
  return j < 0 || /[.!?:;]["”’')]*$/.test(tokens[j]);
}

/** One sentence, set: its heading, and each word with its emphasis. */
export function setSentence(s: Sentence, book: Pick<Passage, "language" | "noRecording">, keys: ReadonlySet<string>): SetSentence {
  const lang = book.language;
  const names = new Set(book.noRecording ?? []);
  const h = headingLength(s, lang);
  const heading = h ? s.words.slice(0, h).join(" ").replace(/:$/, "") : null;
  const body = s.words.slice(h);
  const tokens = body.map((text, i) => {
    const word = core(text);
    const key = lang === "km" ? word.normalize("NFC") : word.toLowerCase();
    let emphasis: Emphasis = null;
    if (word && keys.has(key)) emphasis = "key";
    // A name: capitalised where a sentence does not start. One story "sentence"
    // can hold several, and speech — `vows: "Then I'll…` — starts one too, so a
    // word after . ! ? : ; (or after a quote) is not taken for a name. "I" is
    // not a name. Names the book lists (they have no recording) count anywhere.
    else if (names.has(word) || (lang === "en" && !startsSentence(body, i) && /^[A-Z][a-z]/.test(word))) emphasis = "name";
    return { text, word, emphasis };
  });
  return { sentence: s, heading, tokens };
}

export type PagePicture = { key: string | null; how: "chosen" | "none" | "auto"; at: PicturePlace };

/**
 * The illustration for a page, and where it sits. What the author chose wins —
 * a picture, or "none" — from the first sentence on the page that says.
 * Otherwise it is automatic: the picture of the first word on the page that has
 * one, so a page about the mango shows the mango. Top unless placed.
 */
export function pagePicture(page: readonly Pick<SetSentence, "sentence" | "tokens">[], book: Pick<Passage, "pictures">): PagePicture {
  const at = page.find((s) => s.sentence.pictureAt)?.sentence.pictureAt ?? "top";
  for (const s of page) {
    const chosen = s.sentence.picture;
    if (chosen === null) return { key: null, how: "none", at };
    if (typeof chosen === "string" && chosen) return { key: chosen, how: "chosen", at };
  }
  for (const s of page)
    for (const t of s.tokens) {
      const pic = book.pictures[t.word.toLowerCase()] ?? book.pictures[t.word];
      if (pic) return { key: pic, how: "auto", at };
    }
  return { key: null, how: "auto", at };
}

export const pictureOf = (page: readonly SetSentence[], book: Pick<Passage, "pictures">): string | null => pagePicture(page, book).key;

/**
 * Change one page's picture choice. `picture`: a key to choose one, null for
 * none, undefined for automatic; `at`: where it sits. Whatever the patch leaves
 * out is kept. Both live on the page's first sentence and are cleared from the
 * rest, so a page never carries two choices that could disagree.
 */
export function withPageChoice<T extends Pick<Passage, "sentences">>(
  book: T,
  pageIds: readonly string[],
  patch: { picture?: string | null | undefined; at?: PicturePlace },
): T {
  const on = new Set(pageIds);
  const page = book.sentences.filter((s) => on.has(s.id));
  const hasPic = page.find((s) => s.picture !== undefined);
  const picture = "picture" in patch ? patch.picture : hasPic?.picture;
  const at = patch.at ?? page.find((s) => s.pictureAt)?.pictureAt;
  return {
    ...book,
    sentences: book.sentences.map((s) => {
      if (!on.has(s.id)) return s;
      const { picture: _p, pictureAt: _a, ...rest } = s;
      if (s.id !== pageIds[0]) return rest;
      return { ...rest, ...(picture !== undefined ? { picture } : {}), ...(at && at !== "top" ? { pictureAt: at } : {}) };
    }),
  };
}

/** Set one page's picture: a key, null for none, undefined for automatic. Its place is kept. */
export const withPagePicture = <T extends Pick<Passage, "sentences">>(book: T, pageIds: readonly string[], key: string | null | undefined): T =>
  withPageChoice(book, pageIds, { picture: key });

export interface BookPages {
  /** Page 0 is the cover; pages 1…n hold the story. */
  story: SetSentence[][];
  /** Each story page's illustration, or null. */
  pictures: (string | null)[];
  /** Where each story page's illustration sits. */
  places: PicturePlace[];
  keys: Set<string>;
  count: number;
}

export function layoutBook(book: Pick<Passage, "band" | "language" | "sentences" | "questions" | "noRecording" | "pictures">): BookPages {
  const keys = keyWordsOf(book);
  const story = paginate(book).map((page) => page.map((s) => setSentence(s, book, keys)));
  const chosen = story.map((pg) => pagePicture(pg, book));
  return { story, pictures: chosen.map((c) => c.key), places: chosen.map((c) => c.at), keys, count: story.length + 1 };
}
