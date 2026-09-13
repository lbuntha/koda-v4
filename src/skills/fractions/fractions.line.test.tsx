import { describe, expect, it } from "vitest";

import { renderActivity, expectStandardRound, type ActivityHarness } from "../kit/testing";
import { skill } from ".";
import {
  buildLineQuestion,
  intervalsFor,
  lineBlockedBecause,
  tickAt,
  wholeTicks,
  type LineMode,
  type LineQuestion,
} from "./internal/data/fractionLine";
import { valueOf } from "./internal/data/fractionNumbers";

const line = skill.activities.numberline;

const questions = (mode: LineMode, n = 200): LineQuestion[] => {
  const seen = new Set<string>();
  return Array.from({ length: n }, (_, i) => buildLineQuestion({ mode }, mode, i, seen));
};

/** Tap the tick the question wants, then confirm. */
const placeAndConfirm = async (h: ActivityHarness): Promise<void> => {
  const label = h.screen.getByTestId("line").getAttribute("aria-label") ?? "";
  const intervals = Number(/in (\d+) jumps/.exec(label)?.[1] ?? "0");
  const sum = /on (\d+)\/(\d+)\./.exec(h.text());
  if (!sum) throw new Error(`no fraction in prompt: ${h.text().slice(0, 120)}`);
  const wanted = Math.round((Number(sum[1]) / Number(sum[2])) * intervals);
  const circles = h.screen.getByTestId("line").querySelectorAll("circle");
  (circles[wanted] as SVGElement).dispatchEvent(new MouseEvent("click", { bubbles: true }));
  await h.settle();
  await h.press("That is where it goes");
};

describe("ticks and jumps are not the same thing", () => {
  /*
   * The classic way to build a number-line engine wrong. A line from 0 to 1 in
   * quarters has five marks and four jumps, and `3/4` is the fourth mark. One
   * out either way still looks like a working number line and puts every answer
   * in the wrong place.
   */
  it("puts a fraction on the jump its value names", () => {
    const bar = { kind: "number" as const, name: "the number line" };
    expect(tickAt({ whole: bar, parts: 4, taken: 3 }, 1)).toBe(3);
    expect(tickAt({ whole: bar, parts: 4, taken: 4 }, 1)).toBe(4);
    // Past one, and on a longer line: still the seventh mark.
    expect(tickAt({ whole: bar, parts: 4, taken: 7 }, 2)).toBe(7);
    expect(intervalsFor({ whole: bar, parts: 4, taken: 3 }, 2)).toBe(8);
  });

  it("agrees with the fraction's value on every draw", () => {
    for (const mode of ["place_unit", "place_any", "read_point", "improper"] as LineMode[]) {
      for (const q of questions(mode, 80)) {
        // Every jump is 1/parts, so `taken` jumps land on mark `taken` —
        // whatever the span. The value check is the same statement scaled.
        expect(q.tick, `${mode}: ${q.fraction.taken}/${q.fraction.parts}`).toBe(q.fraction.taken);
        expect(q.tick / q.fraction.parts).toBeCloseTo(valueOf(q.fraction), 10);
        expect(q.tick).toBeLessThanOrEqual(q.intervals);
      }
    }
  });

  it("labels a whole number at every span boundary, and nowhere else", () => {
    for (const q of questions("improper", 60)) {
      const wholes = wholeTicks(q);
      expect(wholes).toHaveLength(q.span + 1);
      expect(wholes[0]).toBe(0);
      expect(wholes.at(-1)).toBe(q.intervals);
      for (const w of wholes) expect(w % q.fraction.parts).toBe(0);
    }
  });
});

describe("the line owns its whole", () => {
  it("never borrows a cake or a set", () => {
    for (const mode of ["place_unit", "place_any", "read_point", "makes_one", "improper"] as LineMode[]) {
      for (const q of questions(mode, 40)) {
        expect(q.fraction.whole.kind, mode).toBe("number");
      }
    }
  });
});

describe("place_unit and place_any", () => {
  it("keeps place_unit to one jump", () => {
    for (const q of questions("place_unit")) {
      expect(q.fraction.taken).toBe(1);
      expect(q.tick).toBe(1);
    }
  });

  it("never gives place_any a unit fraction — that is the level before", () => {
    for (const q of questions("place_any")) expect(q.fraction.taken).toBeGreaterThan(1);
  });

  it("starts with the marker off the line, and refuses until it is placed", () => {
    const [q] = questions("place_any", 1);
    expect(q.placesIt).toBe(true);
    expect(lineBlockedBecause(q, null)).toBe("not-placed");
    expect(lineBlockedBecause(q, q.tick)).toBe(null);
  });

  it("says so rather than scoring an unplaced marker", async () => {
    const h = renderActivity(line, { params: { question: { mode: "place_any" } } });
    await h.press("That is where it goes");
    expect(h.koda.count("learning.answered")).toBe(0);
    expect(h.text()).toContain("Put the marker on the line first.");
    h.unmount();
  });

  it("runs a full round of real placing", async () => {
    await expectStandardRound(line, placeAndConfirm, {
      params: { question: { mode: "place_any", partsRange: [3, 6] } },
      questions: 5,
    });
  });
});

describe("read_point — count jumps, not marks", () => {
  it("gives the marker already placed, because reading is the work", () => {
    for (const q of questions("read_point", 60)) {
      expect(q.placesIt).toBe(false);
      expect(lineBlockedBecause(q, null)).toBe(null);
    }
  });

  it("offers the two beliefs as wrong answers", () => {
    for (const q of questions("read_point", 80)) {
      const { taken, parts } = q.fraction;
      expect(q.options).toHaveLength(4);
      expect(q.options).toContain(`${taken}/${parts}`);
      // Swapped, and one-mark-too-many: the two ways this goes wrong.
      expect(q.options).toContain(`${parts}/${taken}`);
      expect(q.options).toContain(`${taken + 1}/${parts}`);
    }
  });
});

describe("makes_one — a fraction that is a whole number", () => {
  it("always wants d/d", () => {
    for (const q of questions("makes_one", 80)) {
      expect(q.expected).toBe(`${q.fraction.parts}/${q.fraction.parts}`);
      expect(q.tick).toBe(q.intervals);
    }
  });

  it("offers the near misses either side of one", () => {
    for (const q of questions("makes_one", 60)) {
      const d = q.fraction.parts;
      expect(q.options).toContain(`${d - 1}/${d}`);
      expect(q.options).toContain(`${d + 1}/${d}`);
    }
  });
});

describe("improper — past the one", () => {
  it("only draws fractions bigger than one", () => {
    for (const q of questions("improper")) {
      expect(valueOf(q.fraction)).toBeGreaterThan(1);
      expect(q.span).toBeGreaterThanOrEqual(2);
    }
  });

  it("gives the line enough room for the fraction it asks for", () => {
    for (const q of questions("improper", 100)) {
      expect(q.tick, `${q.fraction.taken}/${q.fraction.parts} on a span of ${q.span}`).toBeLessThanOrEqual(q.intervals);
    }
  });
});

describe("a skill for readers", () => {
  it("says nothing when a round opens", () => {
    const h = renderActivity(line, { features: { audio_speech: true } });
    expect(h.koda.count("speech.say")).toBe(0);
    h.unmount();
  });
});
