/**
 * From a story an author wrote to a book the checks can judge.
 *
 * Two drafters produce the same shape — `{ understand, words, spell }` — and both
 * go through `fromModel`, which trusts nothing: an item with a missing evidence
 * sentence, a picture that is not in the library, or a spelling word that is not
 * in its sentence is dropped here, and whatever survives is still judged by
 * `verifyPassage` in the editor and again by the server on publish.
 *
 *  - The **AI drafter** (server) writes real who / what / why questions.
 *  - The **offline drafter** (`draftLocally`) builds every question from the
 *    story's own words: "which word finishes this sentence?". Plainer, but it
 *    needs no key and no network, and an author can always edit from there.
 */

import { BANDS, CHOICES, type Band, type ComprehensionQuestion, type Language, type Passage, type Question, type QuestionCounts, type Sentence, type SpellQuestion, type VocabQuestion } from "./data/passage";
import { core, gapOf, parseStory, sentenceText, type WordSplitter } from "./data/text";
import { whyUnspellable, tilesOf } from "./data/tiles";
import { normalizeKhmer } from "./data/khmer";
import { BAND_LEVEL_CAP, spellingLevel } from "./data/khmerCoach";
import type { ModelDraft } from "./api";

export interface StoryInput {
  id: string;
  title: string;
  language: Language;
  band: Band;
  questionCounts?: QuestionCounts;
  category: string;
  text: string;
}

const hash = (s: string) => [...s].reduce((a, c) => (a * 31 + (c.codePointAt(0) ?? 0)) >>> 0, 7);
const STOP = new Set(
  "the a an and is was were are to of in on at it he she they his her its with for from that this then so but or as by be had has have not all up down out into under over very we you i my your our their them him am do did does no yes if when while because".split(" "),
);
const KM_STOP = new Set(["ទៅ", "មួយ", "ណាស់", "នាង", "គាត់", "ជាមួយ", "និង", "ហើយ", "ក៏", "នៅ", "បាន", "ជា", "មាន", "ដែល", "នេះ", "នោះ"]);
/** A few Khmer words the picture library can draw. */
const KM_PICTURES: Record<string, string> = { "ស្វាយ": "mango", "ផ្សារ": "market", "ចេក": "banana", "ក្រូច": "orange", "ឆ្មា": "cat", "ប៉ោម": "apple", "ទំពាំងបាយជូរ": "grape" };

export const vocabPrompt = (word: string, lang: Language) => (lang === "km" ? `តើរូបណាជា “${word}”?` : `Which picture is “${word}”?`);

/** A story word's picture key, if the library has one. Plurals find their singular. */
export function pictureFor(word: string, lang: Language, keys: readonly string[]): string | null {
  if (lang === "km") return KM_PICTURES[word] && keys.includes(KM_PICTURES[word]) ? KM_PICTURES[word] : null;
  const w = word.toLowerCase();
  for (const cand of [w, w.endsWith("es") ? w.slice(0, -2) : "", w.endsWith("s") ? w.slice(0, -1) : ""]) {
    if (cand && keys.includes(cand)) return cand;
  }
  return null;
}

/** A picture question: the right picture and two others the story does not use. */
export function vocabQuestion(id: string, word: string, picture: string, lang: Language, keys: readonly string[], inStory: ReadonlySet<string>): VocabQuestion | null {
  const others = keys.filter((k) => k !== picture && !inStory.has(k)).sort((a, b) => hash(a + word) - hash(b + word)).slice(0, CHOICES - 1);
  if (others.length < CHOICES - 1) return null;
  const at = hash(word) % CHOICES;
  const options = [...others];
  options.splice(at, 0, picture);
  return { id, kind: "vocab", prompt: vocabPrompt(word, lang), word, options, answer: at };
}

/**
 * A picture question with one of its three pictures changed.
 *
 * Two rules constrain this, and an author changing a picture by hand can break
 * either without noticing, so the writing is done here rather than at the call
 * site:
 *
 *  - rule 0 wants the three pictures distinct, so a picture already in another
 *    slot is *swapped* with the one being replaced rather than duplicated;
 *  - rule 1 wants `options[answer]` to be exactly the word's declared picture,
 *    so changing the right-hand picture rewrites `pictures[word]` too, and the
 *    answer is then re-pointed at wherever that picture ended up.
 *
 * That last step also settles the odd case of an author choosing the word's own
 * picture as a *wrong* one: the green mark follows the picture rather than the
 * slot, which is the only reading that leaves the question true.
 */
export function withVocabPicture(
  q: VocabQuestion,
  pictures: Readonly<Record<string, string>>,
  lang: Language,
  slot: number,
  key: string,
): { question: VocabQuestion; pictures: Record<string, string> } {
  const options = [...q.options];
  const held = options[slot];
  const already = options.indexOf(key);
  if (already !== -1 && already !== slot) options[already] = held;
  options[slot] = key;

  // Keyed the way the drafter keys it, so the lookup in rule 1 finds it.
  const wordKey = lang === "km" ? q.word : q.word.toLowerCase();
  const next = slot === q.answer ? { ...pictures, [wordKey]: key } : { ...pictures };
  const declared = next[wordKey] ?? next[q.word];
  const answer = options.indexOf(declared);

  return { question: { ...q, options, answer: answer === -1 ? q.answer : answer }, pictures: next };
}

const storyPictures = (sentences: readonly Sentence[], lang: Language, keys: readonly string[]) => {
  const map: Record<string, string> = {};
  for (const s of sentences)
    for (const tok of s.words) {
      const w = core(tok);
      const k = w && pictureFor(w, lang, keys);
      if (k) map[lang === "km" ? w : w.toLowerCase()] = k;
    }
  return map;
};

/** The story, split, with nothing asked yet. */
export function baseOf(input: StoryInput, splitter?: WordSplitter): Omit<Passage, "rev"> {
  return {
    id: input.id,
    language: input.language,
    band: input.band,
    questionCounts: input.questionCounts ?? BANDS[input.band],
    title: input.title.trim() || (input.language === "km" ? "រឿងថ្មី" : "New story"),
    category: input.category || undefined,
    picture: "book",
    sentences: parseStory(input.text, input.language, splitter),
    questions: [],
    pictures: {},
  };
}

const str = (x: unknown) => (typeof x === "string" ? x.trim() : "");

/**
 * The model's reply, cleaned. Drops anything malformed; never adds anything the
 * model did not propose, except the wrong pictures for a picture question.
 *
 * It also stops at the band's counts. A model asked for eleven items sometimes
 * sends twelve, and every one of them is valid — the extra must not reach the
 * author as an over-sized draft. A short story may still produce fewer than
 * the publish minimum; the Review screen then makes the missing work visible.
 */
export function fromModel(base: Omit<Passage, "rev">, reply: ModelDraft, keys: readonly string[]): Omit<Passage, "rev"> {
  const lang = base.language;
  const need = base.questionCounts ?? BANDS[base.band];
  const byId = new Map(base.sentences.map((s) => [s.id, s]));
  const pictures = storyPictures(base.sentences, lang, keys);
  const inStory = new Set(Object.values(pictures));
  const questions: Question[] = [];

  let n = 0;
  let understood = 0;
  for (const raw of Array.isArray(reply.understand) ? reply.understand : []) {
    if (understood >= need.understand) break;
    const r = raw as Record<string, unknown>;
    const options = Array.isArray(r.options) ? r.options.map(str) : [];
    const answer = typeof r.answer === "number" ? r.answer : -1;
    const evidence = str(r.evidence);
    if (!str(r.prompt) || options.length !== CHOICES || options.some((o) => !o) || answer < 0 || answer >= CHOICES || !byId.has(evidence)) continue;
    questions.push({ id: `q${++n}`, kind: "comprehension", prompt: str(r.prompt), options, answer, evidence } satisfies ComprehensionQuestion);
    understood++;
  }
  // A model's Khmer is often in drawn order rather than spelling order; put it
  // right before it is matched against the story, which already is.
  const asWord = (x: unknown) => (lang === "km" ? normalizeKhmer(str(x)) : str(x));
  let pictured = 0;
  for (const raw of Array.isArray(reply.words) ? reply.words : []) {
    if (pictured >= need.words) break;
    const r = raw as Record<string, unknown>;
    const word = asWord(r.word);
    const picture = str(r.picture);
    if (!word || !keys.includes(picture)) continue;
    const found = base.sentences.some((s) => s.words.some((t) => (lang === "km" ? normalizeKhmer(core(t)) === word : core(t).toLowerCase() === word.toLowerCase())));
    if (!found) continue;
    pictures[lang === "km" ? word : word.toLowerCase()] = picture;
    const q = vocabQuestion(`q${n + 1}`, lang === "km" ? word : word.toLowerCase(), picture, lang, keys, new Set([...inStory, picture]));
    if (q) { questions.push(q); n++; pictured++; }
  }
  let sp = 0;
  for (const raw of Array.isArray(reply.spell) ? reply.spell : []) {
    if (sp >= need.spell) break;
    const r = raw as Record<string, unknown>;
    const s = byId.get(str(r.sentence));
    const word = asWord(r.word);
    if (!s || !word || !gapOf(s, word, lang) || whyUnspellable(word, lang)) continue;
    questions.push({ id: `sp${++sp}`, kind: "spell", sentence: s.id, word: lang === "km" ? word : word.toLowerCase() } satisfies SpellQuestion);
  }
  const firstPic = questions.find((q): q is VocabQuestion => q.kind === "vocab");
  return { ...base, questions, pictures, picture: firstPic ? firstPic.options[firstPic.answer] : Object.values(pictures)[0] ?? "book" };
}

/* -------------------------------------------------------------------------- */
/* The offline drafter                                                         */
/* -------------------------------------------------------------------------- */

interface Candidate { sid: string; word: string; len: number; key: string | null }

function candidates(sentences: readonly Sentence[], lang: Language, keys: readonly string[]): Candidate[] {
  const out: Candidate[] = [];
  for (const s of sentences)
    s.words.forEach((tok) => {
      const w = core(tok);
      if (!w) return;
      const len = tilesOf(w, lang).length;
      // A capitalised word is a name or a sentence start; keep it only if it is a picture word.
      const nameLike = lang === "en" && /^[A-Z]/.test(w) && !pictureFor(w, lang, keys);
      const ok = lang === "km"
        ? !KM_STOP.has(w) && !whyUnspellable(w, lang)
        : !STOP.has(w.toLowerCase()) && !nameLike && len >= 3 && !whyUnspellable(w, lang);
      if (ok) out.push({ sid: s.id, word: w, len, key: pictureFor(w, lang, keys) });
    });
  return out;
}

/** Build a reply from the story's own words. Same shape as the model's, same cleaning after. */
export function draftLocally(base: Omit<Passage, "rev">, keys: readonly string[], seed = 0): ModelDraft {
  const lang = base.language;
  const need = base.questionCounts ?? BANDS[base.band];
  const low = (w: string) => (lang === "km" ? w : w.toLowerCase());
  const all = candidates(base.sentences, lang, keys);
  // Khmer: a word above the band's spelling level is a last resort — a 6-year-old
  // meets ◌ុំ and two feet only when the story offers nothing gentler.
  const tooHard = (c: Candidate) => lang === "km" && spellingLevel(tilesOf(c.word, lang)) > BAND_LEVEL_CAP[base.band];
  const score = (c: Candidate) => (c.key ? 3 : 0) + (c.len >= 4 && c.len <= 7 ? 2 : c.len === 3 ? 1 : 0) - (tooHard(c) ? 10 : 0);

  // Spell: the best word of each sentence, spread across the story.
  const perSentence: Candidate[] = [];
  const usedWords = new Set<string>();
  for (const s of base.sentences) {
    const best = all.filter((c) => c.sid === s.id && !usedWords.has(low(c.word))).sort((a, b) => score(b) - score(a) || b.len - a.len)[0];
    if (best) { perSentence.push(best); usedWords.add(low(best.word)); }
  }
  const step = perSentence.length / Math.max(1, need.spell);
  const spell = perSentence.length <= need.spell ? perSentence : Array.from({ length: need.spell }, (_, k) => perSentence[Math.floor(k * step)]);
  const spellSentences = new Set(spell.map((c) => c.sid));
  const spellWords = new Set(spell.map((c) => low(c.word)));

  // Understand: "which word finishes this sentence?", preferring sentences Spell did not use.
  const pool = [...new Set(all.map((c) => low(c.word)))];
  const understand: Array<Record<string, unknown>> = [];
  const taken = new Set(spellWords);
  const order = [...base.sentences].sort((a, b) => Number(spellSentences.has(a.id)) - Number(spellSentences.has(b.id)));
  for (const s of order) {
    if (understand.length >= need.understand) break;
    const inSentence = new Set(s.words.map((t) => low(core(t))));
    const own = all.filter((c) => c.sid === s.id && !taken.has(low(c.word))).sort((a, b) => (seed ? hash(a.word + seed) - hash(b.word + seed) : b.len - a.len));
    // First pass: only a word whose two wrong choices are at least as long as it,
    // so the right answer is never the one a child can pick by length. Then any word.
    const tries = [...own.map((t) => [t, true] as const), ...own.map((t) => [t, false] as const)];
    for (const [t, strict] of tries) {
      const tw = low(t.word);
      const outside = pool.filter((x) => !inSentence.has(x) && x !== tw);
      const longer = outside.filter((x) => [...x].length >= [...tw].length);
      if (strict && longer.length < 2) continue;
      const others = (strict ? longer : outside).sort((a, b) => hash(a + tw + seed) - hash(b + tw + seed)).slice(0, 2);
      if (others.length < 2) continue;
      const at = hash(tw + seed) % CHOICES;
      const options = [...others];
      options.splice(at, 0, tw);
      const g = gapOf(s, t.word, lang)!;
      understand.push({
        prompt: lang === "km" ? `តើពាក្យអ្វីបំពេញប្រយោគនេះ? “${g.text}”` : `Which word finishes this sentence from the story? “${g.text}”`,
        options, answer: at, evidence: s.id,
      });
      taken.add(tw);
      break;
    }
  }

  // Words: story words the picture library can draw.
  const seen = new Set<string>();
  const words = all.filter((c) => c.key && !seen.has(c.key) && seen.add(c.key)).slice(0, need.words).map((c) => ({ word: low(c.word), picture: c.key }));

  return { understand, words, spell: spell.map((c) => ({ sentence: c.sid, word: low(c.word) })) };
}

/** Re-join a sentence after an author merged two of its words. */
export function mergeWords(s: Sentence, index: number, lang: Language): Sentence {
  if (index < 0 || index >= s.words.length - 1) return s;
  const words = [...s.words];
  words.splice(index, 2, words[index] + (lang === "km" ? "" : " ") + words[index + 1]);
  // A changed split invalidates the old per-word timing offsets. Keep the
  // recording, but make the server regenerate/omit highlighting until new
  // cues are attached to this exact word list.
  const next = { ...s, words, text: sentenceText(words, lang) };
  delete next.audioCues;
  return next;
}

/**
 * Two sentences made one: `id` joins the end of the sentence before it.
 *
 * The way out of a sentence that should never have been one. A stray closing
 * quote used to be split off as a sentence of its own, and it reached the
 * author as a page with no words on it that nothing in the studio could remove
 * — editing the source text throws away every question, which is a heavy price
 * for deleting a `»`. `splitSentences` no longer makes them, but the books that
 * already have one still need this.
 *
 * What follows the join is decided rather than guessed: a picture on either
 * half is kept, the first one's winning; two recordings cannot be stitched into
 * one sentence, so when both halves have one neither survives. Questions that
 * pointed at the sentence that is gone point at the one it joined, which can
 * leave two questions in a part sharing a sentence — rule 6 says so, and an
 * author fixes it, which is better than this quietly deleting their question.
 */
export function joinSentences<T extends Pick<Passage, "sentences" | "questions" | "language">>(book: T, id: string): T {
  const i = book.sentences.findIndex((s) => s.id === id);
  if (i <= 0) return book;
  const prev = book.sentences[i - 1];
  const gone = book.sentences[i];
  const words = [...prev.words, ...gone.words];
  const merged: Sentence = {
    ...prev,
    words,
    text: sentenceText(words, book.language),
    picture: prev.picture ?? gone.picture,
    pictureAt: prev.pictureAt ?? gone.pictureAt,
    audio: prev.audio && gone.audio ? undefined : prev.audio ?? gone.audio,
    // The sentence changed, so old word offsets no longer map to its words.
    audioCues: undefined,
  };
  return {
    ...book,
    sentences: book.sentences.flatMap((s) => (s.id === prev.id ? [merged] : s.id === gone.id ? [] : [s])),
    questions: book.questions.map((q) =>
      q.kind === "comprehension" && q.evidence === gone.id ? { ...q, evidence: prev.id }
      : q.kind === "spell" && q.sentence === gone.id ? { ...q, sentence: prev.id }
      : q),
  };
}
