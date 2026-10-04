/**
 * The eight checks a story passes before a person is asked to publish it.
 *
 * Plain code, no model. A model drafts a story's questions; this decides
 * whether they are fit to put in front of a child. It re-derives everything and
 * trusts nothing the draft claims about itself — the same rule as the question
 * generators elsewhere in Koda: correctness is judged independently of whatever
 * produced the answer.
 *
 * Rule 0 is not one of the eight. It is "is this even a passage": ids that
 * collide, an answer index off the end of its options, words that no longer
 * rejoin to their sentence. The eight checks assume it, so it is judged first.
 *
 *   1  The answer is in the story
 *   2  Wrong choices come from the story
 *   3  The right answer is not the longest
 *   4  Questions read no harder than the story        (needs a lexicon)
 *   5  Spelling words fit the ring and re-join
 *   6  No two questions share an answer or a sentence
 *   7  Recordings — optional, never a failure
 *   8  Khmer word splits are confirmed by a person
 *
 * Rule 4 says so when it could not run rather than passing quietly: a check
 * that was skipped and reported green is worse than no check.
 *
 * Matching questions are optional — a book needs none — but one that is there
 * is held to the same rules: its pairs are well formed (0), every answer is in
 * the story (1), its words are easy (4), and no two ask the same thing (6).
 */

import { BANDS, CHOICES, MATCH_MAX_PAIRS, MATCH_MAX_QUESTIONS, MATCH_MIN_PAIRS, meetsTarget, type Passage, type Question, type Sentence } from "./passage";
import { core, gapOf, sentenceText } from "./text";
import { SPELL_PROBLEM_TEXT, whyUnspellable } from "./tiles";

export type RuleId = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
export type Status = "pass" | "fail" | "skipped";

export const RULES: Readonly<Record<Exclude<RuleId, 0>, { title: string; detail: string }>> = {
  1: { title: "The answer is in the story", detail: "The right choice's key word is in its evidence sentence; a picture word is in the story." },
  2: { title: "Wrong choices come from the story", detail: "At least one wrong choice uses the story's own words; the rest are the same kind of thing." },
  3: { title: "The right answer is not the longest", detail: "Otherwise a child can pick it without reading." },
  4: { title: "Questions use easy words", detail: "Each question uses words from the story or the reading list." },
  5: { title: "Spelling words fit the ring and re-join", detail: "2–8 tiles, and the gapped sentence re-joins to the original." },
  6: { title: "No two questions share an answer or a sentence", detail: "Within one part." },
  7: { title: "Recordings (optional)", detail: "Record your own voice or generate a Gemini voice. Fully recorded pages can be read aloud." },
  8: { title: "Khmer word splits are confirmed by a person", detail: "The segmenter only proposes." },
};

export interface Check {
  rule: RuleId;
  /** The question id, or "story" for a check about the whole passage. */
  question: string;
  status: Status;
  message: string;
}

export interface RuleSummary {
  rule: Exclude<RuleId, 0>;
  title: string;
  status: Status;
  message: string;
}

export interface Verdict {
  checks: Check[];
  rules: RuleSummary[];
  counts: { comprehension: number; vocab: number; spell: number; match: number };
  /** At least 85% and no more than the requested number for each kind. */
  countsMatchBand: boolean;
  /** Publish-blocking failures. Rule 4 is advisory when enabled. */
  failures: number;
  publishable: boolean;
}

export interface VerifyOptions {
  /** A person has checked the word splits. Khmer needs this. */
  confirmedSplit?: boolean;
  /** "publish" also requires a recording for every sentence. */
  stage?: "draft" | "publish";
  /** Child-appropriate words, lower case. Rule 4 cannot run without it. */
  lexicon?: ReadonlySet<string>;
}

/** Words that carry no meaning of their own, so are never "the key word". */
const STOP = new Set(
  "the a an and is was were are to of in on at it he she they his her its with for from that this then so but or as by be had has have not all up down out into under over very we you i my your our their them him am do did does no yes if when while because".split(" "),
);
const words = (s: string) => s.toLowerCase().split(/[^\p{L}\p{M}]+/u).filter(Boolean);
/** First four letters of each meaningful word, so "raining" matches "rained". */
const stemsOf = (s: string) => words(s).filter((w) => !STOP.has(w) && [...w].length >= 3).map((w) => [...w].slice(0, 4).join(""));
/**
 * How long a choice looks. Khmer stacks its vowels, signs and subscript
 * consonants on one letter, so ប៊ូប៊ូ is two letters wide, not six code points.
 */
export const choiceLength = (s: string) => [...s.trim().normalize("NFC").replace(/\u17D2./gu, "").replace(/\p{M}/gu, "")].length;
/** Rule 3: the right choice is longer than every other — a child can pick it by its size. */
export const answerStandsOut = (options: readonly string[], answer: number) => {
  const lens = options.map(choiceLength);
  const top = Math.max(...lens);
  return lens[answer] === top && lens.filter((l) => l === top).length === 1;
};
/** A picture named for the word — "cat", or "banana" for "bananas". */
export const namesItself = (word: string, picture: string) => {
  const w = word.toLowerCase();
  return picture === w || (w.endsWith("es") && picture === w.slice(0, -2)) || (w.endsWith("s") && picture === w.slice(0, -1));
};

/** The Khmer block. Khmer writes without spaces, so `words` cannot find its words. */
const hasKhmer = (s: string) => /[ក-៿]/u.test(s);

/** Khmer function words — the job STOP does for English. */
const KHMER_STOP = new Set(
  "នៅ ថា ជា និង បាន ទៅ មក ក៏ ដែល គឺ នេះ នោះ ពី ឲ្យ ឱ្យ ហើយ តែ នឹង របស់ ដើម្បី ព្រោះ គេ វា ខ្ញុំ គាត់ អ្នក យើង ទាំង ណា ដល់ លើ ក្នុង".split(" "),
);

/** Long enough to mean something, and not a word every sentence uses anyway. */
const meaningful = (w: string) =>
  Boolean(w) && !STOP.has(w) && !KHMER_STOP.has(w) && [...w].length >= (hasKhmer(w) ? 2 : 3);

/**
 * The words of some sentences, as the author split them.
 *
 * For Khmer this is the only reliable split there is — it is the one rule 8
 * makes a person confirm, and nothing else in the file may re-derive it.
 */
const splitWords = (ss: readonly Sentence[]): string[] =>
  [...new Set(ss.flatMap((s) => s.words.map((w) => core(w).toLowerCase())))].filter(meaningful);

/**
 * Whether a choice draws on the words of the story, or of one sentence of it.
 *
 * Two scripts, two ways of asking. English splits on spaces, so stems answer
 * it and "raining" still answers for "rained". Khmer does not: `words` hands
 * back a whole clause as a single token, so a four-letter stem only ever sees
 * that clause's opening. A distractor that shared មិនឃើញ in the middle — which
 * is exactly how a good Khmer distractor is built — read as story-free, and
 * rule 2 failed honest questions no author could fix. For text in a script
 * that writes without spaces, the source's own confirmed words are looked for
 * inside the choice instead.
 */
const drawsOn = (text: string, sourceText: string, sourceWords: readonly string[]): boolean =>
  stemsOf(text).some((st) => sourceText.includes(st)) ||
  (hasKhmer(text) && sourceWords.some((w) => text.includes(w)));

export function verifyPassage(p: Passage, opts: VerifyOptions = {}): Verdict {
  const checks: Check[] = [];
  const add = (rule: RuleId, question: string, ok: boolean | "skipped", message: string) =>
    checks.push({ rule, question, status: ok === "skipped" ? "skipped" : ok ? "pass" : "fail", message });

  /* ---- rule 0: is this a passage --------------------------------------- */
  const sIds = new Set<string>();
  for (const s of p.sentences) {
    if (sIds.has(s.id)) add(0, "story", false, `two sentences are called ${s.id}`);
    sIds.add(s.id);
    if (!s.words.length || s.words.some((w) => !w.trim())) add(0, s.id, false, "the sentence has an empty word");
    else if (s.text !== sentenceText(s.words, p.language)) add(0, s.id, false, "the words no longer rejoin to the sentence text");
  }
  if (!p.sentences.length) add(0, "story", false, "the story has no sentences");
  if (!p.title.trim()) add(0, "story", false, "the story has no title");

  const qIds = new Set<string>();
  for (const q of p.questions) {
    if (qIds.has(q.id)) add(0, q.id, false, "two questions share this id");
    qIds.add(q.id);
    if (q.kind === "match") {
      const n = q.pairs.length;
      if (n < MATCH_MIN_PAIRS || n > MATCH_MAX_PAIRS) add(0, q.id, false, `needs ${MATCH_MIN_PAIRS}–${MATCH_MAX_PAIRS} pairs, has ${n}`);
      if (q.pairs.some((pr) => !pr.left.trim() || !pr.right.trim())) add(0, q.id, false, "every pair needs both sides filled in");
      // Empty sides are the line above's problem; only what is written can repeat.
      const alike = (side: "left" | "right") => {
        const said = q.pairs.map((pr) => pr[side].trim().toLowerCase()).filter(Boolean);
        return new Set(said).size !== said.length;
      };
      if (alike("left") || alike("right")) add(0, q.id, false, "two pairs say the same thing — a child could not tell which goes where");
    } else if (q.kind !== "spell") {
      if (q.options.length !== CHOICES) add(0, q.id, false, `needs exactly ${CHOICES} choices`);
      if (!(q.answer >= 0 && q.answer < q.options.length)) add(0, q.id, false, "the answer index is outside the choices");
      const seen = new Set(q.options.map((o) => o.trim().toLowerCase()));
      if (seen.size !== q.options.length || seen.has("")) add(0, q.id, false, "the choices are not all different and non-empty");
    }
  }

  const sentence = (id: string) => p.sentences.find((s) => s.id === id);
  const storyText = p.sentences.map((s) => s.text).join(" ").toLowerCase();
  const storyWords = new Set(words(storyText));
  const storyStems = new Set(stemsOf(storyText));
  /** The story's own splits, for the scripts a word regex cannot read. */
  const storySplit = splitWords(p.sentences);
  const storyTokens = new Set(p.sentences.flatMap((s) => s.words.map((t) => core(t).toLowerCase())));
  const confirmed = p.confirmedPictures ?? {};
  const usable = (q: Question) => q.kind === "spell" || q.kind === "match" || (q.answer >= 0 && q.answer < q.options.length);

  /* ---- rules 1, 2, 3, 4, 5 -------------------------------------------- */
  for (const q of p.questions.filter(usable)) {
    if (q.kind === "comprehension") {
      const ev = sentence(q.evidence);
      const answer = q.options[q.answer];
      if (!ev) add(1, q.id, false, `evidence ${q.evidence} does not exist`);
      else {
        const hit = drawsOn(answer, ev.text.toLowerCase(), splitWords([ev]));
        add(1, q.id, hit, hit ? `the answer's key word is in ${ev.id}` : `the answer's key word is not in ${ev.id}`);
      }

      const wrong = q.options.filter((_, i) => i !== q.answer);
      const fromStory = wrong.filter((o) => drawsOn(o, storyText, storySplit)).length;
      add(2, q.id, fromStory >= 1,
        `${fromStory} of ${wrong.length} wrong choices use the story's words` +
          (fromStory === 0 ? " — a child can rule them out without reading" : fromStory < wrong.length ? " — a person confirms the rest" : ""));

      const longest = answerStandsOut(q.options, q.answer);
      add(3, q.id, !longest, longest ? "the right answer is the longest — pickable without reading" : "the right answer is not the longest");
    }

    if (q.kind === "vocab") {
      const expected = p.pictures[q.word.toLowerCase()] ?? p.pictures[q.word];
      // A whole word, or its plural — "cat" is not in "catch". Khmer has no
      // spaces to find a whole word by, so there the text is searched.
      const w = q.word.toLowerCase();
      const inStory = hasKhmer(w) ? storyText.includes(w) : [w, `${w}s`, `${w}es`].some((x) => storyTokens.has(x));
      if (!expected) add(1, q.id, false, `no picture is declared for “${q.word}”`);
      else if (!inStory) add(1, q.id, false, `“${q.word}” is not in the story`);
      else if (q.options[q.answer] !== expected) add(1, q.id, false, `the right picture should be “${expected}”`);
      // A declared picture only says the question agrees with itself; whether
      // the drawing shows the word takes its name, or a person looking at it.
      else if (!namesItself(q.word, expected) && (confirmed[q.word] ?? confirmed[q.word.toLowerCase()]) !== expected)
        add(1, q.id, false, `confirm the picture “${expected}” shows “${q.word}”`);
      else add(1, q.id, true, "the word is in the story and its picture matches");
    }

    if (q.kind === "match") {
      // Rule 1: each answer is in its sentence, or in the story when no sentence is named.
      const missing = q.pairs.filter((pr) => {
        if (!pr.right.trim()) return false;
        if (!pr.evidence) return !drawsOn(pr.right, storyText, storySplit);
        const ev = sentence(pr.evidence);
        return !ev || !drawsOn(pr.right, ev.text.toLowerCase(), splitWords([ev]));
      });
      const badEvidence = q.pairs.filter((pr) => pr.evidence && !sentence(pr.evidence));
      add(1, q.id, missing.length === 0,
        badEvidence.length ? `a pair points at a sentence that does not exist (${badEvidence.map((pr) => pr.evidence).join(", ")})`
        : missing.length ? `not in the story: ${missing.slice(0, 2).map((pr) => `“${pr.right}”`).join(", ")}`
        : "every answer is in the story");
    }

    if (q.kind === "spell") {
      const s = sentence(q.sentence);
      const gap = s && gapOf(s, q.word, p.language);
      if (!s) add(5, q.id, false, `sentence ${q.sentence} does not exist`);
      else if (!gap) add(5, q.id, false, `“${q.word}” is not a word of ${s.id}`);
      else {
        const why = whyUnspellable(q.word, p.language);
        const rejoins = gap.text.replace("___", gap.original) === s.text;
        add(5, q.id, !why && rejoins, why ? `cannot be spelled: ${SPELL_PROBLEM_TEXT[why]}` : rejoins ? "fits the ring and the gapped sentence re-joins" : "the gapped sentence does NOT re-join");
      }
    }
  }

  // Rule 4 runs on the text a child reads. An empty question is wrong with or
  // without a lexicon; a hard word can only be judged with one.
  for (const q of p.questions.filter((x) => x.kind !== "spell")) {
    if (!q.prompt.trim()) add(4, q.id, false, "the question has no text");
  }
  if (opts.lexicon) {
    const lex = opts.lexicon;
    for (const q of p.questions) {
      if (q.kind === "spell") continue;
      // A matching set's instruction is the same fixed sentence in every book, so only its pairs are read.
      const text = q.kind === "comprehension" ? [q.prompt, ...q.options].join(" ") : q.kind === "match" ? q.pairs.flatMap((pr) => [pr.left, pr.right]).join(" ") : q.prompt;
      const hard = [...new Set(words(text).filter((w) => !lex.has(w) && !storyWords.has(w) && !stemsOf(w).some((stem) => storyStems.has(stem))))];
      add(4, q.id, hard.length === 0, hard.length ? `not in the story or reading list: ${hard.slice(0, 3).join(", ")}` : "every word is in the story or reading list");
    }
  } else {
    add(4, "story", "skipped", "the reading list is not available — check skipped");
  }

  /* ---- rule 6: no repeats within a part -------------------------------- */
  const parts: Array<[Question["kind"], (q: Question) => string, (q: Question) => string | null]> = [
    ["comprehension", (q) => (q.kind === "comprehension" ? (q.options[q.answer] ?? "").toLowerCase() : ""), (q) => (q.kind === "comprehension" ? q.evidence : null)],
    ["vocab", (q) => (q.kind === "vocab" ? q.word.toLowerCase() : ""), () => null],
    ["spell", (q) => (q.kind === "spell" ? q.word.toLowerCase() : ""), (q) => (q.kind === "spell" ? q.sentence : null)],
  ];
  for (const [kind, answerOf, sentenceOf] of parts) {
    const list = p.questions.filter((q) => q.kind === kind);
    for (const q of list) {
      const dup = list.some((o) => o !== q && (answerOf(o) === answerOf(q) || (sentenceOf(q) !== null && sentenceOf(o) === sentenceOf(q))));
      add(6, q.id, !dup, dup ? "shares its answer or sentence with another question in this part" : "unique answer and sentence in this part");
    }
  }
  // Matching: the same question asked in two sets is one question twice.
  const matches = p.questions.filter((q) => q.kind === "match");
  const leftsOf = (q: Question) => (q.kind === "match" ? q.pairs.map((pr) => pr.left.trim().toLowerCase()).filter(Boolean) : []);
  for (const q of matches) {
    const mine = new Set(leftsOf(q));
    const shared = matches.some((o) => o !== q && leftsOf(o).some((l) => mine.has(l)));
    add(6, q.id, !shared, shared ? "asks a question another matching set already asks" : "no question repeated across matching sets");
  }
  if (matches.length > MATCH_MAX_QUESTIONS) add(0, "story", false, `at most ${MATCH_MAX_QUESTIONS} matching questions`);

  /* ---- rule 7: recordings — optional ----------------------------------- */
  // Never a failure: a book without recordings remains readable as text.
  // Whether the clips a book points at exist is the server's check on publish.
  const recorded = p.sentences.filter((s) => s.audio).length;
  add(7, "story", true, `${recorded} of ${p.sentences.length} sentences recorded (recordings are optional)`);

  /* ---- rule 8: a person confirmed the split ---------------------------- */
  add(8, "story", p.language !== "km" || !!opts.confirmedSplit,
    p.language !== "km" ? "English splits on spaces — nothing to confirm" : opts.confirmedSplit ? "a person confirmed the split" : "not confirmed yet");

  /* ---- roll up --------------------------------------------------------- */
  const rules = (Object.keys(RULES) as unknown as Array<Exclude<RuleId, 0>>).map((k) => {
    const rule = Number(k) as Exclude<RuleId, 0>;
    const list = checks.filter((c) => c.rule === rule);
    const bad = list.filter((c) => c.status === "fail");
    const skipped = list.find((c) => c.status === "skipped");
    const status: Status = bad.length ? "fail" : skipped ? "skipped" : "pass";
    const message = bad.length
      ? bad.slice(0, 2).map((c) => `${c.question}: ${c.message}`).join(" · ")
      : skipped ? skipped.message : !list.length ? "nothing to check" : rule >= 7 ? list[0].message : `all ${list.length} pass`;
    return { rule, title: RULES[rule].title, status, message };
  });

  const counts = {
    comprehension: p.questions.filter((q) => q.kind === "comprehension").length,
    vocab: p.questions.filter((q) => q.kind === "vocab").length,
    spell: p.questions.filter((q) => q.kind === "spell").length,
    // Part of `countsMatchBand` only when the book sets a matching target.
    match: p.questions.filter((q) => q.kind === "match").length,
  };
  const band = p.questionCounts ?? BANDS[p.band];
  const countsMatchBand = !!band &&
    meetsTarget(counts.comprehension, band.understand) &&
    meetsTarget(counts.vocab, band.words) &&
    meetsTarget(counts.spell, band.spell) &&
    // Matching counts only once a book asks for it; older books leave it optional.
    (band.match === undefined || meetsTarget(counts.match, band.match));
  // Reading-level feedback is useful in Review, but it is optional and must
  // never prevent an author from publishing a book.
  const failures = checks.filter((c) => c.status === "fail" && c.rule !== 4).length;

  return { checks, rules, counts, countsMatchBand, failures, publishable: failures === 0 && countsMatchBand };
}
