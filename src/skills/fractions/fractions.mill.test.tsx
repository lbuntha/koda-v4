import { describe, expect, it } from "vitest";

import { renderActivity, expectStandardRound, type ActivityHarness } from "../kit/testing";
import { skill } from ".";
import {
  MAX_PARTS,
  applyJoin,
  applySplit,
  buildMillQuestion,
  millBlockedBecause,
  movesFor,
  nameOf,
  type MillMode,
  type MillQuestion,
} from "./internal/data/fractionEquivalence";
import { gcd, valueOf } from "./internal/data/fractionNumbers";

/** The five techniques on the mill, each driven the way a child drives it. */

const mill = skill.activities.equivalence;

const questions = (mode: MillMode, n = 200): MillQuestion[] => {
  const seen = new Set<string>();
  return Array.from({ length: n }, (_, i) => buildMillQuestion({ mode }, mode, i, seen));
};

/** Work the mill until the board holds what the question wants, then check. */
const workTheMill = async (h: ActivityHarness): Promise<void> => {
  for (let step = 0; step < 8; step += 1) {
    const now = /(\d+)\/(\d+)/.exec(h.screen.getByTestId("now").textContent ?? "");
    const want = /into (\d+)\./.exec(h.text());
    if (!now || !want) break;
    const factor = Number(want[1]);
    const label = `Cut every part into ${factor}`;
    if (!h.buttons().includes(label)) break;
    await h.press(label);
    break;
  }
  await h.press("That is it");
};

describe("the amount never changes, whatever the name does", () => {
  /*
   * The one invariant this whole engine rests on. A split that moved the shading
   * would be a different fraction with a straight face — and nothing on screen
   * would say so.
   */
  it("preserves the value through every split and join", () => {
    for (const mode of ["split", "scale_up", "scale_down", "simplest"] as MillMode[]) {
      for (const q of questions(mode, 100)) {
        expect(valueOf(q.to), `${mode}: ${nameOf(q.from)} -> ${nameOf(q.to)}`).toBeCloseTo(
          valueOf(q.from),
          10,
        );
      }
    }
  });

  it("preserves it through the moves a child can actually make", () => {
    const q = questions("split", 1)[0];
    let f = q.from;
    for (const k of [2, 3, 2]) {
      if (f.parts * k > MAX_PARTS) continue;
      const next = applySplit(f, k);
      expect(valueOf(next)).toBeCloseTo(valueOf(f), 10);
      f = next;
    }
    for (const k of movesFor(f).join) {
      expect(valueOf(applyJoin(f, k))).toBeCloseTo(valueOf(f), 10);
    }
  });

  it("never offers a join that would leave a fraction of a part", () => {
    for (const q of questions("scale_down", 80)) {
      for (const k of movesFor(q.from).join) {
        expect(q.from.parts % k).toBe(0);
        expect(q.from.taken % k).toBe(0);
      }
    }
  });
});

describe("the picture stays drawable", () => {
  it("never cuts past the point where parts can be told apart", () => {
    for (const mode of ["split", "two_names", "scale_up"] as MillMode[]) {
      for (const q of questions(mode, 100)) {
        expect(q.to.parts, `${mode}: ${nameOf(q.to)}`).toBeLessThanOrEqual(MAX_PARTS);
      }
    }
    // And the moves offered respect the same ceiling.
    const wide = { whole: { kind: "bar" as const, name: "the strip" }, parts: 12, taken: 5 };
    expect(movesFor(wide).split).toEqual([2]);
  });
});

describe("scale_down and simplest are different levels on purpose", () => {
  it("only draws fractions that have something left to reduce", () => {
    for (const mode of ["scale_down", "simplest"] as MillMode[]) {
      for (const q of questions(mode, 100)) {
        expect(gcd(q.from.taken, q.from.parts), `${mode}: ${nameOf(q.from)}`).toBeGreaterThan(1);
      }
    }
  });

  it("takes any shared factor at level 15, and the biggest at level 16", () => {
    for (const q of questions("simplest", 100)) {
      expect(q.factor).toBe(gcd(q.from.taken, q.from.parts));
      expect(gcd(q.to.taken, q.to.parts), `${nameOf(q.to)} is not simplest`).toBe(1);
    }
    for (const q of questions("scale_down", 100)) {
      const g = gcd(q.from.taken, q.from.parts);
      expect(g % q.factor).toBe(0);
      expect(q.factor).toBeGreaterThan(1);
    }
  });

  it("accepts a half-done answer at 15 and refuses it at 16", () => {
    // A child who cancels a 2 out of 12/18 has done something correct and
    // unfinished. Level 15 allows it; level 16 is where all of it is asked for.
    const partial = { whole: { kind: "bar" as const, name: "the strip" }, parts: 9, taken: 6 };
    const simplestQ = questions("simplest", 1)[0];
    const asIfPartial: MillQuestion = {
      ...simplestQ,
      from: { ...partial, parts: 18, taken: 12 },
      to: { ...partial, parts: 3, taken: 2 },
      factor: 6,
    };
    expect(millBlockedBecause(asIfPartial, partial)).toBe("not-simplest");
    expect(millBlockedBecause(asIfPartial, { ...partial, parts: 3, taken: 2 })).toBe(null);
  });

  it("names the refusal rather than marking it wrong", () => {
    const q = questions("simplest", 1)[0];
    expect(millBlockedBecause(q, q.from)).toBe("not-simplest");
    expect(millBlockedBecause(q, q.to)).toBe(null);
  });
});

describe("going too far, and not far enough", () => {
  it("tells the two apart", () => {
    const q = questions("split", 1)[0];
    expect(millBlockedBecause(q, q.from)).toBe("not-there-yet");
    expect(millBlockedBecause(q, applySplit(q.to, 2))).toBe("went-past");
    expect(millBlockedBecause(q, q.to)).toBe(null);
  });
});

describe("two_names — the pair, read in full", () => {
  it("offers four pairs with exactly one true one", () => {
    for (const q of questions("two_names", 120)) {
      expect(q.options).toHaveLength(4);
      expect(new Set(q.options).size).toBe(4);
      expect(q.options?.filter((o) => o === q.expected)).toHaveLength(1);
    }
  });

  it("offers the added-instead-of-multiplied pair, because that is the mistake", () => {
    for (const q of questions("two_names", 60)) {
      const added = `${nameOf(q.from)} and ${q.from.taken + q.factor}/${q.from.parts + q.factor}`;
      expect(q.options, `${nameOf(q.from)} x${q.factor}`).toContain(added);
    }
  });

  it("gives both pictures, so the child reads rather than works", () => {
    for (const q of questions("two_names", 20)) expect(q.operates).toBe(false);
    const h = renderActivity(mill, { params: { question: { mode: "two_names" } } });
    expect(h.screen.getByTestId("two-bars")).toBeTruthy();
    h.unmount();
  });
});

describe("the mill on screen", () => {
  it("starts on the fraction the question gave, not the answer", () => {
    const h = renderActivity(mill, { params: { question: { mode: "split" } } });
    const q = buildMillQuestion({ mode: "split" }, "split", 0);
    expect(h.screen.getByTestId("now").textContent).toMatch(/^\d+\/\d+$/);
    expect(q.operates).toBe(true);
    h.unmount();
  });

  it("refuses before any cutting, and says which way it is wrong", async () => {
    const h = renderActivity(mill, { params: { question: { mode: "split" } } });
    await h.press("That is it");
    expect(h.koda.count("learning.answered")).toBe(0);
    expect(h.text()).toMatch(/Not there yet|can still be made simpler/);
    h.unmount();
  });

  it("runs a full round of real cutting", async () => {
    await expectStandardRound(mill, workTheMill, {
      params: { question: { mode: "split", partsRange: [2, 4], factorRange: [2, 2] } },
      questions: 5,
    });
  });
});

describe("the ghost switch", () => {
  it("shows what it looked like before, and hides it when switched off", async () => {
    const on = renderActivity(mill, {
      params: { question: { mode: "split", partsRange: [2, 3], factorRange: [2, 2] } },
      features: { equivalence_ghost: true },
    });
    const cut = on.buttons().find((b) => /^Cut every part into 2$/.test(b));
    if (cut) await on.press(cut);
    const withGhost = on.screen.queryAllByRole("img").length;
    on.unmount();

    const off = renderActivity(mill, {
      params: { question: { mode: "split", partsRange: [2, 3], factorRange: [2, 2] } },
      features: { equivalence_ghost: false },
    });
    const cutOff = off.buttons().find((b) => /^Cut every part into 2$/.test(b));
    if (cutOff) await off.press(cutOff);
    const withoutGhost = off.screen.queryAllByRole("img").length;
    off.unmount();

    expect(withGhost).toBeGreaterThan(withoutGhost);
  });
});

describe("a skill for readers", () => {
  it("says nothing when a round opens", () => {
    const h = renderActivity(mill, { features: { audio_speech: true } });
    expect(h.koda.count("speech.say")).toBe(0);
    h.unmount();
  });
});
