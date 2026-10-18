import { describe, expect, it } from "vitest";
import { compactAnswer, editDistance, matchAnswer, normalizeAnswer, typoAllowance } from "./answer";

const cake = { answer: "Slice of cake", accepts: ["piece of cake"] };
const hotdog = { answer: "Hot dog", accepts: [] };

describe("normalizeAnswer", () => {
  it("ignores case, accents, apostrophes, punctuation and articles", () => {
    expect(normalizeAnswer("  The  Café!  ")).toBe("cafe");
    expect(normalizeAnswer("It's raining, cats & dogs")).toBe("its raining cats dogs");
    expect(normalizeAnswer("A piece of cake")).toBe("piece of cake");
  });

  it("leaves Khmer alone", () => {
    expect(normalizeAnswer("ព្រះអាទិត្យ")).toBe("ព្រះអាទិត្យ");
  });

  it("treats a word with and without its space as the same", () => {
    expect(compactAnswer("hot dog")).toBe(compactAnswer("hotdog"));
  });
});

describe("editDistance", () => {
  it("counts the keys between two words", () => {
    expect(editDistance("kitten", "sitting")).toBe(3);
    expect(editDistance("same", "same")).toBe(0);
    expect(editDistance("", "abc")).toBe(3);
  });
});

describe("typoAllowance", () => {
  it("forgives nothing on short answers, one slip on long ones, two on very long", () => {
    expect([3, 5, 6, 7, 8, 13, 14, 20].map(typoAllowance)).toEqual([0, 0, 0, 0, 1, 1, 2, 2]);
  });
});

describe("matchAnswer", () => {
  it("accepts the answer however it is spaced or cased", () => {
    expect(matchAnswer(hotdog, "HOTDOG")).toEqual({ ok: true, kind: "exact" });
    expect(matchAnswer(hotdog, "  hot   dog ")).toEqual({ ok: true, kind: "exact" });
  });

  it("accepts every listed alternative", () => {
    expect(matchAnswer(cake, "Piece of cake").ok).toBe(true);
    expect(matchAnswer(cake, "a slice of cake").ok).toBe(true);
  });

  it("forgives one slipped key on a long answer and says so", () => {
    expect(matchAnswer({ answer: "Honeymoon", accepts: [] }, "honeymon")).toEqual({ ok: true, kind: "typo" });
  });

  it("does not forgive a slip on a short answer, where one change is another word", () => {
    expect(matchAnswer({ answer: "Spain", accepts: [] }, "spail").ok).toBe(false);
    expect(matchAnswer(hotdog, "hat dog").ok).toBe(false);
  });

  it("never accepts an empty answer", () => {
    expect(matchAnswer(hotdog, "").ok).toBe(false);
    expect(matchAnswer(hotdog, "   !?  ").ok).toBe(false);
  });
});
