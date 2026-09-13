import { describe, expect, it } from "vitest";

import { renderActivity, expectStandardRound, type ActivityHarness } from "../kit/testing";
import { skill } from ".";
import {
  buildStripQuestion,
  nameOf,
  stripBlockedBecause,
  unequalWidths,
  type StripMode,
  type StripQuestion,
} from "./internal/data/fractionStrip";
import { canPartition, valueOf } from "./internal/data/fractionNumbers";

/**
 * The six techniques on the folding strip, each driven the way a child drives it.
 *
 * "The strip works" is not a claim worth making: the modes differ in what the
 * child supplies, and a bug there produces a screen that still shades parts and
 * still scores answers while teaching the wrong thing.
 */

const strip = skill.activities.strip;

const questions = (mode: StripMode, n = 200): StripQuestion[] => {
  const seen = new Set<string>();
  return Array.from({ length: n }, (_, i) => buildStripQuestion({ mode }, mode, i, seen));
};

/** Shade what the question asked for, then confirm. */
const shadeAndConfirm = async (h: ActivityHarness): Promise<void> => {
  const want = Number(/That is (\d+) of them/.exec(h.text())?.[1] ?? "0");
  const parts = h.screen.getByTestId("whole").querySelectorAll("rect, path");
  for (let i = 0; i < want && i < parts.length; i += 1) {
    (parts[i] as SVGElement).dispatchEvent(new MouseEvent("click", { bubbles: true }));
  }
  await h.settle();
  await h.press(`That is ${want} of them`);
};

describe("every picture this engine draws is honest", () => {
  it("never cuts a whole into a partition it cannot show", () => {
    for (const mode of ["equal_or_not", "name_unit", "build", "to_notation", "of_a_set"] as StripMode[]) {
      for (const q of questions(mode, 80)) {
        expect(canPartition(q.fraction.whole, q.fraction.parts), `${mode}: ${q.fraction.parts} of ${q.fraction.whole.name}`).toBe(true);
      }
    }
  });

  it("keeps every fraction proper — a part of a whole, not more than one", () => {
    for (const mode of ["name_unit", "build", "to_notation"] as StripMode[]) {
      for (const q of questions(mode, 60)) {
        expect(valueOf(q.fraction)).toBeLessThan(1);
      }
    }
  });
});

describe("equal_or_not — the condition for a fraction at all", () => {
  it("splits a round between equal and unequal", () => {
    const drawn = questions("equal_or_not", 20);
    expect(drawn.some((q) => q.areEqual)).toBe(true);
    expect(drawn.some((q) => !q.areEqual)).toBe(true);
  });

  it("draws the unequal ones with real widths, not a claim", () => {
    // A strip that merely says it is unequal teaches a child to read the
    // question instead of the picture.
    for (const q of questions("equal_or_not", 60)) {
      if (q.areEqual) {
        expect(q.unequal).toBeUndefined();
        continue;
      }
      const widths = q.unequal as number[];
      expect(widths).toHaveLength(q.fraction.parts);
      expect(new Set(widths.map((w) => w.toFixed(4))).size).toBeGreaterThan(1);
    }
  });

  it("makes the difference visible, not marginal", () => {
    for (let i = 0; i < 40; i += 1) {
      const widths = unequalWidths(6);
      expect(Math.max(...widths) / Math.min(...widths)).toBeGreaterThan(2);
    }
  });

  it("asks for yes or no, not a fraction", () => {
    for (const q of questions("equal_or_not", 20)) expect(["yes", "no"]).toContain(q.expected);
  });
});

describe("name_unit — one of them", () => {
  it("always shades exactly one part", () => {
    for (const q of questions("name_unit")) {
      expect(q.fraction.taken).toBe(1);
      expect(q.expected).toBe(`1/${q.fraction.parts}`);
    }
  });

  it("offers four names with one right", () => {
    for (const q of questions("name_unit", 80)) {
      expect(q.options).toHaveLength(4);
      expect(new Set(q.options).size).toBe(4);
      expect(q.options).toContain(q.expected);
    }
  });

  it("offers the two-numbers-swapped name, because that is the belief", () => {
    const q = buildStripQuestion({ mode: "name_unit", partsRange: [4, 4] }, "name_unit", 0);
    expect(q.options).toContain("4/1");
  });
});

describe("which_whole — half of what?", () => {
  it("shows the same fraction of two different-sized wholes", () => {
    for (const q of questions("which_whole", 60)) {
      expect(q.other).toBeDefined();
      expect(q.other?.taken).toBe(q.fraction.taken);
      expect(q.other?.parts).toBe(q.fraction.parts);
      // Same fraction, different whole: the amount differs, the name does not.
      expect(q.other?.whole.name).not.toBe(q.fraction.whole.name);
    }
  });

  it("puts two wholes on screen, not one", () => {
    const h = renderActivity(strip, { params: { question: { mode: "which_whole" } } });
    expect(h.screen.getByTestId("two-wholes")).toBeTruthy();
    expect(h.buttons()).toEqual(expect.arrayContaining(["The long one", "The short one"]));
    h.unmount();
  });
});

describe("build — three copies of one part", () => {
  it("starts blank and asks the child to make it", () => {
    for (const q of questions("build", 40)) {
      expect(q.shadesIt).toBe(true);
      expect(q.target).toBe(q.fraction.taken);
    }
    const h = renderActivity(strip, { params: { question: { mode: "build" } } });
    expect(h.screen.getByTestId("count").textContent).toContain("0 shaded");
    h.unmount();
  });

  it("refuses too few and too many, and says which", () => {
    const [q] = questions("build", 1);
    expect(stripBlockedBecause(q, 0)).toBe("shade-more");
    expect(stripBlockedBecause(q, q.target - 1)).toBe("shade-more");
    expect(stripBlockedBecause(q, q.target)).toBe(null);
    expect(stripBlockedBecause(q, q.target + 1)).toBe("shade-fewer");
  });

  it("does not gate the modes where the picture is given", () => {
    for (const mode of ["name_unit", "to_notation", "of_a_set"] as StripMode[]) {
      const [q] = questions(mode, 1);
      expect(stripBlockedBecause(q, 0)).toBe(null);
    }
  });

  it("offers a way back to a blank strip, and only once there is something to clear", async () => {
    /*
     * A child who shades six parts, gets it wrong and presses "Try again" comes
     * back to the same question with their six parts still shaded. Undoing them
     * one at a time is not a thing a stuck eight-year-old does.
     */
    const h = renderActivity(strip, { params: { question: { mode: "build", partsRange: [4, 4] } } });
    expect(h.buttons()).not.toContain("Start over");

    const parts = h.screen.getByTestId("whole").querySelectorAll("rect, path");
    (parts[0] as SVGElement).dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await h.settle();
    expect(h.screen.getByTestId("count").textContent).toContain("1 shaded");
    expect(h.buttons()).toContain("Start over");

    await h.press("Start over");
    expect(h.screen.getByTestId("count").textContent).toContain("0 shaded");
    expect(h.buttons()).not.toContain("Start over");
    h.unmount();
  });

  it("runs a full round of real shading", async () => {
    await expectStandardRound(strip, shadeAndConfirm, {
      params: { question: { mode: "build", partsRange: [3, 6], wholeKinds: ["bar"] } },
      questions: 5,
    });
  });
});

describe("to_notation — reading the picture", () => {
  it("never shades just one, because that is the level before", () => {
    for (const q of questions("to_notation", 80)) expect(q.fraction.taken).toBeGreaterThan(1);
  });

  it("names the fraction the picture actually shows", () => {
    for (const q of questions("to_notation", 60)) expect(q.expected).toBe(nameOf(q.fraction));
  });
});

describe("of_a_set — the whole is all of them", () => {
  it("only uses sets, and only partitions that divide them", () => {
    for (const q of questions("of_a_set", 80)) {
      expect(q.fraction.whole.kind).toBe("set");
      expect((q.fraction.whole.size as number) % q.fraction.parts).toBe(0);
    }
  });

  it("asks for a count of things, not a fraction", () => {
    for (const q of questions("of_a_set", 60)) {
      const size = q.fraction.whole.size as number;
      expect(Number(q.expected)).toBe((size / q.fraction.parts) * q.fraction.taken);
      expect(q.choices).toHaveLength(4);
      expect(q.choices).toContain(Number(q.expected));
    }
  });
});

describe("a skill for readers", () => {
  it("says nothing when a round opens", () => {
    const h = renderActivity(strip, { features: { audio_speech: true } });
    expect(h.koda.count("speech.say")).toBe(0);
    h.unmount();
  });

  it("drops the part labels when the switch is off", () => {
    const on = renderActivity(strip, {
      params: { question: { mode: "name_unit" } },
      features: { part_labels: true },
    });
    const shown = /each part is 1\//.test(on.text());
    on.unmount();
    const off = renderActivity(strip, {
      params: { question: { mode: "name_unit" } },
      features: { part_labels: false },
    });
    const hidden = /each part is 1\//.test(off.text());
    off.unmount();
    expect(shown).toBe(true);
    expect(hidden).toBe(false);
  });
});
