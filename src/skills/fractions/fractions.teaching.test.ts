import { describe, expect, it } from "vitest";

import { stripHints } from "./activities/FoldStrip";
import { lineHints } from "./activities/FractionLine";
import { millHints } from "./activities/EquivalenceMill";
import { compareHints } from "./activities/CompareBar";
import { mixedHints } from "./activities/MixedBoard";
import { addHints } from "./activities/AddStrip";
import { multiplyHints } from "./activities/AreaGrid";
import { buildStripQuestion, explainStrip, type StripMode } from "./internal/data/fractionStrip";
import { buildLineQuestion, explainLine, type LineMode } from "./internal/data/fractionLine";
import { buildMillQuestion, explainMill, type MillMode } from "./internal/data/fractionEquivalence";
import { buildCompareQuestion, explainCompare, type CompareMode } from "./internal/data/fractionCompare";
import { buildMixedQuestion, explainMixed, type MixedMode } from "./internal/data/fractionMixed";
import { buildAddQuestion, explainAdd, type AddMode } from "./internal/data/fractionAdd";
import { buildMultiplyQuestion, explainMultiply, type MultiplyMode } from "./internal/data/fractionMultiply";
import { skill } from ".";

/**
 * What a child actually reads: the hints, and the sentence after they answer.
 *
 * Nothing is spoken when a round opens in this skill — it is for readers — so
 * these two are the entire teaching surface outside the picture itself. That
 * raises the bar on both from "present" to "clear", and clear is a thing that
 * can be checked:
 *
 *   a ladder that repeats itself is a one-rung ladder with a longer wait
 *   a rung that names the answer has ended the question rather than helped
 *   "Correct" and "That is the answer" tell a child whether to feel good and
 *     nothing else — and the child who guessed right is left where they started
 *
 * Both of the last kind were shipped in this skill before anybody read them.
 */

interface Rendered {
  engine: string;
  mode: string;
  hints: string[];
  right: string;
  wrong: string;
  answer: string;
}

function everything(): Rendered[] {
  const out: Rendered[] = [];
  const add = (engine: string, mode: string, hints: string[], right: string, wrong: string, answer: string) =>
    out.push({ engine, mode, hints, right, wrong, answer });

  for (const m of ["equal_or_not", "name_unit", "which_whole", "build", "to_notation", "of_a_set"] as StripMode[]) {
    for (let i = 0; i < 5; i += 1) {
      const q = buildStripQuestion({ mode: m }, m, i);
      add("strip", m, stripHints(q), explainStrip(q, true), explainStrip(q, false), q.expected);
    }
  }
  for (const m of ["place_unit", "place_any", "read_point", "makes_one", "improper"] as LineMode[]) {
    for (let i = 0; i < 5; i += 1) {
      const q = buildLineQuestion({ mode: m }, m, i);
      add("numberline", m, lineHints(q), explainLine(q, true), explainLine(q, false), q.expected);
    }
  }
  for (const m of ["split", "two_names", "scale_up", "scale_down", "simplest"] as MillMode[]) {
    for (let i = 0; i < 5; i += 1) {
      const q = buildMillQuestion({ mode: m }, m, i);
      add("equivalence", m, millHints(q), explainMill(q, true), explainMill(q, false), q.expected);
    }
  }
  for (const m of [
    "same_denominator", "same_numerator", "different_wholes", "benchmark_half", "common_denominator",
  ] as CompareMode[]) {
    for (let i = 0; i < 5; i += 1) {
      const q = buildCompareQuestion({ mode: m }, m, i);
      add("compare", m, compareHints(q), explainCompare(q, true), explainCompare(q, false), q.expected);
    }
  }
  for (const m of ["to_mixed", "to_improper", "on_line"] as MixedMode[]) {
    for (let i = 0; i < 5; i += 1) {
      const q = buildMixedQuestion({ mode: m }, m, i);
      add("mixed", m, mixedHints(q), explainMixed(q, true), explainMixed(q, false), q.expected);
    }
  }
  for (const m of [
    "add_like", "subtract_like", "refute", "add_nested",
    "add_unlike", "subtract_unlike", "add_mixed", "subtract_mixed",
  ] as AddMode[]) {
    for (let i = 0; i < 5; i += 1) {
      const q = buildAddQuestion({ mode: m }, m, i);
      add("add", m, addHints(q), explainAdd(q, true), explainAdd(q, false), q.expected);
    }
  }
  for (const m of ["of_whole", "whole_times", "area_model", "simplify_first", "scaling"] as MultiplyMode[]) {
    for (let i = 0; i < 5; i += 1) {
      const q = buildMultiplyQuestion({ mode: m }, m, i);
      add("multiply", m, multiplyHints(q), explainMultiply(q, true), explainMultiply(q, false), q.expected);
    }
  }
  return out;
}

const ALL = everything();

/*
 * The list above is hand-written, which is a liability: an engine added without
 * a line here is an engine whose hints and explanations nobody reads. So the
 * list is checked against the lessons rather than trusted.
 */
describe("every technique a lesson uses is read here", () => {
  it("leaves no mode unwalked", () => {
    const walked = new Set(ALL.map((r) => `${r.engine}/${r.mode}`));
    for (const lesson of skill.lessons) {
      const q = (lesson.params as { question?: { mode?: string; modes?: string[] } })?.question;
      const engine = lesson.activity.split("/")[1];
      for (const mode of [q?.mode, ...(q?.modes ?? [])].filter(Boolean) as string[]) {
        expect(walked.has(`${engine}/${mode}`), `${lesson.id} uses ${engine}/${mode}, unread here`).toBe(true);
      }
    }
  });
});

describe("every technique has a hint ladder, and it climbs", () => {
  it("covers one mode per lesson, with nothing walked that no lesson uses", () => {
    // Counted from the curriculum rather than written down, because a hard
    // number here is a number somebody has to remember to change.
    const taught = new Set(
      skill.lessons.flatMap((lesson) => {
        const q = (lesson.params as { question?: { mode?: string; modes?: string[] } })?.question;
        const engine = lesson.activity.split("/")[1];
        return [q?.mode, ...(q?.modes ?? [])].filter(Boolean).map((m) => `${engine}/${m as string}`);
      }),
    );
    expect([...new Set(ALL.map((r) => `${r.engine}/${r.mode}`))].sort()).toEqual([...taught].sort());
  });

  it("gives two or three rungs, each a real sentence", () => {
    for (const r of ALL) {
      expect(r.hints.length, `${r.engine}/${r.mode}`).toBeGreaterThanOrEqual(2);
      expect(r.hints.length, `${r.engine}/${r.mode}`).toBeLessThanOrEqual(3);
      for (const rung of r.hints) {
        expect(rung.trim().split(/\s+/).length, `${r.engine}/${r.mode}: "${rung}"`).toBeGreaterThanOrEqual(4);
        expect(/[.?…]$/.test(rung.trim()), `${r.engine}/${r.mode}: "${rung}"`).toBe(true);
      }
    }
  });

  it("never repeats a rung", () => {
    for (const r of ALL) {
      expect(new Set(r.hints).size, `${r.engine}/${r.mode} repeats a rung`).toBe(r.hints.length);
    }
  });

  it("never says the same thing twice in different words", () => {
    for (const r of ALL) {
      for (let i = 1; i < r.hints.length; i += 1) {
        const a = new Set(r.hints[i - 1].toLowerCase().split(/\W+/).filter((w) => w.length > 4));
        const b = r.hints[i].toLowerCase().split(/\W+/).filter((w) => w.length > 4);
        if (a.size < 3 || b.length < 3) continue;
        const shared = b.filter((w) => a.has(w)).length / b.length;
        expect(shared, `${r.engine}/${r.mode} rungs ${i} and ${i + 1} restate each other`).toBeLessThan(0.7);
      }
    }
  });
});

describe("a hint helps without ending the question", () => {
  it("never hands over the answer outright", () => {
    for (const r of ALL) {
      for (const rung of r.hints) {
        expect(rung, `${r.engine}/${r.mode}: "${rung}"`).not.toMatch(
          new RegExp(`(the answer|it) is ${r.answer.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i"),
        );
      }
    }
  });

  it("uses no word a child has not met on screen", () => {
    // "Numerator" and "denominator" appear nowhere in this skill's lessons —
    // every one of them says "the top number" and "the bottom number".
    for (const r of ALL) {
      for (const rung of r.hints) {
        expect(rung.toLowerCase(), `${r.engine}/${r.mode}: "${rung}"`).not.toMatch(
          /numerator|denominator|reciprocal|improper fraction|vinculum/,
        );
      }
    }
  });
});

describe("the sentence after an answer explains, rather than judges", () => {
  it("says something, both when they are right and when they are not", () => {
    for (const r of ALL) {
      for (const [kind, text] of [["right", r.right], ["wrong", r.wrong]] as const) {
        expect(text.trim(), `${r.engine}/${r.mode} ${kind}`).not.toBe("");
        expect(text.trim().split(/\s+/).length, `${r.engine}/${r.mode} ${kind}: "${text}"`).toBeGreaterThanOrEqual(7);
      }
    }
  });

  it("never settles for telling them they were right", () => {
    /*
     * "That is the answer." and "That is where it sits." both shipped here.
     * They restate the verdict, which the tick already gave — and they are the
     * only teaching a child who guessed correctly will ever see.
     */
    const EMPTY = /^(that is (it|right|correct|the answer)|correct|well done|good job|yes)\W*$/i;
    for (const r of ALL) {
      expect(EMPTY.test(r.right.trim()), `${r.engine}/${r.mode}: "${r.right}"`).toBe(false);
      expect(EMPTY.test(r.wrong.trim()), `${r.engine}/${r.mode}: "${r.wrong}"`).toBe(false);
    }
  });

  it("says something different depending on whether they were right", () => {
    for (const r of ALL) {
      expect(r.right, `${r.engine}/${r.mode} says the same either way`).not.toBe(r.wrong);
    }
  });

  it("never spells a fraction name arithmetically", () => {
    /*
     * `${parts}th` produces "one 2th" and "12 12ths", and both shipped in copy
     * a child was meant to read. A fraction is a word before it is a notation:
     * "three quarters" is what they say out loud.
     */
    const ARITHMETIC = /\b(1|2|3|4|5|6|7|8|9|10|11|12)\s?ths?\b/;
    for (const r of ALL) {
      for (const text of [...r.hints, r.right, r.wrong]) {
        expect(ARITHMETIC.test(text), `${r.engine}/${r.mode}: "${text}"`).toBe(false);
      }
    }
  });

  it("writes English a child would not be corrected for", () => {
    // "a eighth" shipped in a hint. A child who reads the app's own English
    // badly does not trust the app's arithmetic either.
    for (const r of ALL) {
      for (const text of [...r.hints, r.right, r.wrong]) {
        expect(/\ba (eighth|eleventh)/i.test(text), `${r.engine}/${r.mode}: "${text}"`).toBe(false);
        expect(/\ban (half|third|quarter|fifth|sixth|seventh|ninth|tenth|twelfth)/i.test(text), `${r.engine}/${r.mode}: "${text}"`).toBe(false);
      }
    }
  });

  it("keeps the same plain vocabulary as the hints", () => {
    for (const r of ALL) {
      for (const text of [r.right, r.wrong]) {
        expect(text.toLowerCase(), `${r.engine}/${r.mode}: "${text}"`).not.toMatch(
          /numerator|denominator|reciprocal|vinculum/,
        );
      }
    }
  });
});
