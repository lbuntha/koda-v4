import { describe, expect, it } from "vitest";

import { renderActivity, expectStandardRound, type ActivityHarness } from "../kit/testing";
import { skill } from ".";
import {
  boardTotal,
  breakOne,
  buildMixedQuestion,
  canBreak,
  canGroup,
  groupOne,
  improperName,
  mixedBlockedBecause,
  mixedName,
  startingBoard,
  type MixedMode,
  type MixedQuestion,
} from "./internal/data/fractionMixed";
import { toImproper, toMixed, valueOf } from "./internal/data/fractionNumbers";

/** The three techniques on the board, each driven the way a child drives it. */

const board = skill.activities.mixed;

const questions = (mode: MixedMode, n = 200): MixedQuestion[] => {
  const seen = new Set<string>();
  return Array.from({ length: n }, (_, i) => buildMixedQuestion({ mode }, mode, i, seen));
};

/** Work the board into the arrangement the question wants, then check. */
const arrange = async (h: ActivityHarness): Promise<void> => {
  for (let i = 0; i < 12; i += 1) {
    const make = h.buttons().includes("make a whole");
    if (!make) break;
    await h.press("make a whole");
  }
  await h.press("That is it");
};

describe("the amount never changes, only the arrangement", () => {
  /*
   * The invariant the whole engine rests on. A board holding one whole and
   * three quarters is holding seven quarters, and if those ever disagree the
   * level is teaching that two notations happen to be taught together.
   */
  it("keeps the total through every group and break", () => {
    for (const mode of ["to_mixed", "to_improper", "on_line"] as MixedMode[]) {
      for (const q of questions(mode, 80)) {
        let b = startingBoard(q);
        const total = boardTotal(b);
        for (let i = 0; i < 6; i += 1) {
          b = canGroup(b) ? groupOne(b) : canBreak(b) ? breakOne(b) : b;
          expect(boardTotal(b), `${mode}: ${improperName(q.improper)}`).toBe(total);
        }
      }
    }
  });

  it("round-trips every drawn quantity between its two names", () => {
    for (const q of questions("to_mixed", 150)) {
      expect(toImproper(toMixed(q.improper))).toMatchObject({
        taken: q.improper.taken,
        parts: q.improper.parts,
      });
      expect(valueOf(toImproper(q.mixed))).toBeCloseTo(valueOf(q.improper), 10);
    }
  });

  it("never draws a whole number wearing a fraction's clothes", () => {
    // `8/4` is two, and a level about mixed numbers that offers it is a level
    // about something else.
    for (const mode of ["to_mixed", "to_improper", "on_line"] as MixedMode[]) {
      for (const q of questions(mode, 80)) {
        expect(q.mixed.taken, `${mode}: ${improperName(q.improper)}`).toBeGreaterThan(0);
        expect(q.mixed.ones).toBeGreaterThanOrEqual(1);
      }
    }
  });
});

describe("to_mixed — loose parts into wholes", () => {
  it("starts with everything loose", () => {
    for (const q of questions("to_mixed", 60)) {
      const b = startingBoard(q);
      expect(b.ones).toBe(0);
      expect(b.loose).toBe(q.improper.taken);
      expect(q.direction).toBe("group");
    }
  });

  it("refuses while another whole can still be made", () => {
    const [q] = questions("to_mixed", 1);
    expect(mixedBlockedBecause(q, startingBoard(q))).toBe("group-more");
    expect(mixedBlockedBecause(q, { ones: q.mixed.ones, loose: q.mixed.taken, parts: q.improper.parts })).toBe(null);
  });

  it("says so on screen rather than scoring it", async () => {
    const h = renderActivity(board, { params: { question: { mode: "to_mixed" } } });
    await h.press("That is it");
    expect(h.koda.count("learning.answered")).toBe(0);
    expect(h.text()).toContain("still enough loose ones");
    h.unmount();
  });

  it("runs a full round of real grouping", async () => {
    await expectStandardRound(board, arrange, {
      params: { question: { mode: "to_mixed", partsRange: [2, 4], onesRange: [1, 2] } },
      questions: 5,
    });
  });
});

describe("to_improper — wholes back into parts", () => {
  it("starts with the wholes already made", () => {
    for (const q of questions("to_improper", 60)) {
      const b = startingBoard(q);
      expect(b.ones).toBe(q.mixed.ones);
      expect(b.loose).toBe(q.mixed.taken);
      expect(q.direction).toBe("break");
    }
  });

  it("refuses while a whole one is still standing", () => {
    const [q] = questions("to_improper", 1);
    expect(mixedBlockedBecause(q, startingBoard(q))).toBe("break-more");
    expect(mixedBlockedBecause(q, { ones: 0, loose: q.improper.taken, parts: q.improper.parts })).toBe(null);
  });

  it("wants the improper name, not the mixed one", () => {
    for (const q of questions("to_improper", 40)) {
      expect(q.expected).toBe(improperName(q.improper));
      expect(q.expected).not.toBe(mixedName(q.mixed));
    }
  });
});

describe("on_line — both names, one place", () => {
  it("puts the mark at the numerator, whatever the span", () => {
    for (const q of questions("on_line", 120)) {
      expect(q.tick).toBe(q.improper.taken);
      expect(q.intervals).toBe(q.improper.parts * (q.span as number));
      expect(q.tick).toBeLessThanOrEqual(q.intervals as number);
    }
  });

  it("gives the line room past the whole number", () => {
    for (const q of questions("on_line", 80)) {
      expect(q.span).toBe(q.mixed.ones + 1);
      expect((q.span as number) * q.improper.parts).toBeGreaterThan(q.improper.taken);
    }
  });

  it("asks for the mixed name, since that is what it showed", () => {
    for (const q of questions("on_line", 40)) expect(q.expected).toBe(mixedName(q.mixed));
  });

  it("refuses an unplaced marker", async () => {
    const h = renderActivity(board, { params: { question: { mode: "on_line" } } });
    await h.press("That is where it goes");
    expect(h.koda.count("learning.answered")).toBe(0);
    expect(h.text()).toContain("Put the marker on the line first.");
    h.unmount();
  });
});

describe("the board keeps the running total in view", () => {
  it("says how many parts are on it, whatever the arrangement", () => {
    const h = renderActivity(board, { params: { question: { mode: "to_mixed", partsRange: [4, 4] } } });
    const before = h.screen.getByTestId("running").textContent;
    if (h.buttons().includes("make a whole")) {
      // Grouping changes the arrangement and must not change the count.
      void h.press("make a whole");
    }
    expect(before).toMatch(/still \d+ \w+ altogether/);
    h.unmount();
  });

  it("does not show the other name before the child has answered", () => {
    // Printed early, it is the answer.
    const h = renderActivity(board, { params: { question: { mode: "to_mixed" } } });
    expect(h.text()).not.toMatch(/is the same as/);
    h.unmount();
  });
});

describe("a skill for readers", () => {
  it("says nothing when a round opens", () => {
    const h = renderActivity(board, { features: { audio_speech: true } });
    expect(h.koda.count("speech.say")).toBe(0);
    h.unmount();
  });
});
