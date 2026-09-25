import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { verifyPassage } from "./data/verifyPassage";
import { BANDS } from "./data/passage";
import type { Passage, VocabQuestion } from "./data/passage";
import { baseOf, draftLocally, fromModel, joinSentences, mergeWords, pictureFor, withVocabPicture, type StoryInput } from "./draft";
import { PICTURE_KEYS } from "./Picture";
import { STARTER_PASSAGES } from "./data/starterPassages";

const story = (text: string, extra: Partial<StoryInput> = {}): StoryInput => ({ id: "t", title: "T", language: "en", band: "A", category: "Everyday", text, ...extra });
const asPassage = (p: Omit<Passage, "rev">): Passage => ({ ...p, rev: 1 });

/** The stories the design mock's generator was run on. */
const SEEDS = [
  "A brown horse lives on the farm.\nThe horse likes to eat green grass.\nA little sheep sleeps near the barn.\nThe farmer gives milk to the cat.",
  "Grandma bakes a big cake on Sunday.\nMy sister brings an apple from the tree.\nThe kitchen smells sweet and warm.\nWe drink cold milk and eat cake together.",
  "Sokha goes to the market with her mother.\nShe buys a mango and two bananas.\nThe mango is sweet.\nThey walk home under the hot sun.",
];

describe("the offline drafter", () => {
  it.each(SEEDS.map((s, i) => [i, s] as const))("drafts story %i into a book with no failing check", (_i, text) => {
    const base = baseOf(story(text));
    const book = fromModel(base, draftLocally(base, PICTURE_KEYS), PICTURE_KEYS);
    const v = verifyPassage(asPassage(book));
    expect(v.checks.filter((c) => c.status === "fail")).toEqual([]);
    expect(v.counts.spell).toBeLessThanOrEqual(BANDS[base.band].spell);
    expect(v.counts.comprehension).toBeLessThanOrEqual(BANDS[base.band].understand);
  });

  it("never asks a child to spell a name", () => {
    const base = baseOf(story(SEEDS[2]));
    const reply = draftLocally(base, PICTURE_KEYS);
    expect((reply.spell as Array<{ word: string }>).map((s) => s.word)).not.toContain("sokha");
  });

  it("uses only pictures the library has", () => {
    const base = baseOf(story(SEEDS[2]));
    for (const w of draftLocally(base, PICTURE_KEYS).words as Array<{ picture: string }>) expect(PICTURE_KEYS).toContain(w.picture);
  });
});

describe("fromModel — the model's reply is untrusted", () => {
  const base = baseOf(story(SEEDS[2]));

  it("keeps a well-formed reply", () => {
    const book = fromModel(base, {
      understand: [{ prompt: "What is sweet?", options: ["The market", "The mango", "The sun"], answer: 1, evidence: "s3" }],
      words: [{ word: "mango", picture: "mango" }],
      spell: [{ sentence: "s1", word: "market" }],
    }, PICTURE_KEYS);
    expect(book.questions.map((q) => q.kind)).toEqual(["comprehension", "vocab", "spell"]);
    expect(book.pictures.mango).toBe("mango");
    expect(book.picture).toBe("mango");
  });

  it("stops at the band's counts, however many valid ones the model sends", () => {
    // The drafter never exceeds the new 10-item section cap.
    const book = fromModel(base, {
      understand: [],
      words: [],
      spell: [
        { sentence: "s1", word: "market" },
        { sentence: "s2", word: "mango" },
        { sentence: "s2", word: "bananas" },
        { sentence: "s3", word: "sweet" },
      ],
    }, PICTURE_KEYS);
    const spell = book.questions.filter((q) => q.kind === "spell");
    expect(spell.length).toBeLessThanOrEqual(BANDS[base.band].spell);
    expect(verifyPassage(asPassage(book), { confirmedSplit: true }).countsMatchBand).toBe(false);
  });

  it("drops what it cannot trust", () => {
    const book = fromModel(base, {
      understand: [
        { prompt: "?", options: ["a", "b", "c"], answer: 1, evidence: "s9" },          // no such sentence
        { prompt: "?", options: ["a", "b"], answer: 0, evidence: "s1" },              // two options
        { prompt: "", options: ["a", "b", "c"], answer: 0, evidence: "s1" },          // no question
        { prompt: "?", options: ["a", "b", "c"], answer: 5, evidence: "s1" },          // answer off the end
      ],
      words: [
        { word: "mango", picture: "helicopter" },                                      // not a library picture
        { word: "zebra", picture: "cat" },                                             // not in the story
      ],
      spell: [
        { sentence: "s1", word: "mango" },                                             // not in that sentence
        { sentence: "s1", word: "Sokha's" },                                           // not letters
        { sentence: "s4", word: "a" },                                                 // not in that sentence
      ],
    }, PICTURE_KEYS);
    expect(book.questions).toEqual([]);
  });

  it("copes with a reply that is not the right shape at all", () => {
    expect(fromModel(base, { understand: "nope", words: null, spell: 7 } as never, PICTURE_KEYS).questions).toEqual([]);
  });

  it("puts the right picture among two the story does not use", () => {
    const book = fromModel(base, { words: [{ word: "mango", picture: "mango" }] }, PICTURE_KEYS);
    const q = book.questions[0];
    expect(q.kind === "vocab" && q.options[q.answer]).toBe("mango");
    expect(q.kind === "vocab" && q.options.filter((o) => o === "market" || o === "banana")).toEqual([]);
  });
});

describe("pictureFor and mergeWords", () => {
  it("finds a plural's picture", () => {
    expect(pictureFor("bananas", "en", PICTURE_KEYS)).toBe("banana");
    expect(pictureFor("puddles", "en", PICTURE_KEYS)).toBe("puddle");
    expect(pictureFor("sun", "en", PICTURE_KEYS)).toBeNull();
    expect(pictureFor("ស្វាយ", "km", PICTURE_KEYS)).toBe("mango");
  });

  it("joins two words and keeps the sentence text true", () => {
    const s = { id: "s1", text: "I love New York.", words: ["I", "love", "New", "York."] };
    expect(mergeWords(s, 2, "en")).toEqual({ id: "s1", text: "I love New York.", words: ["I", "love", "New York."] });
    expect(mergeWords(s, 3, "en")).toBe(s);
    expect(mergeWords({ ...s, audio: "s1.m4a", audioCues: [{ startMs: 0, endMs: 200 }] }, 2, "en").audioCues).toBeUndefined();
    const k = { id: "s1", text: "នាងទិញ", words: ["នាង", "ទិញ"] };
    expect(mergeWords(k, 0, "km").words).toEqual(["នាងទិញ"]);
  });
});

describe("the server's copy of the starter stories", () => {
  it("is byte-for-byte the same, so both checkers judge the same books", () => {
    for (const name of ["starter-market", "starter-rainy-day", "starter-market-km"]) {
      const here = readFileSync(resolve(__dirname, `data/passages/${name}.json`), "utf8");
      const there = readFileSync(resolve(__dirname, `../../server/tests/fixtures/library/${name}.json`), "utf8");
      expect(there).toBe(here);
    }
  });
});

describe("withVocabPicture — changing a picture question's pictures", () => {
  const MARKET = asPassage(structuredClone(STARTER_PASSAGES[0]));
  const vocab = MARKET.questions.find((q) => q.kind === "vocab")! as VocabQuestion;
  const failing = (p: Passage) =>
    [...new Set(verifyPassage(p, { confirmedSplit: true }).checks.filter((c) => c.status === "fail").map((c) => c.rule))].sort();

  const applied = (slot: number, key: string): Passage => {
    const next = withVocabPicture(vocab, MARKET.pictures, MARKET.language, slot, key);
    return { ...MARKET, pictures: next.pictures, questions: MARKET.questions.map((q) => (q.id === vocab.id ? next.question : q)) };
  };

  it("moves the word's own picture with the answer, so the story still declares it", () => {
    const p = applied(vocab.answer, "apple");
    const q = p.questions.find((x) => x.id === vocab.id)! as VocabQuestion;
    expect(q.options[q.answer]).toBe("apple");
    expect(p.pictures[vocab.word.toLowerCase()]).toBe("apple");
    expect(failing(p)).toEqual([]);
  });

  it("leaves the word's picture alone when a wrong one is changed", () => {
    const wrong = vocab.options.findIndex((_, i) => i !== vocab.answer);
    const p = applied(wrong, "apple");
    const q = p.questions.find((x) => x.id === vocab.id)! as VocabQuestion;
    expect(q.options[wrong]).toBe("apple");
    expect(q.options[q.answer]).toBe(vocab.options[vocab.answer]);
    expect(p.pictures).toEqual(MARKET.pictures);
    expect(failing(p)).toEqual([]);
  });

  it("swaps rather than duplicating when the picture is already one of the three", () => {
    const wrong = vocab.options.findIndex((_, i) => i !== vocab.answer);
    const p = applied(wrong, vocab.options[vocab.answer]);
    const q = p.questions.find((x) => x.id === vocab.id)! as VocabQuestion;
    expect(new Set(q.options).size).toBe(q.options.length);
    // The green mark follows the picture, not the slot: it is still the word's own.
    expect(q.options[q.answer]).toBe(p.pictures[vocab.word.toLowerCase()]);
    expect(failing(p)).toEqual([]);
  });
});

describe("joinSentences — a line that should never have been a sentence", () => {
  const book = () => asPassage(structuredClone(STARTER_PASSAGES[0]));

  it("joins a sentence to the one above it, and the words still re-join to the text", () => {
    const p = book();
    const [first, second] = p.sentences;
    const next = joinSentences(p, second.id);
    expect(next.sentences).toHaveLength(p.sentences.length - 1);
    expect(next.sentences[0].words).toEqual([...first.words, ...second.words]);
    // Rule 0 wants the words to re-join to the text, whatever the language joins with.
    expect(verifyPassage(next, { confirmedSplit: true }).checks.filter((c) => c.rule === 0)).toEqual([]);
  });

  it("re-points the questions that named the sentence that is gone", () => {
    const p = book();
    const gone = p.sentences[1];
    const kept = p.sentences[0];
    const next = joinSentences(p, gone.id);
    for (const q of next.questions) {
      if (q.kind === "comprehension") expect(q.evidence).not.toBe(gone.id);
      if (q.kind === "spell") expect(q.sentence).not.toBe(gone.id);
    }
    expect(next.questions.some((q) => (q.kind === "comprehension" && q.evidence === kept.id) || (q.kind === "spell" && q.sentence === kept.id))).toBe(true);
  });

  it("keeps one recording but never claims a stitched one, and keeps a picture from either half", () => {
    const p = book();
    p.sentences[0] = { ...p.sentences[0], audio: "a".repeat(64) };
    p.sentences[1] = { ...p.sentences[1], picture: "mango" };
    expect(joinSentences(p, p.sentences[1].id).sentences[0]).toMatchObject({ audio: "a".repeat(64), picture: "mango" });

    // Two clips cannot be stitched into one sentence, so neither is kept.
    p.sentences[1] = { ...p.sentences[1], audio: "b".repeat(64) };
    expect(joinSentences(p, p.sentences[1].id).sentences[0].audio).toBeUndefined();
  });

  it("leaves the first sentence and an unknown id alone", () => {
    const p = book();
    expect(joinSentences(p, p.sentences[0].id)).toBe(p);
    expect(joinSentences(p, "nope")).toBe(p);
  });
});
