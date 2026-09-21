import { act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderActivity } from "../kit/testing";
import { GUIDE_DEFAULTS } from "../kit";
import { skill } from ".";
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

/**
 * The help a child meets in division, held to the contract the other three
 * skills already hold.
 *
 * Division's ladders are shaped differently: they take the question and
 * nothing else — no lesson `kidTip`, no live state — so a rung cannot describe
 * what the child has built. That makes the *wording* carry all of it, and
 * makes this sweep the only thing standing between fifty-six techniques and
 * fifty-six voices.
 *
 * Two rules. **A rung is a sentence, not a paragraph**, and a rung has to be
 * *this* technique on *these* numbers.
 */

/** Sixteen words: a breath, and what a child hears before looking away. */
const MAX_WORDS = 16;

const words = (rung: string) => rung.trim().split(/\s+/).length;

/**
 * Lessons allowed to share their last rung, because they share a method.
 *
 * One technique at two sizes is one idea. Filled in once the overlaps are read,
 * never because an entry was inconvenient.
 */
const SAME_TECHNIQUE = new Set([
  /*
   * Both lessons reach for ten as the benchmark — "ten of them is this much, so
   * the answer is over or under ten" — and what changes is which divisors a
   * child is practising it on. Writing a second phrasing of one move would
   * teach that they are two moves.
   */
  "divide-by-3-6-9",
]);

/**
 * Every ladder, called the way its engine calls it.
 *
 * With the lesson's own `kidTip`, because that is rung one — a harness that
 * withholds it reads a two-rung ladder no child ever sees.
 */
const LADDERS: Record<string, (q: never, tip: string | undefined) => string[]> = {
  share: (q, tip) => trayHints(q, tip),
  array: (q, tip) => arrayHints(q, tip),
  numberline: (q, tip) => lineHints(q, tip),
  facts: (q, tip) => factHints(q, tip),
  remainder: (q, tip) => remainderHints(q, tip),
  chart: (q, tip) => placeHints(q, tip),
  chunk: (q, tip) => chunkHints(q, tip),
  column: (q, tip) => columnHints(q, tip),
  factors: (q, tip) => factorHints(q, tip),
  estimate: (q, tip) => estimateHints(q, tip),
  story: (q, tip) => storyHints(q, tip),
};

const teaching = skill.lessons.filter(
  (l) => !(l.params as { question?: { practice?: boolean } }).question?.practice,
);

interface Sample {
  lesson: string;
  engine: string;
  ladder: string[];
}

const samples: Sample[] = [];
for (const lesson of teaching) {
  const engine = lesson.activity.split("/")[1];
  const build = skill.activities[engine]?.worksheet?.build;
  const ladder = LADDERS[engine];
  if (!build || !ladder) continue;

  const params = lesson.params as {
    question?: Record<string, unknown>;
    play?: { kidTip?: string };
  };
  const kidTip = params.play?.kidTip;
  const setup = { ...params, ...(params.question ?? {}) };
  const seen = new Set<string>();
  const memory: { current: unknown } = { current: null };
  const draw = build as (s: never, i: number, seen: Set<string>, m: unknown) => unknown;

  for (let i = 1; i <= 6; i += 1) {
    samples.push({
      lesson: lesson.id,
      engine,
      ladder: ladder(draw(setup as never, i, seen, memory) as never, kidTip),
    });
  }
}

describe("division's help is the same help everywhere", () => {
  it("reaches every teaching lesson on a ladder-bearing engine", () => {
    const covered = teaching.filter((l) => LADDERS[l.activity.split("/")[1]]);
    const reached = new Set(samples.map((s) => s.lesson));
    const missing = covered.map((l) => l.id).filter((id) => !reached.has(id));
    expect(missing, `no ladder could be read for: ${missing.join(", ")}`).toEqual([]);
  });

  it("gives every lesson three rungs — say it, show it, walk it", () => {
    const wrong = samples
      .filter((s) => s.ladder.length !== 3)
      .map((s) => `${s.lesson} has ${s.ladder.length}`);
    expect([...new Set(wrong)]).toEqual([]);
  });

  it("keeps every rung to a sentence a child can hold", () => {
    const long = samples
      .flatMap((s) => s.ladder.map((rung, i) => ({ ...s, rung, at: i + 1 })))
      .filter((r) => words(r.rung) > MAX_WORDS)
      .map((r) => `${r.lesson} rung ${r.at} (${words(r.rung)}w): ${r.rung}`);
    expect(
      [...new Set(long)].sort(),
      `${long.length} rungs are longer than a child will listen to`,
    ).toEqual([]);
  });

  it("never leaves a rung blank or padded", () => {
    for (const s of samples) {
      for (const [i, rung] of s.ladder.entries()) {
        expect(rung.trim(), `${s.lesson} rung ${i + 1} has loose whitespace`).toBe(rung);
        expect(rung.length, `${s.lesson} rung ${i + 1} says nothing`).toBeGreaterThan(15);
      }
    }
  });

  it("teaches this lesson's technique, not division in general", () => {
    const byWalk = new Map<string, Set<string>>();
    for (const s of samples) {
      if (SAME_TECHNIQUE.has(s.lesson)) continue;
      const shape = s.ladder[2].replace(/\d+/g, "#");
      if (!byWalk.has(shape)) byWalk.set(shape, new Set());
      byWalk.get(shape)!.add(s.lesson);
    }
    const shared = [...byWalk.entries()]
      .filter(([, lessons]) => lessons.size > 1)
      .map(([shape, lessons]) => `${[...lessons].join(" + ")}: "${shape}"`);
    expect(shared.sort(), "different techniques share their last rung").toEqual([]);
  });
});

describe("every division engine coaches the same way", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  const perEngine = [...new Map(teaching.map((l) => [l.activity.split("/")[1], l])).values()];

  it("reaches all twelve engines", () => {
    expect(perEngine).toHaveLength(12);
  });

  for (const lesson of perEngine) {
    const engine = lesson.activity.split("/")[1];

    it(`${engine}: waits, then steps in with the lesson's own ladder`, () => {
      const h = renderActivity(skill.activities[engine], {
        params: lesson.params as Record<string, unknown>,
        level: 1,
      });

      act(() => {
        vi.advanceTimersByTime(GUIDE_DEFAULTS.startMs - 1500);
      });
      expect(h.text(), `${engine} interrupted a learner still thinking`).not.toContain(
        "Koda is helping",
      );

      act(() => {
        vi.advanceTimersByTime(2500);
      });
      expect(h.text(), `${engine} never stepped in`).toContain("Koda is helping");
      h.unmount();
    });

    it(`${engine}: the Hint button opens that same panel`, () => {
      const h = renderActivity(skill.activities[engine], {
        params: lesson.params as Record<string, unknown>,
        level: 1,
      });
      act(() => {
        h.screen.getByRole("button", { name: /^Hint$/ }).click();
      });
      expect(h.text(), `${engine} answered Hint with something else`).toContain("Koda is helping");
      h.unmount();
    });
  }
});
