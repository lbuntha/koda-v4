import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { khmerProblem, normalizeKhmer, spellingUnits, unitLabel } from "./khmer";
import CASES from "./khmer-cases.json";

/**
 * The shared cases (khmer-cases.json) are the contract: the Python port
 * asserts the same file, and a byte-for-byte copy lives with the server tests.
 * Written as code points in the JSON, because two strings that look the same
 * are exactly what these rules are about.
 */

describe("normalizeKhmer — the keyboard's silent corrections", () => {
  it.each(CASES.normalize.map((c) => [c.why, c.in, c.out]))("%s", (_why, input, out) => {
    expect(normalizeKhmer(input)).toBe(out);
  });

  it("is idempotent: normal text stays normal", () => {
    for (const c of CASES.normalize) expect(normalizeKhmer(normalizeKhmer(c.in))).toBe(normalizeKhmer(c.in));
  });
});

describe("spellingUnits — how a Khmer class spells a word", () => {
  it.each(CASES.units.map((c) => [c.why, c.word, c.units]))("%s", (_why, word, units) => {
    expect(spellingUnits(word)).toEqual(units);
  });

  it("always rejoins to the word's normal form", () => {
    for (const c of CASES.units) expect(spellingUnits(c.word).join("")).toBe(normalizeKhmer(c.word));
  });

  it("draws a mark on a dotted circle and a consonant on its own", () => {
    expect(unitLabel("្វ")).toBe("◌្វ");
    expect(unitLabel("ស")).toBe("ស");
  });
});

describe("khmerProblem — what the keyboard beeps at", () => {
  it.each(CASES.problems.map((c) => [c.why, c.word, c.problem]))("%s", (_why, word, problem) => {
    expect(khmerProblem(word)).toBe(problem);
  });
});

describe("the server's copy of the cases", () => {
  it("is byte-for-byte the same file", () => {
    const here = readFileSync(resolve(__dirname, "khmer-cases.json"), "utf8");
    const there = readFileSync(resolve(__dirname, "../../../server/tests/fixtures/library/khmer-cases.json"), "utf8");
    expect(there).toBe(here);
  });
});
