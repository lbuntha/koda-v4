import { describe, expect, it } from "vitest";
import { matchAnswer } from "../answer";
import { KHMER } from "./khmer";

const KHMER_SCRIPT = /^[ក-៿\s]+$/u;

describe("the Khmer words pack", () => {
  it("is written in Khmer script, with an id that is not blank", () => {
    for (const p of KHMER) {
      expect(p.answer, p.id).toMatch(KHMER_SCRIPT);
      for (const a of p.accepts) expect(a, p.id).toMatch(KHMER_SCRIPT);
      expect(p.id.length, p.id).toBeGreaterThan("khmer-".length);
    }
    expect(new Set(KHMER.map((p) => p.id)).size).toBe(KHMER.length);
  });

  it("takes its own answer, and every other spelling it lists, however it is spaced", () => {
    for (const p of KHMER) {
      for (const a of [p.answer, ...p.accepts]) {
        expect(matchAnswer(p, a).ok, `${p.id}: ${a}`).toBe(true);
        expect(matchAnswer(p, ` ${a} `).ok).toBe(true);
      }
    }
  });

  it("does not take another puzzle's answer", () => {
    const water = KHMER.find((p) => p.id === "khmer-water")!;
    const fire = KHMER.find((p) => p.id === "khmer-fire")!;
    expect(matchAnswer(water, fire.answer).ok).toBe(false);
  });

  it("keeps pictures and names for the early readers it is for", () => {
    expect(KHMER.length).toBeGreaterThanOrEqual(30);
    for (const p of KHMER) expect(p.ages[0], p.id).toBeLessThanOrEqual(9);
  });
});
