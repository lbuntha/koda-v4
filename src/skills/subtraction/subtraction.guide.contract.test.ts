import { act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderActivity } from "../kit/testing";
import { GUIDE_DEFAULTS } from "../kit";
import { skill } from ".";
import { trayHints } from "./activities/RemoveTray";
import { frameHints } from "./activities/FrameTakeaway";
import { bondHints } from "./activities/BondHouse";
import { lineHints } from "./activities/DifferenceLine";
import { factHints } from "./activities/FactDeck";
import { blockHints } from "./activities/BlockExchange";
import { chartHints } from "./activities/PlaceValueDesk";
import { columnHints } from "./activities/ColumnPad";
import { estimateHints } from "./activities/EstimateDial";
import { storyHints } from "./activities/StoryBoard";
import { strategyHints } from "./activities/StrategyPicker";

/**
 * The help a child meets in subtraction, held to the contract counting and
 * addition already hold.
 *
 * Fifty-two techniques on eleven engines is past the point where anybody can
 * keep the wording straight by reading it. Two rules, and the first is the one
 * a child feels: **a rung is a sentence, not a paragraph.** The second is that
 * a rung has to be *this* technique on *these* numbers — these lessons are
 * distinguished by method, so help that could be pasted from one into another
 * teaches neither.
 */

/** Sixteen words: a breath, and what a child hears before looking away. */
const MAX_WORDS = 16;

const words = (rung: string) => rung.trim().split(/\s+/).length;

/**
 * Lessons allowed to share their last rung, because they share a method.
 *
 * One technique at two sizes is one idea, and writing a different explanation
 * for the bigger numbers teaches a child they are two. Every entry is named
 * once the lesson list is read, never because it was inconvenient.
 */
const SAME_TECHNIQUE = new Set([
  "ten-frame", // five-frame, one size up
  "subtract-from-10", // subtract-from-5, one size up
  "subtract-multiples-of-100", // subtract-multiples-of-10, one place up
  "exchange-one-hundred", // exchange-one-ten, one place up
  "bridge-through-100", // bridge-through-10, one place up
  "subtract-hundreds-tens-ones", // place-value-chart, one column more
]);

const LADDERS: Record<string, (q: never) => string[]> = {
  tray: (q) =>
    trayHints(q, { removed: 0, counted: 0, paired: 0, countValue: 0, fingersUp: 0 } as never),
  frames: (q) => frameHints(q, { removed: 0 } as never),
  bonds: (q) => bondHints(q, {} as never),
  numberline: (q) => lineHints(q, { at: 0, made: [] } as never),
  facts: (q) => factHints(q, { helperChosen: false, filled: 0 } as never),
  base10: (q) => blockHints(q, { held: {} as never, taken: {} as never } as never),
  chart: (q) => chartHints(q, { filled: 0 } as never),
  column: (q) => columnHints(q, { top: [], filled: 0 } as never),
  estimate: (q) => estimateHints(q, { rounded: false } as never),
  story: (q) => storyHints(q, { answered: 0 } as never),
  strategy: (q) => strategyHints(q, {} as never),
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

  const params = lesson.params as { question?: Record<string, unknown> };
  const setup = { ...params, ...(params.question ?? {}) };
  const seen = new Set<string>();
  const memory: { current: unknown } = { current: null };
  const draw = build as (s: never, i: number, seen: Set<string>, m: unknown) => unknown;

  /* Several draws each: a ladder is written off the numbers, and a sentence
     that only fits the easy draw breaks on a child's third question rather
     than in this test. */
  for (let i = 1; i <= 6; i += 1) {
    samples.push({
      lesson: lesson.id,
      engine,
      ladder: ladder(draw(setup as never, i, seen, memory) as never),
    });
  }
}

describe("subtraction's help is the same help everywhere", () => {
  it("reaches every teaching lesson", () => {
    const reached = new Set(samples.map((s) => s.lesson));
    const missing = teaching.map((l) => l.id).filter((id) => !reached.has(id));
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

  it("teaches this lesson's technique, not subtraction in general", () => {
    /* Rung two describes the board and two lessons at the same point on one
       engine can honestly say the same about it. Rung three is the method
       worked on these numbers, and that is what distinguishes the lessons. */
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

describe("every subtraction engine coaches the same way", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  const perEngine = [...new Map(teaching.map((l) => [l.activity.split("/")[1], l])).values()];

  it("reaches all eleven engines", () => {
    expect(perEngine).toHaveLength(11);
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
