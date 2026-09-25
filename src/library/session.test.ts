import { describe, expect, it } from "vitest";
import { STARTER_PASSAGES } from "./data/starterPassages";
import { SCORING_DEFAULTS } from "../lib/scoring";
import { LIBRARY_CONCEPT_NAMES, conceptFor, isFirstTry, itemId, minutesToRead, parentSummary, quizOf, reward, tally, taskKindOf, wordsToPractise, type Outcome } from "./session";

const [MARKET, RAINY, MARKET_KM] = STARTER_PASSAGES;
const clean = (part: Outcome["part"], id: string, word?: string): Outcome => ({ part, id, word, wrong: 0, hints: 0, reread: false });

describe("quizOf", () => {
  it("plays understand, then words, then spell — and nothing else", () => {
    const quiz = quizOf(MARKET);
    expect(quiz.map((q) => q.part)).toEqual(["understand", "understand", "words", "words", "spell", "spell", "spell"]);
  });

  it("gives every item a stable id, unique within the book", () => {
    for (const p of STARTER_PASSAGES) {
      const ids = quizOf(p).map((q) => itemId(p, q));
      expect(new Set(ids).size).toBe(ids.length);
      expect(ids.every((id) => id.startsWith(`${p.id}/`))).toBe(true);
    }
  });

  it("names each part's task kind so they never average together", () => {
    expect(new Set(["understand", "words", "spell"].map((p) => taskKindOf(p as Outcome["part"]))).size).toBe(3);
  });
});

describe("first try", () => {
  it("is spoiled by a wrong answer, a hint or reading the story again", () => {
    expect(isFirstTry(clean("understand", "q1"))).toBe(true);
    expect(isFirstTry({ ...clean("understand", "q1"), wrong: 1 })).toBe(false);
    expect(isFirstTry({ ...clean("understand", "q1"), hints: 1 })).toBe(false);
    expect(isFirstTry({ ...clean("understand", "q1"), reread: true })).toBe(false);
  });
});

describe("tally and words to practise", () => {
  const quiz = quizOf(MARKET);
  const outcomes: Outcome[] = [
    clean("understand", "q1"),
    { ...clean("understand", "q2"), wrong: 1 },
    clean("words", "q3", "banana"),
    { ...clean("words", "q4", "market"), hints: 2 },
    clean("spell", "sp1", "market"),
    { ...clean("spell", "sp2", "mango"), reread: true },
    clean("spell", "sp3", "sweet"),
  ];

  it("counts first tries per part against the part's size", () => {
    expect(tally(outcomes, quiz)).toEqual([
      { part: "understand", firstTry: 1, total: 2 },
      { part: "words", firstTry: 1, total: 2 },
      { part: "spell", firstTry: 2, total: 3 },
    ]);
  });

  it("lists each word that needed help once, in order", () => {
    expect(wordsToPractise(outcomes)).toEqual(["market", "mango"]);
  });

  it("tells a parent the same numbers the child saw", () => {
    expect(parentSummary(MARKET, outcomes, quiz)).toBe(
      "Read “At the Market” (English). Understood 1/2, matched 1/2, spelled 2/3 on the first try. Needs practice: market, mango.",
    );
  });

  it("says so when nothing needs practice", () => {
    const perfect = quiz.map((q) => clean(q.part, itemId(MARKET, q)));
    expect(parentSummary(MARKET, perfect, quiz)).toMatch(/Nothing needs practice\.$/);
  });

  it("names the language, so a Khmer book says Khmer", () => {
    expect(parentSummary(MARKET_KM, [], quizOf(MARKET_KM))).toMatch(/\(Khmer\)/);
  });
});

describe("reward", () => {
  const n = 7;
  const firstTries = (k: number): Outcome[] => Array.from({ length: n }, (_, i) => ({ ...clean("spell", `x${i}`), wrong: i < k ? 0 : 1 }));

  it("pays the full level for three stars", () => {
    expect(reward(firstTries(7), n, SCORING_DEFAULTS)).toMatchObject({ stars: 3, xp: SCORING_DEFAULTS.xpPerLevel });
  });

  it("uses the same star bands as lessons", () => {
    expect(reward(firstTries(5), n, SCORING_DEFAULTS).stars).toBe(2); // 71%
    expect(reward(firstTries(2), n, SCORING_DEFAULTS).stars).toBe(1); // 29%
    expect(reward(firstTries(5), n, SCORING_DEFAULTS).xp).toBe(Math.round(SCORING_DEFAULTS.xpPerLevel * SCORING_DEFAULTS.twoStarShare));
  });

  it("never divides by zero", () => {
    expect(reward([], 0, SCORING_DEFAULTS)).toMatchObject({ stars: 1, accuracy: 0 });
  });
});

describe("book facts", () => {
  it("files a book under its band's concept", () => {
    expect(conceptFor(MARKET.band)).toBe("read-and-answer");
    expect(conceptFor(RAINY.band)).toBe("read-and-answer-long");
  });

  it("never says a book takes zero minutes", () => {
    for (const p of STARTER_PASSAGES) expect(minutesToRead(p)).toBeGreaterThanOrEqual(1);
  });
});

describe("the parent report", () => {
  it("has a readable name for every concept a book can be filed under", () => {
    for (const band of ["A", "B"] as const) {
      const name = LIBRARY_CONCEPT_NAMES[conceptFor(band)];
      expect(name?.skill).toBe("Koda Library");
      expect(name?.lesson).toMatch(/story/);
    }
  });
});
