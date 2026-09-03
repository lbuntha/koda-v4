import { describe, expect, it } from "vitest";
import { fireEvent } from "@testing-library/react";
import { expectStandardRound, renderActivity, type ActivityHarness } from "../kit/testing";
import { skill } from ".";

const tray = skill.activities.tray;
const frames = skill.activities.frames;
const bonds = skill.activities.bonds;
const numberline = skill.activities.numberline;
const facts = skill.activities.facts;
const base10 = skill.activities.base10;
const chart = skill.activities.chart;
const column = skill.activities.column;
const estimate = skill.activities.estimate;
const story = skill.activities.story;
const strategy = skill.activities.strategy;

const expected = (h: ActivityHarness): string => {
  const call = h.koda.only("learning.present").at(-1);
  return String((call?.args[0] as { expected?: string })?.expected);
};

const pressEvery = async (h: ActivityHarness, pattern: RegExp, limit = 30) => {
  for (let i = 0; i < limit; i += 1) {
    const button = h.buttons().find((name) => pattern.test(name));
    if (!button) break;
    await h.press(button);
  }
  await h.settle();
};

describe("the removal tray plays a standard round", () => {
  it("take away: removes the named part before offering the remainder", async () => {
    await expectStandardRound(tray, async (h) => {
      await pressEvery(h, /^\w+ \d+$/, 9);
      await h.press(expected(h));
    }, { params: { mode: "remove", minuendRange: [6, 6], subtrahendRange: [2, 2] }, level: 1 });
  });

  it("remainder: counts only objects not already crossed out", async () => {
    await expectStandardRound(tray, async (h) => {
      await pressEvery(h, /^\w+ \d+$/, 10);
    }, { params: { mode: "remainder", minuendRange: [7, 7], subtrahendRange: [3, 3], settleMs: 0 }, level: 2 });
  });

  it("separate: builds the named part and leaves the other part visible", async () => {
    await expectStandardRound(tray, async (h) => {
      await pressEvery(h, /^\w+ \d+$/, 9);
      await h.press(expected(h));
    }, { params: { mode: "separate", minuendRange: [8, 8], subtrahendRange: [3, 3] }, level: 3 });
  });

  it("matching: makes one-to-one pairs before answering the unmatched count", async () => {
    await expectStandardRound(tray, async (h) => {
      for (let guard = 0; guard < 12; guard += 1) {
        const top = h.buttons().find((name) => /^Larger group .*\d+$/.test(name));
        const bottom = h.buttons().find((name) => /^Smaller group .*\d+$/.test(name));
        if (!top || !bottom) break;
        await h.press(top);
        await h.press(bottom);
      }
      await h.press(expected(h));
    }, { params: { mode: "match_groups", minuendRange: [7, 7], subtrahendRange: [4, 4] }, level: 4 });
  });

  it("equations: selects the exact ordered subtraction statement", async () => {
    await expectStandardRound(tray, async (h) => h.press(expected(h)), {
      params: { mode: "equation_match", minuendRange: [9, 9], subtrahendRange: [4, 4] }, level: 5,
    });
  });

  it("count back: takes exactly the small number of backward steps", async () => {
    await expectStandardRound(tray, async (h) => {
      const before = h.koda.count("learning.answered");
      for (let guard = 0; guard < 3 && h.koda.count("learning.answered") === before; guard += 1) {
        await h.press("Count back one");
      }
      await h.settle();
    }, { params: { mode: "count_back", minuendRange: [12, 12], subtrahendRange: [3, 3], settleMs: 0 }, level: 6 });
  });

  for (const [mode, level] of [["subtract_zero", 7], ["subtract_all", 8], ["subtract_one", 9]] as const) {
    it(`${mode}: chooses the difference shown by the rule`, async () => {
      await expectStandardRound(tray, async (h) => h.press(expected(h)), { params: { mode }, level });
    });
  }

  it("fingers: lowers the removed part, then checks what stays raised", async () => {
    await expectStandardRound(tray, async (h) => {
      const answer = Number(expected(h));
      await h.press(`Finger ${answer + 1}, raised`);
      await h.press("Check");
    }, { params: { mode: "fingers", minuendRange: [8, 8], subtrahendRange: [3, 3] }, level: 10 });
  });

  it("refuses an unfinished finger check without scoring it", async () => {
    const h = renderActivity(tray, { params: { mode: "fingers", minuendRange: [7, 7], subtrahendRange: [2, 2] }, level: 10 });
    const before = h.koda.count("learning.answered");
    await h.press("Check");
    expect(h.koda.count("learning.answered")).toBe(before);
    expect(h.text()).toContain("Lower 2 fingers");
    h.unmount();
  });

  it("undo restores the last removed object", async () => {
    const h = renderActivity(tray, { params: { mode: "remove", minuendRange: [6, 6], subtrahendRange: [3, 3] }, level: 1 });
    await h.press(h.buttons().find((name) => /^\w+ 1$/.test(name))!);
    expect(h.buttons()).toContain("Undo last move");
    await h.press("Undo last move");
    expect(h.buttons()).not.toContain("Undo last move");
    h.unmount();
  });
});

describe("the takeaway frame plays a standard round", () => {
  for (const [mode, level] of [["five", 11], ["ten", 12], ["from_five", 20], ["from_ten", 21]] as const) {
    it(`${mode}: removes counters, then answers with the remainder`, async () => {
      await expectStandardRound(frames, async (h) => {
        for (let guard = 0; guard < 10; guard += 1) {
          const next = h.buttons().find((name) => /^Frame space \d+, filled$/.test(name));
          if (!next) break;
          await h.press(next);
          if (h.buttons().includes(expected(h))) break;
        }
        await h.press(expected(h));
      }, { params: { mode }, level });
    });
  }

  /*
   * Recall is the whole of levels 20 and 21.
   *
   * Left tappable, `from_five` and `from_ten` are levels 11 and 12 again with
   * the minuend pinned: a child who can take the counters out one at a time is
   * counting, and the fact never has to be remembered. So the answer comes
   * first and the frame confirms it afterwards.
   */
  it("recall asks for the fact before it shows the partner", async () => {
    const h = renderActivity(frames, { params: { mode: "from_ten", subtrahendRange: [4, 4] }, level: 21 });
    expect(h.buttons().some((name) => /^Frame space/.test(name)), "a recall frame is tappable").toBe(false);
    expect(h.buttons()).not.toContain("Check");
    expect(h.text()).not.toContain("crossed out");
    expect(h.buttons()).toContain("6");

    await h.press("6");
    expect(h.screen.getByLabelText("10-frame holding 10 counters, 4 crossed out")).toBeTruthy();
    const report = h.koda.only("learning.answered").at(-1)?.args[0] as { correct: boolean };
    expect(report.correct).toBe(true);
    h.unmount();
  });

  it("counting modes keep their tappable counters", () => {
    const h = renderActivity(frames, { params: { mode: "ten", minuendRange: [8, 8], subtrahendRange: [3, 3] }, level: 12 });
    expect(h.buttons().some((name) => /^Frame space/.test(name))).toBe(true);
    expect(h.buttons()).toContain("Check");
    h.unmount();
  });

  it("refuses Check until the named number has been removed", async () => {
    const h = renderActivity(frames, { params: { mode: "ten", minuendRange: [8, 8], subtrahendRange: [3, 3] }, level: 12 });
    const before = h.koda.count("learning.answered");
    await h.press("Check");
    expect(h.koda.count("learning.answered")).toBe(before);
    expect(h.text()).toContain("Take out 3 more");
    h.unmount();
  });

  it("puts the last removed counter back without scoring", async () => {
    const h = renderActivity(frames, { params: { mode: "five", minuendRange: [5, 5], subtrahendRange: [2, 2] }, level: 11 });
    await h.press("Frame space 1, filled");
    expect(h.buttons()).toContain("Put back the last counter");
    await h.press("Put back the last counter");
    expect(h.screen.getByLabelText("Frame space 1, filled")).toBeTruthy();
    expect(h.koda.count("learning.answered")).toBe(0);
    h.unmount();
  });
});

describe("the subtraction bond plays a standard round", () => {
  for (const [mode, level] of [["part_unknown", 13], ["subtrahend_unknown", 43], ["minuend_unknown", 44]] as const) {
    it(`${mode}: fills the named role and submits once`, async () => {
      await expectStandardRound(bonds, async (h) => {
        await h.press(expected(h));
        const before = h.koda.count("learning.answered");
        await h.press("Check");
        expect(h.koda.count("learning.answered") - before).toBe(1);
      }, { params: { mode }, level });
    });
  }

  it("refuses an empty bond without filing an answer", async () => {
    const h = renderActivity(bonds, { params: { mode: "part_unknown" }, level: 13 });
    await h.press("Check");
    expect(h.koda.count("learning.answered")).toBe(0);
    expect(h.text()).toContain("empty box");
    h.unmount();
  });
});

const lineMetric = (h: ActivityHarness): string => {
  const label = h.screen.queryByText(/^(current|distance)$/i);
  return label?.parentElement?.textContent ?? "";
};

const finishLine = async (h: ActivityHarness) => {
  const beforeAnswers = h.koda.count("learning.answered");
  for (let guard = 0; guard < 20 && h.koda.count("learning.answered") === beforeAnswers && !h.buttons().includes(expected(h)); guard += 1) {
    const actions = h.buttons().filter((name) => /^(Jump|Shift)/.test(name));
    expect(actions.length, "number line offered no next move").toBeGreaterThan(0);
    const before = lineMetric(h);
    let moved = false;
    for (const action of actions) {
      await h.press(action);
      if (lineMetric(h) !== before) { moved = true; break; }
    }
    expect(moved, "none of the offered jumps was accepted").toBe(true);
  }
  if (h.koda.count("learning.answered") === beforeAnswers) await h.press(expected(h));
};

describe("the difference line plays a standard round", () => {
  for (const [mode, level] of [
    ["path_back", 14], ["open_back", 15], ["count_up", 16], ["bridge_ten", 22],
    ["bridge_hundred", 23], ["compensate_subtrahend", 25],
    ["constant_difference", 26], ["jump_tens_ones", 31],
  ] as const) {
    it(`${mode}: completes its jumps and answers the difference`, async () => {
      await expectStandardRound(numberline, finishLine, { params: { mode }, level });
    });
  }

  it("refuses crossing-ten jumps in the wrong order without scoring or support", async () => {
    const h = renderActivity(numberline, {
      params: { mode: "bridge_ten", minuendRange: [14, 14], subtrahendRange: [6, 6] }, level: 22,
    });
    const answers = h.koda.count("learning.answered");
    const supports = h.koda.count("learning.supportUsed");
    await h.press("Jump back 2");
    expect(h.koda.count("learning.answered")).toBe(answers);
    expect(h.koda.count("learning.supportUsed")).toBe(supports);
    expect(h.text()).toContain("Land on 10 first");
    h.unmount();
  });

  it("keeps backward arcs labelled with a minus and an arrowhead", async () => {
    const h = renderActivity(numberline, { params: { mode: "open_back", minuendRange: [47, 47], subtrahendRange: [8, 8] }, level: 15 });
    await h.press("Jump back 8");
    const path = h.screen.getByLabelText("Number line starting at 47").querySelector("path[marker-end]");
    expect(path).toBeTruthy();
    expect(h.screen.getByLabelText("Number line starting at 47").textContent).toContain("−8");
    h.unmount();
  });
});

const chooseFactRoute = async (h: ActivityHarness, prefix: RegExp) => {
  for (const route of h.buttons().filter((name) => prefix.test(name))) {
    await h.press(route);
    if (h.buttons().includes(expected(h))) return;
  }
  throw new Error("no fact route revealed the final answer");
};

/*
 * The on-screen line, unlike the printed one, had no room for its own labels.
 * Its viewBox started at x=0 with the endpoint labels centred there, so half of
 * each fell outside it and the scene's `overflow-hidden` cut it off: at 360px
 * bridge-through-100 showed ")" for 0 and "2C" for 200.
 */
describe("the number line makes room for its labels", () => {
  const lineIn = (h: ActivityHarness) => h.screen.getByRole("img", { name: /^Number line starting at/ });
  const box = (h: ActivityHarness) => lineIn(h).getAttribute("viewBox")!.split(" ").map(Number);

  it("pads both ends so an endpoint label is not clipped", () => {
    for (const [mode, level] of [["bridge_ten", 22], ["bridge_hundred", 23], ["path_back", 14]] as const) {
      const h = renderActivity(numberline, { params: { mode }, level });
      const [x, , width] = box(h);
      expect(x, `${mode} starts its viewBox at the line's own edge`).toBeLessThan(0);
      expect(width + x, `${mode} ends its viewBox at the line's own edge`).toBeGreaterThan(1000);
      h.unmount();
    }
  });

  it("drops a start label to a second row when a landmark sits on it", () => {
    const near = renderActivity(numberline, { params: { mode: "bridge_hundred", minuendRange: [104, 104], subtrahendRange: [63, 63] }, level: 23 });
    const labels = [...lineIn(near).querySelectorAll("text")];
    const rowOf = (value: string) => Number(labels.find((n) => n.textContent === value)!.getAttribute("y"));
    expect(rowOf("104")).toBeGreaterThan(rowOf("100"));
    near.unmount();

    // A line whose labels already clear each other keeps them on one row.
    const far = renderActivity(numberline, { params: { mode: "bridge_ten", minuendRange: [14, 14], subtrahendRange: [6, 6] }, level: 22 });
    const rows = new Set([...lineIn(far).querySelectorAll("text")].map((n) => n.getAttribute("y")));
    expect(rows.size).toBe(1);
    far.unmount();
  });
});

describe("the subtraction fact deck plays a standard round", () => {
  it("family: fills all four related facts and submits once", async () => {
    await expectStandardRound(facts, async (h) => {
      const values = expected(h).split(",");
      const fields = h.screen.getAllByRole("textbox", { name: /Answer for family fact/ });
      fields.forEach((field, i) => fireEvent.change(field, { target: { value: values[i] } }));
      const before = h.koda.count("learning.answered");
      await h.press("Check all four");
      expect(h.koda.count("learning.answered") - before).toBe(1);
    }, { params: { mode: "family" }, level: 17 });
  });

  it("missing addend: chooses the inverse equation as support, then answers", async () => {
    await expectStandardRound(facts, async (h) => {
      const answers = h.koda.count("learning.answered");
      const supports = h.koda.count("learning.supportUsed");
      await chooseFactRoute(h, /\+.*=/);
      expect(h.koda.count("learning.answered")).toBe(answers);
      expect(h.koda.count("learning.supportUsed")).toBe(supports + 1);
      await h.press(expected(h));
    }, { params: { mode: "missing_addend" }, level: 18 });
  });

  it("doubles: uses the exposed equal-parts fact", async () => {
    await expectStandardRound(facts, async (h) => h.press(expected(h)), {
      params: { mode: "doubles", nRange: [2, 10] }, level: 19,
    });
  });

  it("known fact: chooses the one-step helper as support, then adjusts", async () => {
    await expectStandardRound(facts, async (h) => {
      const answers = h.koda.count("learning.answered");
      await chooseFactRoute(h, /^Helper fact/);
      expect(h.koda.count("learning.answered")).toBe(answers);
      await h.press(expected(h));
    }, { params: { mode: "known_fact" }, level: 24 });
  });

  it("a wrong related equation is refused, not scored as arithmetic", async () => {
    const h = renderActivity(facts, { params: { mode: "missing_addend", minuendRange: [9, 9], subtrahendRange: [4, 4] }, level: 18 });
    const wrong = h.buttons().find((name) => name === "9 + ? = 4");
    expect(wrong).toBeTruthy();
    await h.press(wrong!);
    expect(h.koda.count("learning.answered")).toBe(0);
    expect(h.koda.count("learning.supportUsed")).toBe(0);
    expect(h.text()).toContain("changes the operand roles");
    h.unmount();
  });

  it("answerInput pad replaces choices and still submits the same answer", async () => {
    const h = renderActivity(facts, { params: { mode: "doubles", nRange: [4, 4] }, level: 19, settings: { answerInput: "pad" } });
    expect(h.buttons()).not.toContain("4");
    await h.press("Digit 4");
    await h.press("Check");
    const report = h.koda.only("learning.answered").at(-1)?.args[0] as { correct: boolean };
    expect(report.correct).toBe(true);
    h.unmount();
  });
});

const nameOf = (id: string): string => ({
  count_back: "Count back", count_up: "Count up", bridge_ten: "Bridge through ten",
  constant_difference: "Keep the same difference", compensate: "Subtract a friendly number",
  place_value_jumps: "Take the tens, then the ones", written_column: "Write it in columns",
}[id] ?? id);

const takeAll = async (h: ActivityHarness, block: string, times: number) => {
  for (let i = 0; i < times; i += 1) await h.press(`Take ${block} 1`);
};

const typeInto = (h: ActivityHarness, name: string | RegExp, value: string) => {
  fireEvent.change(h.screen.getByRole("textbox", { name }), { target: { value } });
};

describe("the base-ten desk plays a standard round", () => {
  it("build_subtract: takes whole rods and units off, then reads the desk", async () => {
    await expectStandardRound(base10, async (h) => {
      await takeAll(h, "ten-rod", 2);
      await takeAll(h, "unit", 3);
      typeInto(h, "Value left on the desk", expected(h));
      await h.press("Check");
    }, { params: { mode: "build_subtract", minuendRange: [47, 47], subtrahendRange: [23, 23] }, level: 27 });
  });

  it("multiples_ten: counts what is left in whole rods", async () => {
    await expectStandardRound(base10, async (h) => {
      await takeAll(h, "ten-rod", 3);
      typeInto(h, "Value left on the desk", expected(h));
      await h.press("Check");
    }, { params: { mode: "multiples_ten", minuendRange: [70, 70], subtrahendRange: [30, 30] }, level: 29 });
  });

  it("multiples_hundred: counts what is left in whole flats", async () => {
    await expectStandardRound(base10, async (h) => {
      await takeAll(h, "hundred-flat", 3);
      typeInto(h, "Value left on the desk", expected(h));
      await h.press("Check");
    }, { params: { mode: "multiples_hundred", minuendRange: [700, 700], subtrahendRange: [300, 300] }, level: 30 });
  });

  it("trade_ten: breaks a rod before the units can be paid", async () => {
    await expectStandardRound(base10, async (h) => {
      await h.press("Break 1 ten into 10 ones");
      await takeAll(h, "ten-rod", 1);
      await takeAll(h, "unit", 8);
      typeInto(h, "Value left on the desk", expected(h));
      await h.press("Check");
    }, { params: { mode: "trade_ten", minuendRange: [52, 52], subtrahendRange: [18, 18] }, level: 36 });
  });

  it("trade_hundred: breaks a flat before the rods can be paid", async () => {
    await expectStandardRound(base10, async (h) => {
      await h.press("Break 1 hundred into 10 tens");
      await takeAll(h, "hundred-flat", 1);
      await takeAll(h, "ten-rod", 8);
      await takeAll(h, "unit", 2);
      typeInto(h, "Value left on the desk", expected(h));
      await h.press("Check");
    }, { params: { mode: "trade_hundred", minuendRange: [425, 425], subtrahendRange: [182, 182] }, level: 37 });
  });

  /*
   * The exchange is the lesson, so the desk must be worth the same after it.
   * A trade that changed the total would teach that regrouping loses value —
   * the one thing base-ten blocks exist to disprove.
   */
  it("breaking a block changes the picture and not the value", async () => {
    const h = renderActivity(base10, { params: { mode: "trade_ten", minuendRange: [52, 52], subtrahendRange: [18, 18] }, level: 36 });
    const onDesk = () => h.screen.getByText("on the desk").parentElement!.textContent!.replace("on the desk", "").trim();
    expect(onDesk()).toBe("52");
    await h.press("Break 1 ten into 10 ones");
    expect(onDesk(), "the trade changed what the desk is worth").toBe("52");
    await h.press("Break 1 ten into 10 ones");
    expect(onDesk()).toBe("52");
    h.unmount();
  });

  it("refuses Check while a required exchange is still owed", async () => {
    const h = renderActivity(base10, { params: { mode: "trade_ten", minuendRange: [52, 52], subtrahendRange: [18, 18] }, level: 36 });
    await h.press("Check");
    expect(h.koda.count("learning.answered")).toBe(0);
    expect(h.text()).toContain("Break one ten-rod into ten units first");
    h.unmount();
  });

  it("refuses Check while blocks are still to come off", async () => {
    const h = renderActivity(base10, { params: { mode: "build_subtract", minuendRange: [47, 47], subtrahendRange: [23, 23] }, level: 27 });
    await h.press("Take ten-rod 1");
    await h.press("Check");
    expect(h.koda.count("learning.answered")).toBe(0);
    expect(h.text()).toContain("Still to take away: 1 ten-rod, 3 units");
    h.unmount();
  });

  it("will not take more of a unit than the question asks for", async () => {
    const h = renderActivity(base10, { params: { mode: "build_subtract", minuendRange: [47, 47], subtrahendRange: [23, 23] }, level: 27 });
    await takeAll(h, "ten-rod", 2);
    await h.press("Take ten-rod 1");
    expect(h.text()).toContain("Only 2 ten-rods come off this desk");
    expect(h.koda.count("learning.answered")).toBe(0);
    h.unmount();
  });
});

describe("the place value desk plays a standard round", () => {
  const fillEveryBox = async (h: ActivityHarness) => {
    const values = expected(h).split(",");
    const boxes = h.screen.getAllByRole("textbox");
    expect(boxes).toHaveLength(values.length);
    boxes.forEach((box, i) => fireEvent.change(box, { target: { value: values[i] } }));
    const before = h.koda.count("learning.answered");
    await h.press("Check");
    expect(h.koda.count("learning.answered") - before, "one submit per question").toBe(1);
  };

  for (const [mode, level] of [["chart_subtract", 28], ["chart_three", 32], ["expanded", 33], ["check_addition", 34], ["left_right", 35]] as const) {
    it(`${mode}: fills every box and submits once`, async () => {
      await expectStandardRound(chart, fillEveryBox, { params: { mode }, level });
    });
  }

  it("refuses Check until every box is filled", async () => {
    const h = renderActivity(chart, { params: { mode: "chart_subtract", minuendRange: [47, 47], subtrahendRange: [23, 23] }, level: 28 });
    await h.press("Check");
    expect(h.koda.count("learning.answered")).toBe(0);
    expect(h.text()).toContain("boxes are still empty");
    h.unmount();
  });

  /*
   * The check is the lesson, not decoration: a sum that does not rebuild the
   * minuend has not checked anything, however tidy it looks.
   */
  it("check_addition only accepts a check that rebuilds the whole", async () => {
    const h = renderActivity(chart, { params: { mode: "check_addition", minuendRange: [47, 47], subtrahendRange: [23, 23] }, level: 34 });
    typeInto(h, "Difference", "24");
    typeInto(h, "Check", "46");
    await h.press("Check");
    const report = h.koda.only("learning.answered").at(-1)?.args[0] as { correct: boolean; expected: string };
    expect(report.correct).toBe(false);
    expect(report.expected).toBe("24,47");
    h.unmount();
  });

  it("names a wrong column as place value rather than a random miss", async () => {
    const h = renderActivity(chart, { params: { mode: "chart_subtract", minuendRange: [47, 47], subtrahendRange: [23, 23] }, level: 28 });
    typeInto(h, "T", "3");
    typeInto(h, "O", "4");
    await h.press("Check");
    const report = h.koda.only("learning.answered").at(-1)?.args[0] as { errorKind: string };
    expect(report.errorKind).toBe("place_value");
    h.unmount();
  });
});

describe("the column pad plays a standard round", () => {
  /** Exchange wherever the pad says a column cannot pay, then write right to left. */
  const workTheColumns = async (h: ActivityHarness) => {
    for (let guard = 0; guard < 4; guard += 1) {
      const exchange = h.buttons().find((name) => /^Exchange into the/.test(name));
      const stuck = h.text().includes("cannot pay yet");
      if (!exchange || !stuck) break;
      await h.press(exchange);
    }
    const digits = expected(h).padStart(h.screen.getAllByRole("textbox").length, "0").split("").reverse();
    for (const [i, digit] of digits.entries()) {
      fireEvent.change(h.screen.getByRole("textbox", { name: `${["ones", "tens", "hundreds"][i]} column` }), { target: { value: digit } });
    }
    await h.press("Check");
  };

  for (const [mode, level] of [["standard", 38], ["cascade", 39], ["across_zero", 40]] as const) {
    it(`${mode}: exchanges where needed, then writes each column`, async () => {
      await expectStandardRound(column, workTheColumns, { params: { mode }, level });
    });
  }

  it("takes the digits right to left and no other way", () => {
    const h = renderActivity(column, { params: { mode: "standard", minuendRange: [52, 52], subtrahendRange: [18, 18] }, level: 38 });
    expect(h.screen.getByRole("textbox", { name: "ones column" }).hasAttribute("disabled")).toBe(false);
    expect(h.screen.getByRole("textbox", { name: "tens column" }).hasAttribute("disabled"), "the tens opened before the ones were written").toBe(true);
    fireEvent.change(h.screen.getByRole("textbox", { name: "ones column" }), { target: { value: "4" } });
    expect(h.screen.getByRole("textbox", { name: "tens column" }).hasAttribute("disabled")).toBe(false);
    h.unmount();
  });

  /*
   * The written exchange is the lesson. A struck-out 5 beside a 4 says what
   * happened; a small unexplained "1" tucked against the ones does not, and is
   * where the algorithm stops meaning anything.
   */
  it("writes the exchange as a struck-out value and its replacement", async () => {
    const h = renderActivity(column, { params: { mode: "standard", minuendRange: [52, 52], subtrahendRange: [18, 18] }, level: 38 });
    expect(h.text()).toContain("cannot pay yet");
    await h.press("Exchange into the ones");
    const shown = h.text();
    expect(shown).toContain("4");
    expect(shown).toContain("12");
    expect(shown).not.toContain("cannot pay yet");
    h.unmount();
  });

  /*
   * Across a zero the child must open the hundred first and then one of those
   * new tens: two written steps, because compressing them is exactly how a
   * child ends up producing digits they cannot explain.
   */
  it("opens the hundred before the empty tens can give anything", async () => {
    const h = renderActivity(column, { params: { mode: "across_zero", minuendRange: [402, 402], subtrahendRange: [185, 185] }, level: 40 });
    await h.press("Exchange into the ones");
    // 402 becomes 3 hundreds, 9 tens and 12 ones — the value is untouched.
    const shown = h.text();
    for (const part of ["3", "9", "12"]) expect(shown).toContain(part);
    fireEvent.change(h.screen.getByRole("textbox", { name: "ones column" }), { target: { value: "7" } });
    fireEvent.change(h.screen.getByRole("textbox", { name: "tens column" }), { target: { value: "1" } });
    fireEvent.change(h.screen.getByRole("textbox", { name: "hundreds column" }), { target: { value: "2" } });
    await h.press("Check");
    const report = h.koda.only("learning.answered").at(-1)?.args[0] as { correct: boolean };
    expect(report.correct).toBe(true);
    h.unmount();
  });

  it("names a dropped exchange as place value, not a random miss", async () => {
    const h = renderActivity(column, { params: { mode: "standard", minuendRange: [52, 52], subtrahendRange: [18, 18] }, level: 38 });
    // The classic slip: take the smaller digit from the larger and move on.
    fireEvent.change(h.screen.getByRole("textbox", { name: "ones column" }), { target: { value: "6" } });
    fireEvent.change(h.screen.getByRole("textbox", { name: "tens column" }), { target: { value: "4" } });
    await h.press("Check");
    const report = h.koda.only("learning.answered").at(-1)?.args[0] as { correct: boolean; errorKind: string };
    expect(report.correct).toBe(false);
    expect(report.errorKind).toBe("place_value");
    h.unmount();
  });

  it("refuses Check until every column is written", async () => {
    const h = renderActivity(column, { params: { mode: "standard", minuendRange: [52, 52], subtrahendRange: [18, 18] }, level: 38 });
    await h.press("Check");
    expect(h.koda.count("learning.answered")).toBe(0);
    expect(h.text()).toContain("Write the ones column before you check");
    h.unmount();
  });
});

describe("the estimate dial plays a standard round", () => {
  it("round_estimate: rounds both numbers as support, then answers 'about'", async () => {
    await expectStandardRound(estimate, async (h) => {
      const supports = h.koda.count("learning.supportUsed");
      await h.press(/^Round both to the nearest/);
      expect(h.koda.count("learning.supportUsed")).toBe(supports + 1);
      await h.press(`about ${expected(h)}`);
    }, { params: { mode: "round_estimate", digits: 3 }, level: 41 });
  });

  it("reasonable: judges the claim and names the reason in one submit", async () => {
    await expectStandardRound(estimate, async (h) => {
      const [verdict, reason] = expected(h).split(",");
      await h.press(verdict === "yes" ? "Reasonable" : "Not reasonable");
      await h.press(reason);
      const before = h.koda.count("learning.answered");
      await h.press("Check");
      expect(h.koda.count("learning.answered") - before).toBe(1);
    }, { params: { mode: "reasonable", digits: 3 }, level: 42 });
  });

  it("will not accept a verdict without its reason", async () => {
    const h = renderActivity(estimate, { params: { mode: "reasonable", digits: 3 }, level: 42 });
    await h.press("Reasonable");
    await h.press("Check");
    expect(h.koda.count("learning.answered")).toBe(0);
    expect(h.text()).toContain("Choose the reason");
    h.unmount();
  });
});

describe("the story board plays a standard round", () => {
  for (const [mode, level] of [
    ["remove_result", 45], ["remove_change", 46], ["remove_start", 47],
    ["compare_difference", 48], ["compare_bigger", 49], ["compare_smaller", 50],
  ] as const) {
    it(`${mode}: draws the bars, then answers the unknown`, async () => {
      await expectStandardRound(story, async (h) => {
        await h.press("Draw the bars");
        await h.press(expected(h));
      }, { params: { mode }, level });
    });
  }

  it("multi_step: answers the middle amount before the final one", async () => {
    await expectStandardRound(story, async (h) => {
      await h.press("Draw the bars");
      const [middle, final] = expected(h).split(",");
      await h.press(middle);
      await h.press(final);
    }, { params: { mode: "multi_step" }, level: 51 });
  });

  /*
   * The middle amount is a gate, not a scored question. A child who has
   * combined the two changes into one number has to be stopped there rather
   * than marked wrong at the end, where the mistake is invisible.
   */
  it("multi_step refuses a wrong middle amount without scoring it", async () => {
    const h = renderActivity(story, { params: { mode: "multi_step" }, level: 51 });
    const [middle] = (h.koda.only("learning.present").at(-1)!.args[0] as { expected: string }).expected.split(",");
    const wrong = h.buttons().find((name) => /^\d+$/.test(name) && name !== middle)!;
    await h.press(wrong);
    expect(h.koda.count("learning.answered"), "a wrong middle amount was scored as an answer").toBe(0);
    expect(h.text()).toContain("Not yet");
    h.unmount();
  });

  /*
   * Comparison is where "subtraction means take away" breaks. Both groups keep
   * everything they have, so nothing in the model may be labelled as removed.
   */
  it("compares two groups without taking anything away", async () => {
    const h = renderActivity(story, { params: { mode: "compare_difference" }, level: 48 });
    await h.press("Draw the bars");
    const model = h.screen.getByRole("group", { name: "Comparison bar model" });
    expect(model.textContent).not.toMatch(/given away|taken/i);
    expect(h.text()).toContain("Nobody gives anything away here");
    h.unmount();
  });

  it("a removal model does name the part that left", async () => {
    const h = renderActivity(story, { params: { mode: "remove_result" }, level: 45 });
    await h.press("Draw the bars");
    expect(h.screen.getByRole("group", { name: "Removal bar model" }).textContent).toMatch(/given away/i);
    h.unmount();
  });
});

describe("the strategy picker plays a standard round", () => {
  it("accepts any strategy that genuinely fits these numbers", async () => {
    await expectStandardRound(strategy, async (h) => {
      const fits = expected(h).split("|");
      const offered = h.buttons().find((name) => fits.some((id) => new RegExp(nameOf(id), "i").test(name)));
      await h.press(offered!);
    }, { params: { mode: "compare_paths" }, level: 52 });
  });

  it("compares two correct paths, never a correct one against a broken one", async () => {
    const h = renderActivity(strategy, { params: { minuendRange: [83, 83], subtrahendRange: [79, 79] }, level: 52 });
    const fits = (h.koda.only("learning.present").at(-1)!.args[0] as { expected: string }).expected.split("|");
    await h.press(h.buttons().find((name) => new RegExp(nameOf(fits[0]), "i").test(name))!);
    const compared = h.screen.getByRole("group", { name: "Two worked paths compared" });
    expect(compared.textContent).toContain("steps");
    expect(h.text()).toContain("Both are correct");
    h.unmount();
  });

  it("marks a strategy the numbers fight as wrong without calling it broken", async () => {
    const h = renderActivity(strategy, { params: { minuendRange: [83, 83], subtrahendRange: [79, 79] }, level: 52 });
    const fits = (h.koda.only("learning.present").at(-1)!.args[0] as { expected: string }).expected.split("|");
    const misfit = h.buttons().find((name) => /Count back/i.test(name) && !fits.includes("count_back"));
    if (misfit) {
      await h.press(misfit);
      const report = h.koda.only("learning.answered").at(-1)?.args[0] as { correct: boolean };
      expect(report.correct).toBe(false);
      expect(h.text()).toContain("works in general, but not well here");
    }
    h.unmount();
  });
});
