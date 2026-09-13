import { describe, expect, it } from "vitest";

import { trayHints } from "./activities/ShareTray";
import { arrayHints } from "./activities/ArrayDivide";
import { lineHints } from "./activities/HopBack";
import { factHints } from "./activities/FactDeck";
import { remainderHints } from "./activities/RemainderYard";
import { placeHints } from "./activities/PlaceValueDesk";
import { chunkHints } from "./activities/ChunkPad";
import { columnHints } from "./activities/DivisionPad";
import { factorHints } from "./activities/FactorLab";
import { estimateHints } from "./activities/EstimateDial";
import { storyHints } from "./activities/StoryBoard";
import { buildTrayQuestion, type ShareMode } from "./internal/data/divisionTray";
import { buildArrayQuestion, type ArrayMode } from "./internal/data/divisionArray";
import { buildLineQuestion, type LineMode } from "./internal/data/divisionLine";
import { buildFactQuestion, type FactMode } from "./internal/data/divisionFacts";
import { buildRemainderQuestion, type RemainderMode } from "./internal/data/divisionRemainder";
import { buildPlaceQuestion, type PlaceMode } from "./internal/data/divisionPlace";
import { buildChunkQuestion, type ChunkMode } from "./internal/data/divisionChunk";
import { buildColumnQuestion, type ColumnMode } from "./internal/data/divisionColumn";
import { buildFactorQuestion, type FactorMode } from "./internal/data/divisionFactors";
import { buildEstimateQuestion, type EstimateMode } from "./internal/data/divisionEstimate";
import { buildStoryQuestion, type StoryMode } from "./internal/data/divisionStory";

/**
 * The hint ladder is the only support this skill has left.
 *
 * Nothing is read aloud when a round opens — this is a skill for readers — so a
 * child who is stuck has the hint and nothing else. That raises the bar on it
 * from "present" to "clear", and these are the ways it silently stops being
 * clear: a rung that repeats the one before it, a ladder shared between modes
 * that go wrong in different places, or a rung that simply states the answer.
 */

interface Ladder {
  engine: string;
  mode: string;
  hints: string[];
  answer: number;
  dividend: number;
  divisor: number;
}

function everyLadder(): Ladder[] {
  const out: Ladder[] = [];
  const push = (engine: string, mode: string, hints: string[], q: { quotient?: number; answer?: number; dividend?: number; divisor?: number; value?: number }) =>
    out.push({
      engine,
      mode,
      hints,
      answer: q.answer ?? q.quotient ?? 0,
      dividend: q.dividend ?? q.value ?? 0,
      divisor: q.divisor ?? 0,
    });

  for (const m of ["share_out", "group_by_size", "which_meaning", "to_equation", "halve", "identity", "zero_rules", "see_leftover"] as ShareMode[]) {
    for (let i = 0; i < 6; i += 1) {
      const q = buildTrayQuestion({ mode: m }, m, i);
      push("share", m, trayHints(q), q);
    }
  }
  for (const m of ["total_and_side", "two_divisions", "partial_row"] as ArrayMode[]) {
    for (let i = 0; i < 6; i += 1) {
      const q = buildArrayQuestion({ mode: m }, m, i);
      push("array", m, arrayHints(q), q);
    }
  }
  for (const m of ["back_to_zero", "count_hops", "forward_to_total"] as LineMode[]) {
    for (let i = 0; i < 6; i += 1) {
      const q = buildLineQuestion({ mode: m }, m, i);
      push("numberline", m, lineHints(q), q);
    }
  }
  for (const m of ["family", "table_divide", "missing_factor", "easy_divisors", "repeated_halving", "known_multiple", "known_fact"] as FactMode[]) {
    for (let i = 0; i < 6; i += 1) {
      const q = buildFactQuestion({ mode: m }, m, i);
      push("facts", m, factHints(q), q);
    }
  }
  for (const m of ["record", "too_big", "interpret", "choose_form"] as RemainderMode[]) {
    for (let i = 0; i < 6; i += 1) {
      const q = buildRemainderQuestion({ mode: m }, m, i);
      push("remainder", m, remainderHints(q), q);
    }
  }
  for (const m of ["tens_quotient", "scale_down", "tens_into_tens", "split_exact", "split_exchange"] as PlaceMode[]) {
    for (let i = 0; i < 6; i += 1) {
      const q = buildPlaceQuestion({ mode: m }, m, i);
      push("chart", m, placeHints(q), q);
    }
  }
  for (const m of ["chunks", "big_chunks"] as ChunkMode[]) {
    for (let i = 0; i < 6; i += 1) {
      const q = buildChunkQuestion({ mode: m }, m, i);
      push("chunk", m, chunkHints(q), q);
    }
  }
  for (const m of ["short_exact", "short_exchange", "short_remainder", "zero_digit", "long_exact", "long_remainder", "decimal_tail"] as ColumnMode[]) {
    for (let i = 0; i < 6; i += 1) {
      const q = buildColumnQuestion({ mode: m }, m, i);
      push("column", m, columnHints(q), q);
    }
  }
  for (const m of ["last_digit", "digit_sum", "combined_test", "factor_pairs", "common_factors", "prime_factors"] as FactorMode[]) {
    for (let i = 0; i < 6; i += 1) {
      const q = buildFactorQuestion({ mode: m }, m, i);
      push("factors", m, factorHints(q), q);
    }
  }
  for (const m of ["compatible", "reasonable", "check_back"] as EstimateMode[]) {
    for (let i = 0; i < 6; i += 1) {
      const q = buildEstimateQuestion({ mode: m }, m, i);
      push("estimate", m, estimateHints(q), q);
    }
  }
  for (const m of ["size_unknown", "count_unknown", "remainder_context", "unit_rate", "times_comparison", "multi_step", "mean"] as StoryMode[]) {
    for (let i = 0; i < 6; i += 1) {
      const q = buildStoryQuestion({ mode: m }, m, i);
      push("story", m, storyHints(q), q);
    }
  }
  return out;
}

const LADDERS = everyLadder();

describe("every mode has a ladder", () => {
  it("covers all fifty-five modes", () => {
    const modes = new Set(LADDERS.map((l) => `${l.engine}/${l.mode}`));
    expect(modes.size).toBe(55);
  });

  it("gives every one of them at least two rungs", () => {
    for (const l of LADDERS) {
      expect(l.hints.length, `${l.engine}/${l.mode}`).toBeGreaterThanOrEqual(2);
      expect(l.hints.length, `${l.engine}/${l.mode}`).toBeLessThanOrEqual(3);
    }
  });

  it("writes every rung as a real sentence", () => {
    for (const l of LADDERS) {
      for (const rung of l.hints) {
        expect(rung.trim(), `${l.engine}/${l.mode}`).not.toBe("");
        // A sentence rather than a label. Counted in words, not characters:
        // "40 is 4 tens." is thirteen characters and a perfectly good rung,
        // and a character floor just picks fights with short true sentences.
        expect(
          rung.trim().split(/\s+/).length,
          `${l.engine}/${l.mode}: "${rung}"`,
        ).toBeGreaterThanOrEqual(3);
        // An ellipsis closes a counting sequence — "9, 18, 27…" — as properly
        // as a full stop does.
        expect(
          /[.?…]$/.test(rung.trim()),
          `${l.engine}/${l.mode}: "${rung}"`,
        ).toBe(true);
      }
    }
  });
});

describe("a ladder climbs", () => {
  it("never repeats a rung", () => {
    for (const l of LADDERS) {
      expect(new Set(l.hints).size, `${l.engine}/${l.mode} repeats a rung`).toBe(l.hints.length);
    }
  });

  it("never says the same thing twice in different words", () => {
    // Cheap proxy for a restatement: two rungs sharing most of their words.
    for (const l of LADDERS) {
      for (let i = 1; i < l.hints.length; i += 1) {
        const a = new Set(l.hints[i - 1].toLowerCase().split(/\W+/).filter((w) => w.length > 4));
        const b = l.hints[i].toLowerCase().split(/\W+/).filter((w) => w.length > 4);
        // Below three long words the proxy is noise: "what is left over goes in
        // the box" shares only "plate" with the rung before it and would score
        // 1.0 on a single token.
        if (a.size < 3 || b.length < 3) continue;
        const shared = b.filter((w) => a.has(w)).length / b.length;
        expect(shared, `${l.engine}/${l.mode} rungs ${i} and ${i + 1} restate each other`).toBeLessThan(0.7);
      }
    }
  });
});

describe("modes that go wrong differently get different ladders", () => {
  it("gives the seven written-method modes seven distinct ladders", () => {
    const byMode = new Map<string, string>();
    for (const l of LADDERS.filter((x) => x.engine === "column")) {
      byMode.set(l.mode, l.hints.join(" | ").replace(/\d+/g, "N"));
    }
    // Long division with and without a remainder share their first two rungs
    // and differ on the third, which is the honest relationship between them.
    expect(new Set(byMode.values()).size).toBe(7);
  });

  it("does not hand `short_exact` advice about a carry it never has", () => {
    for (const l of LADDERS.filter((x) => x.engine === "column" && x.mode === "short_exact")) {
      const text = l.hints.join(" ").toLowerCase();
      expect(text, "short_exact mentions carrying").not.toMatch(/carr(y|ied|ies)|left over|leftover/);
    }
  });

  it("gives halving its own ladder, not the sharing one", () => {
    const halve = LADDERS.find((l) => l.mode === "halve");
    const share = LADDERS.find((l) => l.mode === "share_out");
    expect(halve?.hints.join(" ")).not.toBe(share?.hints.join(" "));
    expect(halve?.hints.join(" ").toLowerCase()).toContain("doubl");
  });
});

describe("a hint never simply states the answer", () => {
  /*
   * The top rung is allowed to be worked — it is the last thing before a child
   * gives up — but none of them may hand over the number on its own. Checked
   * against the answer as a standalone token so that "40" in "ten 4s is 40"
   * (a landmark) does not trip while "the answer is 8" would.
   */
  it("never writes the answer as the answer", () => {
    for (const l of LADDERS) {
      if (l.answer === 0) continue;
      for (const rung of l.hints) {
        expect(rung, `${l.engine}/${l.mode}: "${rung}"`).not.toMatch(
          new RegExp(`(answer|it) is ${l.answer}\\b`, "i"),
        );
        expect(rung, `${l.engine}/${l.mode}: "${rung}"`).not.toMatch(
          new RegExp(`=\\s*${l.answer}\\b`),
        );
      }
    }
  });

  it("never uses jargon that appears on no screen", () => {
    for (const l of LADDERS) {
      for (const rung of l.hints) {
        // "Holders" was the real offender: the screen says plates, jars, bowls.
        expect(rung.toLowerCase(), `${l.engine}/${l.mode}: "${rung}"`).not.toMatch(
          /holders?|dividend|quotient|divisor\b/,
        );
      }
    }
  });
});
