/**
 * One sitting with one book, as plain data.
 *
 * Everything a reader-and-quiz screen has to decide — which question comes next,
 * whether an answer counts as "first try", how many stars and how much XP a
 * finished book is worth, what a parent is told — lives here as pure functions.
 * The screens only draw it. That is what makes it testable without a DOM, and it
 * keeps the rules in one place when the same book is played on a phone, a tablet
 * and, later, in the admin's preview.
 */

import { BANDS, noteFor, type Band, type ComprehensionQuestion, type MatchPair, type MatchQuestion, type Passage, type VocabQuestion } from "./data/passage";
import { buildSpellingDeck, type DeckWord } from "./data/spellingDeck";
import { translate } from "../lib/i18n";

export type Part = "understand" | "match" | "words" | "opposite" | "reading" | "spell";
/**
 * Every part, in the order a book plays them. "match", "opposite" and "reading"
 * are optional: a book may have none.
 */
export const PARTS: readonly Part[] = ["understand", "match", "words", "opposite", "reading", "spell"];
/** The parts a book may leave out; a progress strip or results card skips them when empty. */
export const OPTIONAL_PARTS: ReadonlySet<Part> = new Set(["match", "opposite", "reading"]);

export type QuizItem =
  | { part: "understand"; question: ComprehensionQuestion }
  | { part: "match"; question: MatchQuestion }
  | { part: "words"; question: VocabQuestion }
  | { part: "opposite" | "reading"; question: MatchQuestion }
  | { part: "spell"; word: DeckWord };

/**
 * The quiz in the order it is played: understand, then any matching (it is
 * about the story's meaning too, so it follows on), then words, then spell.
 */
export function quizOf(p: Passage): QuizItem[] {
  return [
    ...p.questions.filter((q): q is ComprehensionQuestion => q.kind === "comprehension").map((question) => ({ part: "understand" as const, question })),
    ...p.questions.filter((q): q is MatchQuestion => q.kind === "match").map((question) => ({ part: "match" as const, question })),
    ...p.questions.filter((q): q is VocabQuestion => q.kind === "vocab").map((question) => ({ part: "words" as const, question })),
    ...notesQuiz(p, "opposite").map((question) => ({ part: "opposite" as const, question })),
    ...notesQuiz(p, "reading").map((question) => ({ part: "reading" as const, question })),
    ...buildSpellingDeck(p).map((word) => ({ part: "spell" as const, word })),
  ];
}

/** Most pairs on one board: more than this crowds a phone. */
const NOTE_PAIRS = 5;

/**
 * "Join each word to its opposite" and "join each word to how it is read",
 * made from the author's Read & opposite notes once they tick it in. A
 * board needs two pairs to be a choice, so a lone note is left out, and a last
 * board of one joins the board before it.
 */
export function notesQuiz(p: Passage, kind: "opposite" | "reading"): MatchQuestion[] {
  if (!p.notesInQuiz?.[kind]) return [];
  const pairs: MatchPair[] = Object.keys(p.wordNotes ?? {}).flatMap((word) => {
    const right = noteFor(p, word)?.[kind]?.trim();
    return right ? [{ left: word, right }] : [];
  });
  // Two words with the same answer would make a board with two right joins.
  const seen = new Set<string>();
  const unique = pairs.filter((pr) => !seen.has(pr.right) && seen.add(pr.right));
  if (unique.length < 2) return [];
  const boards: MatchPair[][] = [];
  for (let i = 0; i < unique.length; i += NOTE_PAIRS) boards.push(unique.slice(i, i + NOTE_PAIRS));
  if (boards.length > 1 && boards[boards.length - 1].length < 2) boards[boards.length - 2].push(...boards.pop()!);
  const prompt = translate(kind === "opposite" ? "library.notesQuiz.opposite" : "library.notesQuiz.reading");
  return boards.map((board, i) => ({ id: `${kind}-${i + 1}`, kind: "match", prompt, pairs: board }));
}

export const itemId = (p: Passage, item: QuizItem): string =>
  item.part === "spell" ? item.word.id : `${p.id}/${item.question.id}`;

export const taskKindOf = (part: Part): string =>
  part === "understand" ? "comprehension_choice" : part === "match" ? "match_pairs" : part === "words" ? "vocab_match"
  : part === "opposite" ? "opposite_match" : part === "reading" ? "reading_match" : "spell_word_in_sentence";

/** What is recorded about one question once it is answered. */
export interface Outcome {
  part: Part;
  id: string;
  /** The word, for Words and Spell questions, so it can be listed to practise. */
  word?: string;
  /** Wrong answers before the right one. */
  wrong: number;
  /** Hint rungs used. */
  hints: number;
  /** The story was opened again during this question. */
  reread: boolean;
}

/**
 * First try means no wrong answer, no hint and no Read again. That is the
 * definition the results screen, the stars and the parent summary all use, so it
 * is written exactly once.
 */
export const isFirstTry = (o: Outcome): boolean => o.wrong === 0 && o.hints === 0 && !o.reread;

export interface PartTally {
  part: Part;
  firstTry: number;
  total: number;
}

export function tally(outcomes: readonly Outcome[], quiz: readonly QuizItem[]): PartTally[] {
  return PARTS.map((part) => ({
    part,
    firstTry: outcomes.filter((o) => o.part === part && isFirstTry(o)).length,
    total: quiz.filter((q) => q.part === part).length,
  }));
}

/** Words a child needed help with, once each, in the order they came up. */
export const wordsToPractise = (outcomes: readonly Outcome[]): string[] =>
  [...new Set(outcomes.filter((o) => !isFirstTry(o) && o.word).map((o) => o.word as string))];

export interface Scoring {
  xpPerLevel: number;
  threeStarAt: number;
  twoStarAt: number;
  twoStarShare: number;
  oneStarShare: number;
}

/**
 * The same stars-and-XP rule as a lesson, so a book is worth what a lesson is —
 * unless the book sets its own `xp`, which replaces the XP per level and keeps
 * the same star shares below three stars.
 */
export function reward(outcomes: readonly Outcome[], questions: number, s: Scoring, xp?: number | null): { stars: 1 | 2 | 3; xp: number; accuracy: number } {
  const accuracy = questions > 0 ? outcomes.filter(isFirstTry).length / questions : 0;
  const stars = accuracy >= s.threeStarAt ? 3 : accuracy >= s.twoStarAt ? 2 : 1;
  const share = stars === 3 ? 1 : stars === 2 ? s.twoStarShare : s.oneStarShare;
  return { stars, xp: Math.round((xp ?? s.xpPerLevel) * share), accuracy };
}

/** The sentence a parent reads. Built from the same outcomes as the results screen. */
export function parentSummary(p: Passage, outcomes: readonly Outcome[], quiz: readonly QuizItem[]): string {
  const tallies = tally(outcomes, quiz);
  const of = (part: Part) => tallies.find((x) => x.part === part)!;
  const [u, w, s] = [of("understand"), of("words"), of("spell")];
  const need = wordsToPractise(outcomes);
  // In the app's language, for the parent reading it; the title and the words
  // to practise stay in the book's.
  const summary = translate("library.summary.read", {
    title: p.title,
    language: translate(`library.bookLanguage.${p.language}`),
    understood: `${u.firstTry}/${u.total}`,
    matched: `${w.firstTry}/${w.total}`,
    spelled: `${s.firstTry}/${s.total}`,
  });
  const practice = need.length
    ? translate("library.summary.needs", { words: need.join(", ") })
    : translate("library.summary.nothing");
  return `${summary} ${practice}`;
}

/** The concept a book is filed under in the learning log, by band. */
export const conceptFor = (band: Band): string => (band === "A" ? "read-and-answer" : "read-and-answer-long");

/**
 * What a parent reads for each library concept.
 *
 * The parent report names concepts from the skills' lessons, and the library is
 * not a skill, so without this a parent sees "read-and-answer" — a key, not a
 * sentence. Kept beside `conceptFor` so a new band cannot be filed without a name.
 */
export const LIBRARY_CONCEPT_NAMES: Readonly<Record<string, { lesson: string; skill: string }>> = {
  "read-and-answer": { lesson: "Reading a story, then answering and spelling (ages 5–7)", skill: "Koda Library" },
  "read-and-answer-long": { lesson: "Reading a longer story, then answering and spelling (ages 8–10)", skill: "Koda Library" },
};

export const ageBandOf = (band: Band): [number, number] => [BANDS[band].ages[0], BANDS[band].ages[1]];

/** Reading time in minutes, rounded up, never zero. About 50 words a minute for early readers. */
export const minutesToRead = (p: Passage): number => Math.max(1, Math.ceil(p.sentences.reduce((n, s) => n + s.words.length, 0) / 50));
