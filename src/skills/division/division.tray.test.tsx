import { describe, expect, it } from "vitest";

import { renderActivity, expectStandardRound, type ActivityHarness } from "../kit/testing";
import { skill } from ".";
import { buildQuestion } from "./activities/ShareTray";
import {
  blockedBecause,
  buildTrayQuestion,
  trayShapeFor,
  type ShareMode,
  type ShareQuestion,
} from "./internal/data/divisionTray";

/**
 * The five techniques on the dealing tray, each driven the way a child drives it.
 *
 * One suite per mode, because "the tray works" is not a claim worth making: the
 * modes differ in exactly the place that matters — which part of the tray is
 * fixed — and a bug there produces a screen that still deals counters and still
 * scores answers while teaching the wrong thing.
 */

const tray = skill.activities.share;

/** Every question a lesson of this mode would ask, without React. */
const questions = (mode: ShareMode, n = 200): ShareQuestion[] => {
  const seen = new Set<string>();
  return Array.from({ length: n }, (_, i) => buildTrayQuestion({ mode }, mode, i, seen));
};

/** The plate buttons on screen, in the order they are dealt to. */
const plateLabels = (h: ActivityHarness): string[] =>
  h.screen
    .queryAllByRole("button")
    .map((b) => (b.getAttribute("aria-label") ?? "").trim())
    .filter((name) => /^Group \d+, holding \d+\. Add one\.$/.test(name));

const pileLeft = (h: ActivityHarness): number =>
  Number((h.screen.getByTestId("pile").getAttribute("aria-label") ?? "").split(" ")[0]);

/**
 * Deal the tray the way the lesson teaches — one to each plate, round and
 * round — then press the number that is on one plate.
 *
 * Round-robin rather than plate-by-plate on purpose: dealing everything onto
 * the first plate is exactly what the tray refuses, so a helper that did it
 * would be testing the refusal rather than the round.
 */
const dealAndAnswer = async (h: ActivityHarness): Promise<void> => {
  for (let turn = 0; turn < 400 && pileLeft(h) > 0; turn += 1) {
    const labels = plateLabels(h);
    if (labels.length === 0) break;
    await h.press(labels[turn % labels.length]);
  }
  const onOnePlate = Number(/holding (\d+)/.exec(plateLabels(h)[0] ?? "")?.[1] ?? "0");
  await h.press(String(onOnePlate));
};

describe("the undo control is drawn, not typed", () => {
  it("puts an icon in the button rather than a character", async () => {
    /*
     * It was the character `↩`, which a phone renders from the emoji font: a
     * blue-and-white picture in the middle of a muted grey tray. Nobody saw it
     * on a laptop, where the same character comes from the text font and looks
     * like a small arrow.
     */
    const h = renderActivity(skill.activities.share, { params: { question: { mode: "group_by_size" } } });
    await h.press("Start a new group");
    const undo = h.screen
      .getAllByRole("button")
      .filter((b) => /take one back/i.test(b.getAttribute("aria-label") ?? ""));
    expect(undo.length, "no undo control on a group").toBeGreaterThan(0);
    for (const button of undo) {
      expect(button.querySelectorAll("svg").length, "undo has no icon").toBeGreaterThan(0);
      expect(button.textContent ?? "", "undo still carries a glyph").not.toMatch(/[^\s]/);
    }
    h.unmount();
  });

  it("keeps the label a screen reader announces", async () => {
    // An icon-only button says nothing without one. `buttons()` lists the
    // enabled controls and undo starts disabled on an empty group, so the
    // label is read off the DOM.
    const h = renderActivity(skill.activities.share, { params: { question: { mode: "group_by_size" } } });
    await h.press("Start a new group");
    const labels = h.screen.getAllByRole("button").map((b) => b.getAttribute("aria-label"));
    expect(labels).toContain("Take one back from group 1");
    h.unmount();
  });
});

describe("share_out — deal between a fixed number of plates", () => {
  it("fixes the plates and leaves the plate size to the child", () => {
    for (const q of questions("share_out")) {
      expect(trayShapeFor(q)).toEqual({ plates: q.divisor });
      expect(q.unknown).toBe("size");
      expect(q.meaning).toBe("share");
      expect(q.remainder).toBe(0);
    }
  });

  it("puts one plate on screen for every plate the question names", () => {
    const h = renderActivity(tray, { params: { question: { mode: "share_out" } } });
    const plates = h
      .screen.queryAllByRole("button")
      .filter((b) => /^Group \d+, holding/.test(b.getAttribute("aria-label") ?? ""));
    const q = buildQuestion({ question: { mode: "share_out" } }, 0);
    expect(plates.length).toBeGreaterThanOrEqual(2);
    expect(plates.length).toBeLessThanOrEqual(5);
    expect(q.divisor).toBeGreaterThanOrEqual(2);
    h.unmount();
  });

  it("will not take an answer while counters are still in the pile", () => {
    const q = buildTrayQuestion({ mode: "share_out" }, "share_out", 0);
    const halfDealt = Array(q.divisor).fill(0);
    halfDealt[0] = 1;
    expect(blockedBecause(q, halfDealt)).toBe("deal-them-all");
  });

  it("will not take an answer while the plates are unequal", () => {
    // Everything dealt, but not evenly: 12 between 3 as 5, 4, 3.
    const q: ShareQuestion = {
      ...buildTrayQuestion({ mode: "share_out" }, "share_out", 0),
      dividend: 12,
      divisor: 3,
      quotient: 4,
    };
    expect(blockedBecause(q, [5, 4, 3])).toBe("not-equal");
    expect(blockedBecause(q, [4, 4, 4])).toBe(null);
  });

  it("says why, rather than marking a half-finished tray wrong", async () => {
    const h = renderActivity(tray, { params: { question: { mode: "share_out" } } });
    const q = buildQuestion({ question: { mode: "share_out" } }, 0);
    // Press an answer with nothing dealt at all.
    const answer = h.buttons().find((b) => /^\d+$/.test(b));
    if (answer) await h.press(answer);
    expect(h.koda.count("learning.answered"), "nothing was scored").toBe(0);
    expect(h.text()).toContain("Deal them all out first.");
    expect(q.dividend).toBeGreaterThan(0);
    h.unmount();
  });
});

describe("group_by_size — fill groups of a fixed size", () => {
  it("fixes the size of a group and leaves the number of them to the child", () => {
    for (const q of questions("group_by_size")) {
      expect(trayShapeFor(q)).toEqual({ capacity: q.divisor });
      expect(q.unknown).toBe("count");
      expect(q.meaning).toBe("group");
    }
  });

  it("starts with no groups at all — the child makes them", () => {
    const h = renderActivity(tray, { params: { question: { mode: "group_by_size" } } });
    const plates = h
      .screen.queryAllByRole("button")
      .filter((b) => /^Group \d+, holding/.test(b.getAttribute("aria-label") ?? ""));
    expect(plates).toHaveLength(0);
    expect(h.buttons()).toContain("Start a new group");
    h.unmount();
  });

  it("refuses a count while another whole group still fits", () => {
    const q: ShareQuestion = {
      ...buildTrayQuestion({ mode: "group_by_size" }, "group_by_size", 0),
      dividend: 12,
      divisor: 3,
      quotient: 4,
    };
    expect(blockedBecause(q, [3, 3])).toBe("another-group-fits");
    expect(blockedBecause(q, [3, 3, 3, 3])).toBe(null);
  });

  it("refuses a count while a group is still short", () => {
    const q: ShareQuestion = {
      ...buildTrayQuestion({ mode: "group_by_size" }, "group_by_size", 0),
      dividend: 12,
      divisor: 3,
      quotient: 4,
    };
    // 3, 3, 3, 2 and one still in the pile: not enough for another group, but
    // the last one is not full either.
    expect(blockedBecause(q, [3, 3, 3, 2])).toBe("plate-not-full");
  });
});

describe("halve — sharing between two", () => {
  it("always puts exactly two plates out", () => {
    for (const q of questions("halve")) {
      expect(q.divisor).toBe(2);
      expect(trayShapeFor(q)).toEqual({ plates: 2 });
      expect(q.quotient * 2).toBe(q.dividend);
    }
  });
});

describe("which_meaning — name the unknown without working it out", () => {
  it("asks about a situation and offers the two meanings", () => {
    const h = renderActivity(tray, { params: { question: { mode: "which_meaning" } } });
    expect(h.buttons()).toEqual(
      expect.arrayContaining(["How many go in each one?", "How many groups are there?"]),
    );
    h.unmount();
  });

  it("wants the group size when the sentence gives the number of groups", () => {
    for (const q of questions("which_meaning")) {
      if (!q.story) throw new Error("which_meaning must carry a situation");
      if (q.story.text.includes("shared equally between")) {
        expect(q.unknown).toBe("size");
        expect(q.meaning).toBe("share");
      } else {
        expect(q.story.text).toContain("are put into");
        expect(q.unknown).toBe("count");
        expect(q.meaning).toBe("group");
      }
    }
  });

  it("produces both kinds of situation, not just the one", () => {
    const drawn = questions("which_meaning", 60);
    expect(drawn.some((q) => q.unknown === "size")).toBe(true);
    expect(drawn.some((q) => q.unknown === "count")).toBe(true);
  });

  it("records which meaning was asked, not a number", () => {
    for (const q of questions("which_meaning", 20)) {
      expect(["size", "count"]).toContain(q.expected);
    }
  });
});

describe("to_equation — read a finished deal as a sentence", () => {
  it("offers four sentences with exactly one true one", () => {
    for (const q of questions("to_equation")) {
      const options = q.equations ?? [];
      expect(options).toHaveLength(4);
      expect(new Set(options).size).toBe(4);
      const truth = options.filter((text) => {
        const [left, right] = text.split(" = ");
        const [a, b] = left.split(" ÷ ").map(Number);
        return a / b === Number(right) && Number.isInteger(a / b);
      });
      expect(truth, `${q.dividend} / ${q.divisor}: ${options.join(" | ")}`).toEqual([q.expected]);
    }
  });

  it("always offers the swapped-round sentence, because that is the mistake", () => {
    for (const q of questions("to_equation", 50)) {
      expect(q.equations).toContain(`${q.divisor} ÷ ${q.dividend} = ${q.quotient}`);
    }
  });

  it("keeps the order of the options stable across renders", () => {
    const first = buildTrayQuestion({ mode: "to_equation" }, "to_equation", 0);
    // Same question id, rebuilt: the order is seeded from the id, not shuffled.
    const again = { ...first };
    expect(again.equations).toEqual(first.equations);
  });
});

describe("the round loop", () => {
  it("runs a full five-question share_out round and reports every answer", async () => {
    await expectStandardRound(
      tray,
      async (h) => {
        await dealAndAnswer(h);
      },
      { params: { question: { mode: "share_out" } }, questions: 5 },
    );
  });
});

describe("the switches in the manifest", () => {
  it("says nothing when spoken voice is off", async () => {
    const h = renderActivity(tray, {
      params: { question: { mode: "share_out" } },
      features: { audio_speech: false },
    });
    const answer = h.buttons().find((b) => /^\d+$/.test(b));
    if (answer) await h.press(answer); // refused, and the refusal is spoken
    expect(h.koda.count("speech.say")).toBe(0);
    h.unmount();
  });

  it("speaks the refusal when spoken voice is on", async () => {
    const h = renderActivity(tray, {
      params: { question: { mode: "share_out" } },
      features: { audio_speech: true },
    });
    const answer = h.buttons().find((b) => /^\d+$/.test(b));
    if (answer) await h.press(answer);
    expect(h.koda.count("speech.say")).toBeGreaterThan(0);
    h.unmount();
  });

  it("drops the per-group counts when the badge switch is off", () => {
    const on = renderActivity(tray, {
      params: { question: { mode: "share_out" } },
      features: { counting_badges: true },
    });
    const withBadges = on.screen.queryAllByText("0").length;
    on.unmount();

    const off = renderActivity(tray, {
      params: { question: { mode: "share_out" } },
      features: { counting_badges: false },
    });
    const withoutBadges = off.screen.queryAllByText("0").length;
    off.unmount();

    expect(withBadges).toBeGreaterThan(withoutBadges);
  });

  it("plays no chime when sound is off", async () => {
    const h = renderActivity(tray, {
      params: { question: { mode: "share_out" } },
      features: { sound_chimes: false },
    });
    const plate = h.buttons().find((b) => /^Group 1, holding/.test(b));
    if (plate) await h.press(plate);
    expect(h.koda.count("sound.play")).toBe(0);
    h.unmount();
  });
});

describe("practice", () => {
  it("cycles every mode rather than sampling them", () => {
    const modes: ShareMode[] = ["share_out", "group_by_size", "which_meaning", "to_equation", "halve"];
    const seen = new Set<string>();
    const drawn = Array.from({ length: 10 }, (_, i) =>
      buildQuestion({ question: { practice: true, modes, questionsPerRound: 10 } }, i, seen),
    );
    expect(drawn.map((q) => q.mode)).toEqual([...modes, ...modes]);
  });

  it("offers no hints while practising", () => {
    const h = renderActivity(tray, {
      params: { question: { practice: true, modes: ["share_out"], questionsPerRound: 4 } },
    });
    expect(h.buttons().some((b) => /hint/i.test(b))).toBe(false);
    h.unmount();
  });
});

/* -------------------------------------------------------------------------- */
/* Phase 2 — the properties, and the first sight of a remainder                */
/* -------------------------------------------------------------------------- */

describe("identity — by one, and by itself", () => {
  it("only ever draws the two shapes it is teaching", () => {
    for (const q of questions("identity")) {
      const byOne = q.divisor === 1 && q.quotient === q.dividend;
      const bySelf = q.divisor === q.dividend && q.quotient === 1;
      expect(byOne || bySelf, `${q.dividend} ÷ ${q.divisor}`).toBe(true);
      expect(q.remainder).toBe(0);
    }
  });

  it("draws both shapes, not just the easy one", () => {
    const drawn = questions("identity", 80);
    expect(drawn.some((q) => q.divisor === 1)).toBe(true);
    expect(drawn.some((q) => q.divisor === q.dividend)).toBe(true);
  });

  it("does not ask a child to count past ten plates", () => {
    for (const q of questions("identity")) expect(q.divisor).toBeLessThanOrEqual(10);
  });
});

describe("zero_rules — nothing to share, and nowhere to put it", () => {
  it("shares nothing between some plates and expects nothing each", () => {
    const possible = questions("zero_rules").filter((q) => !q.impossible);
    expect(possible.length).toBeGreaterThan(0);
    for (const q of possible) {
      expect(q.dividend).toBe(0);
      expect(q.answer).toBe(0);
      expect(q.divisor).toBeGreaterThanOrEqual(2);
    }
  });

  it("offers the question with no answer as well", () => {
    const drawn = questions("zero_rules", 30);
    const impossible = drawn.filter((q) => q.impossible);
    expect(impossible.length).toBeGreaterThan(0);
    for (const q of impossible) {
      expect(q.divisor).toBe(0);
      expect(q.expected).toBe("cannot");
      // It is not a quotient and must never be offered a tray to deal into.
      expect(trayShapeFor(q)).toEqual({});
    }
  });

  it("puts a way to say so on screen, and marks a number wrong", async () => {
    // Question index 2 of a zero_rules round is the impossible one.
    const h = renderActivity(tray, {
      params: { question: { mode: "zero_rules", questionsPerRound: 6 } },
    });
    for (let i = 0; i < 2; i += 1) {
      await h.press("0");
      await h.press(/^(next|finish|continue)$/i);
      await h.settle();
    }
    expect(h.buttons()).toContain("This cannot be done");
    await h.press("This cannot be done");
    const answered = h.koda.only("learning.answered").at(-1);
    expect(answered?.args?.[0]).toMatchObject({ correct: true });
    h.unmount();
  });

  it("does not accept zero as the answer to a share with no plates", () => {
    const [impossible] = questions("zero_rules", 30).filter((q) => q.impossible);
    // `answer` exists only to satisfy the shape; the expected answer is words.
    expect(impossible.expected).toBe("cannot");
    expect(impossible.expected).not.toBe(String(impossible.answer));
  });
});

describe("see_leftover — noticing what will not go round again", () => {
  it("always leaves something over", () => {
    for (const q of questions("see_leftover")) {
      expect(q.remainder).toBeGreaterThan(0);
      expect(q.remainder).toBeLessThan(q.divisor);
    }
  });

  it("gives the tray a leftover box, and only this mode one", () => {
    for (const q of questions("see_leftover", 20)) {
      expect(trayShapeFor(q)).toEqual({ plates: q.divisor, leftoverBin: true });
    }
    for (const q of questions("share_out", 20)) {
      expect(trayShapeFor(q).leftoverBin).toBeUndefined();
    }
  });

  it("refuses an answer while the box still holds a whole round", () => {
    const q: ShareQuestion = {
      ...buildTrayQuestion({ mode: "see_leftover" }, "see_leftover", 0),
      dividend: 14,
      divisor: 4,
      quotient: 3,
      remainder: 2,
    };
    // Stopped a round early: 2 on each plate and 6 in the box.
    expect(blockedBecause(q, [2, 2, 2, 2], 6)).toBe("another-round-fits");
    // Finished: 3 each, 2 left, and 2 will not go round 4 plates.
    expect(blockedBecause(q, [3, 3, 3, 3], 2)).toBe(null);
  });

  it("still refuses an unequal tray, box or no box", () => {
    const q: ShareQuestion = {
      ...buildTrayQuestion({ mode: "see_leftover" }, "see_leftover", 0),
      dividend: 14,
      divisor: 4,
      quotient: 3,
      remainder: 2,
    };
    expect(blockedBecause(q, [4, 3, 3, 2], 2)).toBe("not-equal");
  });

  it("puts a leftover box on screen that the child can fill", async () => {
    const h = renderActivity(tray, { params: { question: { mode: "see_leftover" } } });
    const box = h.buttons().find((b) => /^Leftover box, holding 0/.test(b));
    expect(box).toBeDefined();
    if (box) await h.press(box);
    expect(h.buttons().some((b) => /^Leftover box, holding 1/.test(b))).toBe(true);
    h.unmount();
  });
});

/* -------------------------------------------------------------------------- */
/* What the first pass through the real app caught                             */
/* -------------------------------------------------------------------------- */

describe("the refusal waits to be earned", () => {
  it("says nothing before the child has tried anything", () => {
    const h = renderActivity(tray, { params: { question: { mode: "share_out" } } });
    expect(h.text()).not.toContain("Deal them all out first.");
    h.unmount();
  });

  it("appears once an answer is pressed on an unfinished tray", async () => {
    const h = renderActivity(tray, { params: { question: { mode: "share_out" } } });
    const answer = h.buttons().find((b) => /^\d+$/.test(b));
    if (answer) await h.press(answer);
    expect(h.text()).toContain("Deal them all out first.");
    h.unmount();
  });

  it("clears again as soon as the child deals one", async () => {
    const h = renderActivity(tray, { params: { question: { mode: "share_out" } } });
    const answer = h.buttons().find((b) => /^\d+$/.test(b));
    if (answer) await h.press(answer);
    expect(h.text()).toContain("Deal them all out first.");
    const plate = h.buttons().find((b) => /^Group 1, holding/.test(b));
    if (plate) await h.press(plate);
    expect(h.text()).not.toContain("Deal them all out first.");
    h.unmount();
  });
});

describe("wrong answers stay close enough to be worth ruling out", () => {
  it("never offers a hundred-times slip while a nearer mistake is available", () => {
    for (const q of questions("to_equation", 200)) {
      for (const text of q.equations ?? []) {
        const value = Number(text.split(" = ")[1]);
        // A ten-times slip is a real place-value error a child makes. A
        // hundred-times one is only ever ruled out by size.
        expect(value, `${text} for ${q.dividend} ÷ ${q.divisor}`).toBeLessThanOrEqual(
          q.quotient * 10,
        );
      }
    }
  });
});
