import { act, fireEvent } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderActivity } from "../kit/testing";
import { GUIDE_DEFAULTS } from "../kit";
import { skill } from ".";
import { bondHints } from "./activities/BondTree";
import { blockHints } from "./activities/BlockYard";
import { columnHints } from "./activities/ColumnPad";
import { chainHints } from "./activities/ChainBoard";
import { estimateHints } from "./activities/EstimateDial";
import { frameHints } from "./activities/FrameFill";
import { trayHints } from "./activities/CountTray";
import { factHints } from "./activities/FactDeck";
import { deskHints } from "./activities/PlaceValueDesk";
import { jumpHints } from "./activities/JumpLine";
import { storyHints } from "./activities/StoryBoard";
import { strategyHints } from "./activities/StrategyPicker";

/**
 * The help a child meets in addition, held to the same contract as counting's.
 *
 * Fifty-two techniques on twelve engines is where help stops being copy and
 * starts being a system: nobody can hold fifty-two ladders in their head, so
 * the only thing that keeps them sounding like one coach is a test that reads
 * every one of them.
 *
 * Two rules, and the first is the one a child feels. **A rung is a sentence,
 * not a paragraph** — sixteen words is about a breath, and about what a
 * six-year-old will take in before looking back at the screen. The second is
 * that a rung has to be *this* technique on *these* numbers: the lessons are
 * distinguished by method, so help that could be pasted from one lesson into
 * another is help that teaches neither.
 */

/** Sixteen words: a breath, and what a child hears before looking away. */
const MAX_WORDS = 16;

/**
 * Lessons that are allowed to share their wording, because they share a method.
 *
 * The rule below forbids two lessons offering the same help, and it is right to
 * — but a handful of pairs here teach one technique at two sizes, and forcing
 * those apart would mean writing a *different* explanation of the same move for
 * the bigger numbers, which is how a child ends up thinking they are two
 * different things. Filling a frame of five and filling a frame of ten is one
 * idea; bridging to the next ten and to the next hundred is one idea; trading
 * ten ones and trading ten tens is one idea.
 *
 * The second of each pair is listed, so the first still has to be distinct from
 * everything else. Nothing goes on this list because it was inconvenient: every
 * entry names a lesson whose title is the same technique scaled up.
 */
const SAME_TECHNIQUE = new Set([
  "ten-frame", // five-frame, bigger
  "make-10", // make-5, bigger
  "next-multiple-of-100", // next-multiple-of-10, bigger
  "add-multiples-of-100", // add-multiples-of-10, bigger
  "exchange-ten-tens", // exchange-ten-ones, one place up
  "add-hundreds-tens-ones", // place-value-chart, one column more
]);

const words = (rung: string) => rung.trim().split(/\s+/).length;

/**
 * Which ladder belongs to which engine, and the state each one reads.
 *
 * A fresh, untouched question in every case — the state a child is in when
 * they first stall, and the one the coach answers most often.
 */
const LADDERS: Record<string, (q: never) => string[]> = {
  tray: (q) =>
    trayHints(q, {
      counted: 0,
      merged: false,
      startPicked: null,
      fingers: { left: 0, right: 0 },
    } as never),
  frames: (q) => frameHints(q, { filled: 0 } as never),
  bonds: (q) => bondHints(q, { entries: {} } as never),
  numberline: (q) => jumpHints(q, { at: 0, made: [], entry: "" } as never),
  base10: (q) => blockHints(q, { built: { hundreds: 0, tens: 0, ones: 0 } } as never),
  chart: (q) => deskHints(q, { entries: {} } as never),
  facts: (q) => factHints(q, { revealed: false } as never),
  multi: (q) => chainHints(q, { chips: [], step: 0 } as never),
  column: (q) => columnHints(q, { digits: {}, carries: {} } as never),
  estimate: (q) => estimateHints(q, { rounded: [null, null] } as never),
  story: (q) => storyHints(q, { placed: {} } as never),
  strategy: (q) => strategyHints(q, {} as never),
};

/** Every teaching lesson, with a question built exactly as the round builds it. */
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
  const activity = skill.activities[engine];
  const build = activity?.worksheet?.build;
  const ladder = LADDERS[engine];
  if (!build || !ladder) continue;

  const params = lesson.params as { question?: Record<string, unknown> };
  const setup = { ...params, ...(params.question ?? {}) };
  /* Several draws per lesson: a ladder is written off the numbers, and a
     sentence that only fits for the easy draw is a sentence that breaks on a
     child's third question rather than in this test. */
  /* `seen` stops an engine drawing the same pair twice in a round, and the two
     story engines also carry a memory of the last question so a round does not
     repeat a character. One of each per lesson is exactly how the round holds
     them. */
  const seen = new Set<string>();
  const memory: { current: unknown } = { current: null };
  const draw = build as (s: never, i: number, seen: Set<string>, m: unknown) => unknown;

  for (let i = 1; i <= 6; i += 1) {
    samples.push({
      lesson: lesson.id,
      engine,
      ladder: ladder(draw(setup as never, i, seen, memory) as never),
    });
  }
}

describe("addition's help is the same help everywhere", () => {
  it("reaches every teaching lesson", () => {
    const reached = new Set(samples.map((s) => s.lesson));
    const missing = teaching.map((l) => l.id).filter((id) => !reached.has(id));
    expect(missing, `no ladder could be read for: ${missing.join(", ")}`).toEqual([]);
    expect(reached.size).toBe(teaching.length);
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

  it("teaches this lesson's technique, not addition in general", () => {
    /*
     * The last rung is the technique, and no two techniques may share one.
     *
     * Rung two describes the board — which box is empty, how many are placed —
     * and two lessons that happen to be at the same point on the same engine
     * can honestly say the same thing about it. Forcing those apart would mean
     * writing a worse sentence to satisfy a test.
     *
     * Rung three is different. It is the method worked through on these
     * numbers, which is the only thing that distinguishes fifty-two lessons
     * built out of twelve engines. When it collapses to the bare sum — "9 and
     * 8 is 17" — five lessons end up with the same last word and none of them
     * has taught its own technique.
     */
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

  it("never hands two lessons the same ladder from top to bottom", () => {
    const byLadder = new Map<string, Set<string>>();
    for (const s of samples) {
      if (SAME_TECHNIQUE.has(s.lesson)) continue;
      const shape = s.ladder.join(" | ").replace(/\d+/g, "#");
      if (!byLadder.has(shape)) byLadder.set(shape, new Set());
      byLadder.get(shape)!.add(s.lesson);
    }
    const same = [...byLadder.entries()]
      .filter(([, lessons]) => lessons.size > 1)
      .map(([, lessons]) => [...lessons].join(" + "));

    expect([...new Set(same)].sort(), "two lessons are helped identically").toEqual([]);
  });
});

describe("every engine coaches, and coaches the same way", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  /* One lesson per engine — twelve engines is what a child actually meets. */
  const perEngine = [...new Map(teaching.map((l) => [l.activity.split("/")[1], l])).values()];

  it("reaches all twelve engines", () => {
    expect(perEngine).toHaveLength(12);
  });

  for (const lesson of perEngine) {
    const engine = lesson.activity.split("/")[1];

    it(`${engine}: waits, then steps in with the lesson's own ladder`, () => {
      const activity = skill.activities[engine];
      const h = renderActivity(activity, {
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

      const given = h.koda
        .only("learning.supportUsed")
        .filter((c) => c.args[0] === "walkthrough");
      expect(given.map((c) => c.args[1]), `${engine} did not file the help it gave`).toEqual([1]);
      h.unmount();
    });

    it(`${engine}: the Hint button opens that same panel`, () => {
      const activity = skill.activities[engine];
      const h = renderActivity(activity, {
        params: lesson.params as Record<string, unknown>,
        level: 1,
      });

      const hint = h.buttons().find((b) => /^Hint$/.test(b));
      expect(hint, `${engine} offers no Hint button`).toBeTruthy();
      act(() => {
        h.screen.getByRole("button", { name: /^Hint$/ }).click();
      });

      expect(h.text(), `${engine} answered Hint with something other than the coach`).toContain(
        "Koda is helping",
      );
      // Asked for, not offered: the log has to tell them apart.
      const asked = h.koda.only("learning.supportUsed").filter((c) => c.args[0] === "hint");
      expect(asked.map((c) => c.args[1])).toEqual([1]);
      h.unmount();
    });
  }
});

describe("left to right plays the way it is described", () => {
  /**
   * The whole lesson, driven the way a learner follows the instruction.
   *
   * Everything else about this technique is checked on the question object.
   * This is the part that twice went wrong in a real session: the sentence on
   * screen, the boxes under it and the verdict have to agree, and they can each
   * be right on their own while disagreeing with each other.
   */
  const play = (a: number, b: number) =>
    renderActivity(skill.activities.chart, {
      params: {
        ...(skill.lessons.find((l) => l.id === "left-to-right")!.params as Record<string, unknown>),
        question: { mode: "left_right", aRange: [a, a], bRange: [b, b], questionsPerRound: 5 },
      },
      level: 35,
    });

  it("asks for the running total, and says so unambiguously", () => {
    const h = play(77, 67);
    const text = h.text();

    // The prompt names whose tens, because "the tens" means both columns to
    // anybody who has just finished partial sums.
    expect(text).toContain("Hold 77");
    expect(text).toContain("Add the tens of 67");
    // And the rows name the step, so neither can be read the other way.
    expect(text).toContain("After +60");
    expect(text).toContain("After +7");
    expect(text, "the ambiguous label is what sent two sessions wrong").not.toContain(
      "After the tens",
    );
    h.unmount();
  });

  it("draws the running total as a number, not as a digit in a column", () => {
    /*
     * 65 plus 46 needs a hundreds column, and the running total is 105.
     *
     * Drawn inside the column grid, that box sat under the heading "H" — a
     * whole number in the hundreds slot, on the one chart in the app where a
     * column means something. Reported from a real session, in which the box
     * was filled with 65: the number being held, written into what looked like
     * the next place to write a digit.
     */
    const h = play(65, 46);
    const boxes = h.screen.getAllByRole("textbox");
    expect(boxes).toHaveLength(2);

    for (const box of boxes) {
      const cell = box.closest("td")!;
      expect(
        cell.getAttribute("colspan"),
        "the running total is still sitting in one place-value column",
      ).toBe("3");
      // And it must not tell a screen reader it is a hundreds digit.
      expect(box.getAttribute("aria-label")).not.toMatch(/hundreds|tens|ones/i);
    }
    expect(boxes[0].getAttribute("aria-label")).toBe("After +40");
    h.unmount();
  });

  it("accepts the running total and refuses the partial sums", async () => {
    const type = (h: ReturnType<typeof play>, first: string, second: string) => {
      const boxes = h.screen.getAllByRole("textbox") as HTMLInputElement[];
      expect(boxes.length, "two running-total boxes").toBe(2);
      fireEvent.change(boxes[0], { target: { value: first } });
      fireEvent.change(boxes[1], { target: { value: second } });
    };

    // 77, hold it, add 60 -> 137, add 7 -> 144.
    const right = play(77, 67);
    type(right, "137", "144");
    await right.press(/^Check$/);
    expect(right.text(), "the technique as described was refused").toContain(
      "Every column is right!",
    );
    right.unmount();

    // The partial-sums reading: the tens column, then the ones column.
    const wrong = play(77, 67);
    type(wrong, "130", "14");
    await wrong.press(/^Check$/);
    const said = wrong.text();
    expect(said).not.toContain("Every column is right!");
    // And it says which question was answered, rather than reciting the total.
    expect(said, "the verdict still does not name the mistake").toContain(
      "That is the part, not the total",
    );
    wrong.unmount();
  });
});
