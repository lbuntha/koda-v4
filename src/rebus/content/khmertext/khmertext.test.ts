import { describe, expect, it } from "vitest";
import { OFFICIAL_PUZZLES } from "../index";
import { CATEGORIES_WITH_KHMER_TEXT, khmerTextIds, khmerTextOf } from "./index";

describe("Khmer for the picture puzzles", () => {
  it("is written for puzzles that exist", () => {
    const ids = new Set(OFFICIAL_PUZZLES.map((p) => p.id));
    expect(khmerTextIds().filter((id) => !ids.has(id))).toEqual([]);
  });

  it("covers every puzzle in the categories that are done", () => {
    for (const category of CATEGORIES_WITH_KHMER_TEXT) {
      const missing = OFFICIAL_PUZZLES.filter((p) => p.category === category && !p.onlyIn && !p.km?.explanation).map((p) => p.id);
      expect(missing, category).toEqual([]);
    }
  });

  it("is in Khmer script, and adds only Khmer spellings to what a child may type", () => {
    for (const p of OFFICIAL_PUZZLES.filter((x) => khmerTextIds().includes(x.id))) {
      expect(p.km?.explanation, p.id).toMatch(/[ក-៿]/u);
      for (const a of khmerTextOf(p.id)?.accepts ?? []) expect(a, p.id).toMatch(/[ក-៿]/u);
    }
  });
});
