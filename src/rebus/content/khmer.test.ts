import { describe, expect, it } from "vitest";
import { matchAnswer } from "../answer";
import { localizePuzzle } from "../localize";
import { KHMER } from "./khmer";

const KHMER_SCRIPT = /^[ក-៿\s]+$/u;

describe("the Khmer words, filed under their topics", () => {
  it("are in both languages: an English answer, and a Khmer one in Khmer script", () => {
    for (const p of KHMER) {
      expect(p.answer, p.id).not.toMatch(/[ក-៿]/u);
      expect(p.km?.answer, p.id).toMatch(KHMER_SCRIPT);
      expect(p.km?.explanation, p.id).toBeTruthy();
      for (const a of p.accepts) expect(a, p.id).toMatch(/\S/);
      expect(p.id.length, p.id).toBeGreaterThan("khmer-".length);
      expect(p.category, p.id).not.toBe("khmer");
    }
    expect(new Set(KHMER.map((p) => p.id)).size).toBe(KHMER.length);
  });

  it("take the English answer and the Khmer one in either language, however it is spaced", () => {
    for (const p of KHMER) {
      for (const language of ["en", "km"]) {
        const view = localizePuzzle(p, language);
        for (const a of [p.answer, p.km?.answer ?? "", ...p.accepts]) {
          expect(matchAnswer(view, a).ok, `${p.id} (${language}): ${a}`).toBe(true);
          expect(matchAnswer(view, ` ${a} `).ok).toBe(true);
        }
      }
    }
  });

  it("show the Khmer answer in Khmer and the English one in English", () => {
    const dog = KHMER.find((p) => p.id === "khmer-dog")!;
    expect(localizePuzzle(dog, "en").answer).toBe("dog");
    expect(localizePuzzle(dog, "km").answer).toBe("ឆ្កែ");
  });

  it("does not take another puzzle's answer", () => {
    const water = KHMER.find((p) => p.id === "khmer-water")!;
    const fire = KHMER.find((p) => p.id === "khmer-fire")!;
    expect(matchAnswer(water, fire.answer).ok).toBe(false);
    expect(matchAnswer(water, fire.km?.answer ?? "").ok).toBe(false);
  });

  it("keeps pictures and names for the early readers it is for", () => {
    expect(KHMER.length).toBeGreaterThanOrEqual(30);
    for (const p of KHMER) expect(p.ages[0], p.id).toBeLessThanOrEqual(9);
  });
});
