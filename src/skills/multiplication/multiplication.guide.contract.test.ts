import { act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderActivity } from "../kit/testing";
import { GUIDE_DEFAULTS } from "../kit";
import { skill } from ".";
import { groupHints } from "./activities/GroupTray";
import { arrayHints } from "./activities/ArrayGrid";
import { trackHints } from "./activities/SkipTrack";
import { factHints } from "./activities/FactDeck";
import { tableHints } from "./activities/TableGrid";
import { factorHints } from "./activities/FactorBoard";
import { deskHints } from "./activities/PlaceValueDesk";
import { areaHints } from "./activities/AreaModel";
import { columnHints } from "./activities/ColumnPad";
import { estimateHints } from "./activities/EstimateDial";
import { storyHints } from "./activities/StoryBoard";
import { strategyHints } from "./activities/StrategyPicker";

/**
 * The help a child meets in multiplication, held to the contract the other
 * three skills already hold.
 *
 * Fifty-six techniques on twelve engines is well past what anybody keeps
 * straight by reading. Two rules: **a rung is a sentence, not a paragraph**,
 * and a rung has to be *this* technique on *these* numbers — the lessons are
 * distinguished by method, so help that could be pasted from one into another
 * teaches neither.
 */

/** Sixteen words: a breath, and what a child hears before looking away. */
const MAX_WORDS = 16;

const words = (rung: string) => rung.trim().split(/\s+/).length;

/**
 * Lessons allowed to share their last rung, because they share a method.
 *
 * One technique at two sizes is one idea. Filled in once the overlaps are read,
 * and never because an entry was inconvenient.
 */
const SAME_TECHNIQUE = new Set([
  "area-model-2x2", // area-model-2x1, one more partition
  /*
   * Deriving from a fact you already hold is one strategy, and these lessons
   * teach it over different fact families. The sentence has the same shape —
   * "from this known fact, add one more group" — because the *move* is the
   * same; what changes is which fact a child is anchoring to, and the numbers
   * on screen say that. Forcing four different phrasings of one move would
   * teach that they are four moves.
   */
  "times-six",
  "near-squares",
  "times-eleven-twelve",
]);

/**
 * Every ladder, called the way its engine calls it.
 *
 * A fresh, untouched question in each case — the state a child is in when they
 * first stall, and the one the coach answers most often.
 */
const LADDERS: Record<string, (q: never, tip: string | undefined) => string[]> = {
  groups: (q, tip) => groupHints(q, tip, { placed: [], counted: [] } as never),
  array: (q, tip) => arrayHints(q, tip, { rows: 0, cols: 0, turned: false, picked: [] } as never),
  numberline: (q, tip) => trackHints(q, tip, { made: 0 } as never),
  facts: (q, tip) => factHints(q, tip, { revealed: false } as never),
  table: (q, tip) => tableHints(q, tip, { picked: [] } as never),
  factors: (q, tip) => factorHints(q, tip, { rewritten: false, picked: [], tried: [] } as never),
  chart: (q, tip) => deskHints(q, tip, { moved: 0 } as never),
  area: (q, tip) => areaHints(q, tip, { filled: [] } as never),
  column: (q, tip) => columnHints(q, tip, { done: 0 } as never),
  estimate: (q, tip) => estimateHints(q, tip, { dialA: 0, dialB: 0, revealed: false } as never),
  story: (q, tip) => storyHints(q, tip),
  strategy: (q, tip) => strategyHints(q, tip, {} as never),
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
  /* Rung one is the lesson's own kidTip and `composeHints` drops a blank, so a
     harness that withholds it reads a two-rung ladder that no child ever sees. */
  const kidTip = params.play?.kidTip;
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
      ladder: ladder(draw(setup as never, i, seen, memory) as never, kidTip),
    });
  }
}

describe("multiplication's help is the same help everywhere", () => {
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

  it("teaches this lesson's technique, not multiplication in general", () => {
    /* Rung two describes the board, and two lessons at the same point on one
       engine can honestly say the same about it. Rung three is the method
       worked on these numbers, and that is what tells the lessons apart. */
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

describe("every multiplication engine coaches the same way", () => {
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
