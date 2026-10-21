import { describe, expect, it } from "vitest";
import { matchAnswer } from "../answer";
import { playableIn } from "../localize";
import { KHMER_PLAY } from "./khmerplay";

const KHMER_SCRIPT = /^[ក-៿]+$/u;

describe("the Khmer puzzles for Khmer players", () => {
  it("are written in Khmer, for the Khmer topics they belong to, and not shown to English players", () => {
    expect(KHMER_PLAY.length).toBeGreaterThanOrEqual(80);
    for (const p of KHMER_PLAY) {
      expect(p.answer, p.id).toMatch(KHMER_SCRIPT);
      expect(p.onlyIn, p.id).toBe("km");
      expect(playableIn(p, "km"), p.id).toBe(true);
      expect(playableIn(p, "en"), p.id).toBe(false);
    }
    expect(new Set(KHMER_PLAY.map((p) => p.id)).size).toBe(KHMER_PLAY.length);
  });

  it("are the joined words: the answer is the Khmer words of its pieces put together", () => {
    for (const p of KHMER_PLAY) {
      const parts = p.pieces.flatMap((x) => (x.kind === "word" ? [x.text] : x.kind === "icon" ? [x.name] : []));
      expect(parts.join(""), p.id).toBe(p.answer);
    }
  });

  it("take their own answer however it is spaced", () => {
    for (const p of KHMER_PLAY) {
      expect(matchAnswer(p, p.answer).ok, p.id).toBe(true);
      expect(matchAnswer(p, ` ${p.answer} `).ok, p.id).toBe(true);
    }
  });
});
