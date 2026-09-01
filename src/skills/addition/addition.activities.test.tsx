import { describe, expect, it } from "vitest";
import { expectStandardRound, renderActivity, type ActivityHarness } from "../kit/testing";
import { skill } from ".";

/**
 * Addition's behaviour tests — one driver per engine.
 *
 * The kit drives the round and asserts everything that is the same for every
 * skill: the lesson opens before the first question, every answer is reported,
 * the log closes once, XP is awarded once through the SDK, and a clean round is
 * three stars. All a skill writes is how a child answers correctly, because
 * only the skill knows what its buttons mean.
 *
 * Answers are read out of the telemetry rather than recomputed. The activity
 * already tells the host what it expects via `learning.present`, so a test that
 * reads it cannot drift from the activity's own idea of the answer — and a
 * missing `expected` fails here instead of passing quietly.
 */

const { tray, frames, bonds, numberline, base10, chart, facts, multi, column } =
  skill.activities;

const expected = (h: ActivityHarness): string => {
  const last = h.koda.only("learning.present").at(-1);
  const question = last?.args[0] as { expected?: string } | undefined;
  expect(question?.expected, "activity presented a question with no expected answer").toBeTruthy();
  return String(question!.expected);
};

/** Every object still waiting for a number, in the order they are on screen. */
const nextUncounted = (h: ActivityHarness): string | undefined =>
  h.buttons().find((name) => /^(First group|Second group|Pile) /.test(name) && !name.endsWith(", counted"));

/** Touch every object there is to touch. How all four counting modes answer. */
const countEverything = async (h: ActivityHarness) => {
  for (let guard = 0; guard < 40; guard += 1) {
    const next = nextUncounted(h);
    if (!next) break;
    await h.press(next);
  }
  // `settleMs: 0` below: the activity holds after the last tap so the final
  // number is heard, and waiting a real second per question for a sound this
  // test does not assert on is a slow suite for no cover.
  await h.settle();
};

describe("the tray plays a standard round", () => {
  it("count all: touching every object in both groups", async () => {
    await expectStandardRound(tray, countEverything, {
      params: { mode: "count_all", addendRange: [2, 4], sumMax: 8, settleMs: 0 },
    });
  });

  it("combine: putting the groups together, then counting the pile", async () => {
    await expectStandardRound(
      tray,
      async (h) => {
        await h.press("Put them together");
        await countEverything(h);
      },
      { params: { mode: "combine", addendRange: [2, 3], settleMs: 0 }, level: 2 },
    );
  });

  it("count on: the first group is closed, so only the second is touchable", async () => {
    await expectStandardRound(
      tray,
      async (h) => {
        // The closed bin is disabled, so `buttons()` never offers it — which is
        // the interaction working: there is nothing there to re-count.
        expect(h.buttons().some((b) => b.startsWith("First group"))).toBe(false);
        await countEverything(h);
      },
      { params: { mode: "count_on", aRange: [5, 7], bRange: [2, 3], settleMs: 0 }, level: 3 },
    );
  });

  it("count on from the larger: the smaller start is refused, not scored", async () => {
    await expectStandardRound(
      tray,
      async (h) => {
        const starts = h
          .buttons()
          .filter((b) => b.startsWith("Start from "))
          .map((b) => Number(b.replace("Start from ", "")));
        expect(starts).toHaveLength(2);

        // Tapping the smaller number is a wrong *route*, not a wrong answer:
        // the child has not said what the total is yet, so nothing may be filed
        // against them for it — and they never asked for help, so no support
        // may be filed either. What they get is a sentence saying why.
        const answers = h.koda.count("learning.answered");
        const supports = h.koda.count("learning.supportUsed");
        await h.press(`Start from ${Math.min(...starts)}`);
        expect(h.koda.count("learning.answered"), "a refused route was scored").toBe(answers);
        expect(h.koda.count("learning.supportUsed"), "a refusal was logged as a hint").toBe(supports);
        expect(h.text(), "a refused move said nothing").toContain("Start at");

        await h.press(`Start from ${Math.max(...starts)}`);
        await countEverything(h);
      },
      { params: { mode: "count_on_larger", aRange: [1, 3], bRange: [6, 8], settleMs: 0 }, level: 4 },
    );
  });

  it("add zero: choosing the number it started with", async () => {
    await expectStandardRound(
      tray,
      async (h) => {
        await h.press(expected(h));
      },
      { params: { mode: "add_zero", aRange: [3, 9] }, level: 5 },
    );
  });

  it("add one: choosing the next counting number", async () => {
    await expectStandardRound(
      tray,
      async (h) => {
        await h.press(expected(h));
      },
      { params: { mode: "add_one", aRange: [4, 12] }, level: 6 },
    );
  });

  it("a group too big to draw is shown as its number", async () => {
    // Fourteen objects beside one object is a blob beside a thing: a child
    // cannot see "fourteen" in it, so the shapes buy nothing and cost clarity.
    const h = renderActivity(tray, {
      params: { mode: "add_one", aRange: [14, 14], flipChance: 0 },
      level: 6,
    });
    // Stated as a number, and not as a control: there is nothing to do to it.
    expect(h.screen.getByLabelText(/^A group of 14/)).toBeTruthy();
    expect(h.buttons().some((b) => /group .* 12/.test(b)), "fourteen objects were drawn").toBe(false);
    h.unmount();
  });

  it("fingers: raising both hands, then checking", async () => {
    await expectStandardRound(
      tray,
      async (h) => {
        // Scored on the total, so the split may be any that reaches it — a hand
        // holds five, which is why the left one is filled first.
        const sum = Number(expected(h));
        const left = Math.min(5, sum);
        const right = sum - left;
        if (left > 0) await h.press(`Left finger ${left}`);
        if (right > 0) await h.press(`Right finger ${right}`);
        await h.press("Check");
      },
      { params: { mode: "fingers", addendRange: [2, 5], sumMax: 10 }, level: 7 },
    );
  });
});

/** Cells still waiting for a counter, in the order they sit in the frame. */
const emptySpaces = (h: ActivityHarness): string[] =>
  h.buttons().filter((name) => /^Space \d+, empty$/.test(name));

const filledSpaces = (h: ActivityHarness): number =>
  h.screen.queryAllByLabelText(/^Space \d+, filled$/).length;

describe("the frame plays a standard round", () => {
  it("ten frame: adding counters and reading the total", async () => {
    await expectStandardRound(
      frames,
      async (h) => {
        // The counters that arrive are already counted — the child adds the
        // rest, and the answer is the whole frame.
        const total = Number(expected(h));
        for (let guard = 0; guard < 20 && filledSpaces(h) < total; guard += 1) {
          const next = emptySpaces(h)[0];
          if (!next) break;
          await h.press(next);
        }
        await h.press("Check");
      },
      { params: { mode: "ten", addendRange: [2, 4], sumMax: 8 }, level: 9 },
    );
  });

  it("make ten: the answer is what was added, not what is in the frame", async () => {
    // The distinction this engine exists to teach, and the likeliest thing to
    // get backwards: the child fills the frame to ten, and is asked how many
    // that took — never for the ten.
    await expectStandardRound(
      frames,
      async (h) => {
        const added = Number(expected(h));
        for (let guard = 0; guard < 20; guard += 1) {
          const next = emptySpaces(h)[0];
          if (!next) break;
          await h.press(next);
        }
        expect(filledSpaces(h), "the frame was not filled").toBe(10);
        expect(added, "the answer was the whole frame, not the part added").toBeLessThan(10);
        await h.press("Check");
      },
      { params: { mode: "make_ten" }, level: 19 },
    );
  });

  it("checking an untouched frame is refused, not scored", async () => {
    const h = renderActivity(frames, { params: { mode: "ten" }, level: 9 });
    const before = h.koda.count("learning.answered");
    await h.press("Check");
    expect(h.koda.count("learning.answered"), "an empty check was scored").toBe(before);
    expect(h.text()).toContain("empty spaces");
    h.unmount();
  });
});

describe("the bond plays a standard round", () => {
  it("whole unknown: typing what the two parts make", async () => {
    await expectStandardRound(
      bonds,
      async (h) => {
        for (const digit of expected(h)) await h.press(`Digit ${digit}`);
        await h.press("Check");
      },
      { params: { mode: "whole_unknown", addendRange: [2, 5], sumMax: 10 }, level: 10 },
    );
  });

  it("splitting an addend: four boxes, one answer", async () => {
    // Two blanks and a single Check. One submit per box would file two answers
    // for one question and wreck first-try accuracy.
    await expectStandardRound(
      bonds,
      async (h) => {
        const parts = expected(h).split(",");
        const ids = ["p1", "p2"];
        for (const [i, part] of parts.entries()) {
          await h.press(new RegExp(`^Box ${ids[i]},`));
          for (const digit of part) await h.press(`Digit ${digit}`);
        }
        await h.press("Check");
      },
      { params: { mode: "split_one" }, level: 22 },
    );
  });

  it("checking an empty bond is refused, not scored", async () => {
    const h = renderActivity(bonds, { params: { mode: "whole_unknown" }, level: 10 });
    const before = h.koda.count("learning.answered");
    await h.press("Check");
    expect(h.koda.count("learning.answered")).toBe(before);
    expect(h.text()).toContain("Tap a box");
    h.unmount();
  });
});

/** Type a number into the pad, digit by digit. */
const typeNumber = async (h: ActivityHarness, value: string) => {
  for (const digit of value) await h.press(`Digit ${digit}`);
};

describe("the number line plays a standard round", () => {
  it("path: hopping one square at a time until it arrives", async () => {
    await expectStandardRound(
      numberline,
      async (h) => {
        // A ticked line answers by arriving — the tile disables itself once the
        // marker lands, so the driver stops when the move is gone.
        for (let guard = 0; guard < 25; guard += 1) {
          if (!h.buttons().includes("Jump forward 1")) break;
          await h.press("Jump forward 1");
        }
      },
      { params: { mode: "path", aRange: [2, 4], bRange: [2, 3] }, level: 11 },
    );
  });

  it("open: taking the jump, then saying where it landed", async () => {
    await expectStandardRound(
      numberline,
      async (h) => {
        const total = expected(h);
        const tile = h.buttons().find((b) => /^Jump forward \d+$/.test(b));
        expect(tile, "no jump was offered").toBeTruthy();
        await h.press(tile!);
        await typeNumber(h, total);
        await h.press("Check");
      },
      { params: { mode: "open", aRange: [10, 20], bRange: [3, 6] }, level: 12 },
    );
  });

  it("open: answering before jumping is refused, not scored", async () => {
    // The jump is the working. Checking without it is not a wrong answer, it is
    // an unfinished one.
    const h = renderActivity(numberline, { params: { mode: "open" }, level: 12 });
    const before = h.koda.count("learning.answered");
    await h.press("Check");
    expect(h.koda.count("learning.answered")).toBe(before);
    expect(h.text()).toContain("Take the jumps first");
    h.unmount();
  });

  it("bridging a ten: choosing the jump is the answer", async () => {
    await expectStandardRound(
      numberline,
      async (h) => {
        await h.press(`Jump forward ${expected(h)}`);
      },
      { params: { mode: "bridge_ten" }, level: 20 },
    );
  });

  it("tens then ones: two jumps in either order, one answer", async () => {
    await expectStandardRound(
      numberline,
      async (h) => {
        const total = expected(h);
        // Taken in whatever order the tiles happen to be shuffled into, which
        // is the point: either order lands on the same number.
        for (const tile of h.buttons().filter((b) => /^Jump forward \d+$/.test(b))) {
          await h.press(tile);
        }
        await typeNumber(h, total);
        await h.press("Check");
      },
      { params: { mode: "jump_tens_ones" }, level: 31 },
    );
  });
});

describe("the block yard plays a standard round", () => {
  it("build: dropping rods and units until the yard holds the answer", async () => {
    await expectStandardRound(
      base10,
      async (h) => {
        let left = Number(expected(h));
        for (let guard = 0; guard < 40 && left >= 10; guard += 1) {
          await h.press("Add a ten rod");
          left -= 10;
        }
        for (let guard = 0; guard < 12 && left > 0; guard += 1) {
          await h.press("Add a one unit");
          left -= 1;
        }
        await h.press("Check");
      },
      { params: { mode: "build_add", addendRange: [11, 34] }, level: 13 },
    );
  });

  it("trading: the exchange is required, and refusing it is not a wrong answer", async () => {
    await expectStandardRound(
      base10,
      async (h) => {
        // The yard arrives holding both numbers un-carried, so the value in it
        // is already right — but the lesson is the exchange, and checking
        // before it must not be scored as bad arithmetic.
        const answers = h.koda.count("learning.answered");
        await h.press("Check");
        expect(h.koda.count("learning.answered"), "an unfinished exchange was scored").toBe(answers);
        expect(h.text()).toContain("Bundle ten");

        await h.press("Bundle ten ones");
        await h.press("Check");
      },
      { params: { mode: "trade_ones", addendRange: [15, 48] }, level: 36 },
    );
  });
});

describe("the place-value chart plays a standard round", () => {
  const typeInto = async (h: ActivityHarness, label: RegExp, value: string) => {
    const box = h.screen.getByLabelText(label) as HTMLInputElement;
    await h.settle();
    box.focus();
    // A controlled input: set the value the way a child's keystroke would.
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
    setter.call(box, value);
    box.dispatchEvent(new Event("input", { bubbles: true }));
    await h.settle();
  };

  it("chart: filling the total, one column at a time", async () => {
    await expectStandardRound(
      chart,
      async (h) => {
        const [tens, ones] = expected(h).split(",");
        await typeInto(h, /^Total, T$/, tens);
        await typeInto(h, /^Total, O$/, ones);
        await h.press("Check");
      },
      { params: { mode: "chart_add", addendRange: [11, 44] }, level: 14 },
    );
  });

  it("an empty chart is refused, not scored", async () => {
    const h = renderActivity(chart, { params: { mode: "chart_add" }, level: 14 });
    const before = h.koda.count("learning.answered");
    await h.press("Check");
    expect(h.koda.count("learning.answered")).toBe(before);
    expect(h.text()).toContain("Fill in the boxes");
    h.unmount();
  });
});

describe("the fact deck plays a standard round", () => {
  const typeAnswer = async (h: ActivityHarness, value: string) => {
    for (const digit of value) await h.press(`Digit ${digit}`);
    await h.press("Check");
  };

  it("doubles: typing the total", async () => {
    await expectStandardRound(
      facts,
      async (h) => typeAnswer(h, expected(h)),
      { params: { mode: "doubles", nRange: [2, 8] }, level: 15 },
    );
  });

  it("near doubles: naming the double is help, not an answer", async () => {
    await expectStandardRound(
      facts,
      async (h) => {
        // Fetching the fact the strategy is built on is the behaviour the
        // lesson wants. Scoring it would mark a child down for using it.
        const answers = h.koda.count("learning.answered");
        const supports = h.koda.count("learning.supportUsed");
        const reveal = h.buttons().find((b) => /^Show the double/.test(b));
        expect(reveal, "the double was not offered").toBeTruthy();
        await h.press(reveal!);
        expect(h.koda.count("learning.answered"), "a support was scored").toBe(answers);
        expect(h.koda.count("learning.supportUsed")).toBe(supports + 1);

        await typeAnswer(h, expected(h));
      },
      { params: { mode: "near_up", nRange: [2, 8] }, level: 16 },
    );
  });

  it("switching the addends: restating the fact reads as reversed", async () => {
    const h = renderActivity(facts, { params: { mode: "commute" }, level: 26 });
    // The switched fact is the answer, so the fact the child was *shown* is it
    // the other way round. It is among the choices on purpose: restating the
    // original is the mistake this lesson is named after, so it has to be
    // available to make.
    const [switchedA, switchedB] = expected(h).split("+");
    await h.press(`${switchedB} plus ${switchedA}`);
    const report = h.koda.only("learning.answered").at(-1)!.args[0] as {
      correct: boolean;
      errorKind?: string;
    };
    expect(report.correct).toBe(false);
    expect(report.errorKind).toBe("reversed");
    h.unmount();
  });

  it("switching the addends: choosing the other way round", async () => {
    await expectStandardRound(
      facts,
      async (h) => {
        const [a, b] = expected(h).split("+");
        await h.press(`${a} plus ${b}`);
      },
      { params: { mode: "commute" }, level: 26 },
    );
  });

  it("a wrong helper fact is refused, not scored", async () => {
    // Pinned, so the unhelpful fact is known rather than hunted for: with
    // 5 + 7 the helper is the double 5 + 5, and 7 + 7 is a real fact that does
    // not help. Every option being real is the point — a child cannot pick
    // correctly by spotting the silly one. The gap of two is deliberate: the
    // generator refuses a wider one, because a helper that far away helps with
    // nothing.
    const h = renderActivity(facts, {
      params: { mode: "known_fact", aRange: [5, 5], bRange: [7, 7] },
      level: 24,
    });
    expect(h.buttons()).toContain("Helper fact 5 plus 5");

    const answers = h.koda.count("learning.answered");
    await h.press("Helper fact 7 plus 7");
    expect(h.koda.count("learning.answered"), "a wrong route was scored").toBe(answers);
    expect(h.text()).toContain("Look for a double");
    h.unmount();
  });
});

describe("the chain board plays a standard round", () => {
  const chipsOn = (h: ActivityHarness) => h.buttons().filter((b) => /^Chip \d+, value \d+$/.test(b));
  const valueOf = (label: string) => Number(/value (\d+)/.exec(label)![1]);

  /** Merge every chip into one, two taps at a time. */
  const mergeAll = async (h: ActivityHarness) => {
    for (let guard = 0; guard < 10; guard += 1) {
      const chips = chipsOn(h);
      if (chips.length < 2) break;
      await h.press(chips[0]);
      await h.press(chips[1]);
    }
  };

  it("pairs: merging chips until one number is left", async () => {
    await expectStandardRound(
      multi,
      async (h) => {
        await mergeAll(h);
        await h.press("Check");
      },
      { params: { mode: "pairs", count: 4, target: 10 }, level: 27 },
    );
  });

  it("checking a board that is still in pieces is refused, not scored", async () => {
    const h = renderActivity(multi, { params: { mode: "pairs", count: 4 }, level: 27 });
    const before = h.koda.count("learning.answered");
    await h.press("Check");
    expect(h.koda.count("learning.answered")).toBe(before);
    expect(h.text()).toContain("still on the board");
    h.unmount();
  });

  it("two chips become one that says what it became", async () => {
    const h = renderActivity(multi, { params: { mode: "pairs", count: 4 } }, );
    const before = chipsOn(h);
    expect(before).toHaveLength(4);
    const [first, second] = before;
    const merged = valueOf(first) + valueOf(second);

    await h.press(first);
    await h.press(second);

    const after = chipsOn(h);
    expect(after).toHaveLength(3);
    expect(after.map(valueOf)).toContain(merged);
    // The ten is the reason the pair was worth finding, so it is heard too.
    expect(h.koda.only("speech.say").map((c) => c.args[0])).toContain(
      ["zero","one","two","three","four","five","six","seven","eight","nine","ten",
       "eleven","twelve","thirteen","fourteen","fifteen","sixteen","seventeen",
       "eighteen","nineteen","twenty"][merged] ?? String(merged),
    );
    h.unmount();
  });

  it("running total: every step checked, one answer reported", async () => {
    await expectStandardRound(
      multi,
      async (h) => {
        const totals: number[] = [];
        const values = (h.koda.only("learning.present").at(-1)!.args[0] as { itemCount?: number });
        expect(values.itemCount).toBeGreaterThan(1);
        // Read the chain off the screen, then fill each running total in turn.
        const boxes = h.screen.getAllByLabelText(/^Total after adding \d+$/) as HTMLInputElement[];
        const chain = boxes.map((b) => Number(/adding (\d+)/.exec(b.getAttribute("aria-label")!)![1]));
        const start = Number(expected(h)) - chain.reduce((t, n) => t + n, 0);
        let running = start;
        for (const n of chain) {
          running += n;
          totals.push(running);
        }
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
        for (const [i, box] of boxes.entries()) {
          setter.call(box, String(totals[i]));
          box.dispatchEvent(new Event("input", { bubbles: true }));
        }
        await h.settle();
        await h.press("Check");
      },
      { params: { mode: "running", count: 4, addendRange: [2, 9], totalMax: 40 }, level: 42 },
    );
  });
});

describe("the column pad plays a standard round", () => {
  const setBox = (h: ActivityHarness, label: RegExp, value: string) => {
    const box = h.screen.getByLabelText(label) as HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
    setter.call(box, value);
    box.dispatchEvent(new Event("input", { bubbles: true }));
  };

  /** Fill every answer column, and every carry the sum actually needs. */
  const workTheColumns = async (h: ActivityHarness) => {
    const total = expected(h);
    const answerBoxes = h.screen.getAllByLabelText(/^Answer, /) as HTMLInputElement[];
    const digits = total.padStart(answerBoxes.length, "0").split("");
    for (const [i, box] of answerBoxes.entries()) {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
      setter.call(box, digits[i]);
      box.dispatchEvent(new Event("input", { bubbles: true }));
    }
    for (const carry of h.screen.queryAllByLabelText(/^Carry into /) as HTMLInputElement[]) {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
      setter.call(carry, "1");
      carry.dispatchEvent(new Event("input", { bubbles: true }));
    }
    await h.settle();
    await h.press("Check");
  };

  it("standard: one carry, written down", async () => {
    await expectStandardRound(column, workTheColumns, {
      params: { mode: "standard" },
      level: 39,
    });
  });

  it("cascading: two carries, one caused by the other", async () => {
    await expectStandardRound(column, workTheColumns, {
      params: { mode: "cascade" },
      level: 38,
    });
  });

  it("the right answer without the carry written is refused, not scored", async () => {
    // A child who added the ones and kept the ten in their head has the right
    // sum and has skipped the step the lesson is about. Marking that wrong
    // would tell them their arithmetic failed, when it did not.
    const h = renderActivity(column, { params: { mode: "standard" }, level: 39 });
    const total = (h.koda.only("learning.present").at(-1)!.args[0] as { expected: string }).expected;
    const boxes = h.screen.getAllByLabelText(/^Answer, /) as HTMLInputElement[];
    const digits = total.padStart(boxes.length, "0").split("");
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
    for (const [i, box] of boxes.entries()) {
      setter.call(box, digits[i]);
      box.dispatchEvent(new Event("input", { bubbles: true }));
    }
    await h.settle();

    const before = h.koda.count("learning.answered");
    await h.press("Check");
    expect(h.koda.count("learning.answered"), "a missing carry was scored").toBe(before);
    expect(h.text()).toContain("Write its carry");
    h.unmount();
  });
});

