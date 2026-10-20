/**
 * Is what the child typed the answer?
 *
 * Generous where a child is right in every way that matters (case, spacing,
 * "a", an apostrophe, one slipped key on a long word) and strict where they
 * are not. Typing "hotdog" for "hot dog" is right; "hat dog" is not.
 */

const ARTICLES = /(^|\s)(a|an|the)(?=\s|$)/g;

/**
 * Khmer numerals are the digits they stand for, and the marks that change a number
 * stay with it: -3 is not 3, 3/4 is not 34, 1.2 is not 12, 2:3 is not 23. (1,000 is just 1000.)
 */
const numberMarks = (text: string): string =>
  text
    .replace(/[០-៩]/g, (d) => String(d.charCodeAt(0) - 0x17e0))
    .replace(/(\d),(?=\d{3}(?!\d))/g, "$1")
    .replace(/(\d)[.,](?=\d)/g, "$1point")
    .replace(/(\d)\/(?=\d)/g, "$1over")
    .replace(/(\d):(?=\d)/g, "$1colon")
    .replace(/(^|[\s(=:])[-−–](?=\d)/g, "$1neg");

/**
 * Lower-case, accents and punctuation gone, articles dropped, spaces single.
 * Only Latin diacritics are stripped: the combining marks that make up a Khmer
 * syllable live elsewhere in Unicode and must survive.
 */
export const normalizeAnswer = (text: string): string =>
  numberMarks(text)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .normalize("NFC")
    .toLowerCase()
    .replace(/['’`]/g, "")
    .replace(/[^\p{L}\p{M}\p{N}\s]/gu, " ")
    .replace(ARTICLES, " ")
    .replace(/\s+/g, " ")
    .trim();

/** The answer with its spaces removed, so "hot dog" and "hotdog" are the same thing. */
export const compactAnswer = (text: string): string => normalizeAnswer(text).replace(/\s/g, "");

export const editDistance = (a: string, b: string): number => {
  if (a === b) return 0;
  const x = [...a];
  const y = [...b];
  let prev = Array.from({ length: y.length + 1 }, (_, j) => j);
  for (let i = 1; i <= x.length; i++) {
    const row = [i];
    for (let j = 1; j <= y.length; j++) {
      row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (x[i - 1] === y[j - 1] ? 0 : 1));
    }
    prev = row;
  }
  return prev[y.length];
};

/**
 * How many slipped keys an answer this long forgives. Nothing below 8 letters:
 * on a short answer one changed letter is usually a different thing ("hat dog"
 * is not "hot dog", "spail" is not "spain"). One slip from 8, two from 14.
 */
export const typoAllowance = (length: number): number => (length >= 14 ? 2 : length >= 8 ? 1 : 0);

export type MatchKind = "exact" | "typo" | "none";

export interface AnswerMatch {
  ok: boolean;
  kind: MatchKind;
}

/** Match an input against every answer a puzzle accepts. */
export const matchAnswer = (puzzle: { answer: string; accepts: readonly string[]; kind?: string }, input: string): AnswerMatch => {
  // A tapped answer is exact: on a list of options, one slipped key would be a different option, not a typo.
  const exact = puzzle.kind === "choice";
  const typed = compactAnswer(input);
  if (typed.length === 0) return { ok: false, kind: "none" };
  let typo = false;
  for (const candidate of [puzzle.answer, ...puzzle.accepts]) {
    const target = compactAnswer(candidate);
    if (target.length === 0) continue;
    if (typed === target) return { ok: true, kind: "exact" };
    if (!exact && editDistance(typed, target) <= typoAllowance(target.length)) typo = true;
  }
  return typo ? { ok: true, kind: "typo" } : { ok: false, kind: "none" };
};
