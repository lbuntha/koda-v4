import { describe, expect, it } from "vitest";
import { COUNTABLES } from "./internal/data/subtractionAssets";
import { buildQuestion, choicesFor, equationChoicesFor, specFor, trayHints, type TrayQuestion } from "./activities/RemoveTray";
import { buildQuestion as buildFrame, frameHints, isRecall, specFor as frameSpec } from "./activities/FrameTakeaway";
import { bondHints, buildQuestion as buildBond } from "./activities/BondHouse";
import { buildQuestion as buildLine, lineHints, specFor as lineSpec } from "./activities/DifferenceLine";
import { buildQuestion as buildFact, factHints, isOneStepHelper } from "./activities/FactDeck";
import { blockHints, buildQuestion as buildBlocks, owedExchange, remainingNeed, totalOf } from "./activities/BlockExchange";
import { buildQuestion as buildChart, chartHints } from "./activities/PlaceValueDesk";
import { buildQuestion as buildColumn, columnHints, markFor } from "./activities/ColumnPad";
import { claimsFor, isReasonable, REASONS, reverseColumns } from "./activities/EstimateDial";

const question = (over: Partial<TrayQuestion> = {}): TrayQuestion => ({
  id: "q1", taskKind: "subtract_remove", mode: "remove", minuend: 8,
  subtrahend: 3, difference: 5, asset: COUNTABLES[0], expected: "5", itemCount: 8, ...over,
});
const idle = { removed: 0, counted: 0, paired: 0, countValue: 8, fingersUp: 8 };

describe("the subtraction tray hints", () => {
  it("opens with the lesson tip and describes current progress", () => {
    const hints = trayHints(question(), { ...idle, removed: 2, kidTip: "Take away the part." });
    expect(hints[0]).toBe("Take away the part.");
    expect(hints[1]).toContain("taken away 2");
    expect(hints[1]).toContain("1 more");
  });

  it("keeps comparison about pairs and unmatched objects", () => {
    const hints = trayHints(question({ mode: "match_groups" }), { ...idle, paired: 2 });
    expect(hints[1]).toContain("2 pairs");
    expect(hints.at(-1)).toContain("unmatched");
  });

  it("reads the live count-back position", () => {
    const hints = trayHints(question({ mode: "count_back" }), { ...idle, countValue: 6 });
    expect(hints[1]).toContain("at 6");
    expect(hints[1]).toContain("moved 2");
  });

  it("keeps four nonnegative answer choices around the answer", () => {
    expect(choicesFor(0)).toEqual([0, 1, 2, 3]);
    expect(choicesFor(7)).toEqual([5, 6, 7, 8]);
  });

  it("offers one exact ordered equation and three distinct distractors", () => {
    const q = question({ mode: "equation_match", expected: "8 − 3 = 5" });
    const choices = equationChoicesFor(q);
    expect(choices).toHaveLength(4);
    expect(new Set(choices).size).toBe(4);
    expect(choices.filter((value) => value === q.expected)).toHaveLength(1);
  });
});

describe("the subtraction tray generator", () => {
  it("keeps identity rules hard even when lesson ranges disagree", () => {
    expect(specFor("subtract_zero", { subtrahendRange: [7, 9] }).subtrahendRange).toEqual([0, 0]);
    expect(specFor("subtract_one", { subtrahendRange: [7, 9] }).subtrahendRange).toEqual([1, 1]);
    expect(specFor("subtract_all", { differenceRange: [4, 6] }).differenceRange).toEqual([0, 0]);
  });

  it("does not repeat a question inside a round", () => {
    const seen = new Set<string>();
    const asked = Array.from({ length: 5 }, (_, i) => buildQuestion({ mode: "remove" }, i, seen));
    expect(new Set(asked.map((q) => `${q.minuend}-${q.subtrahend}`)).size).toBe(5);
  });
});

describe("the frame and bond teaching state", () => {
  it("frames describe exactly how many counters still need to leave", () => {
    const q = buildFrame({ mode: "ten", minuendRange: [8, 8], subtrahendRange: [3, 3] }, 0, new Set());
    expect(frameHints(q, { removed: 2 })[1]).toContain("Take out 1 more");
  });

  it("from-five and from-ten keep their benchmark even if a lesson disagrees", () => {
    expect(frameSpec("from_five", { minuendRange: [2, 3] }).minuendRange).toEqual([5, 5]);
    expect(frameSpec("from_ten", { minuendRange: [2, 3] }).minuendRange).toEqual([10, 10]);
  });

  it("each bond mode asks for the correct operand role", () => {
    for (const mode of ["part_unknown", "subtrahend_unknown", "minuend_unknown"] as const) {
      const q = buildBond({ mode }, 0, new Set());
      const expected = q.blankRole === "whole" ? q.minuend : q.blankRole === "removed" ? q.subtrahend : q.difference;
      expect(q.expected).toBe(String(expected));
    }
  });

  it("a missing whole tells the child to put both parts together", () => {
    const q = buildBond({ mode: "minuend_unknown" }, 0, new Set());
    expect(bondHints(q, {})[1]).toContain("back together");
  });
});

describe("the difference line strategy contract", () => {
  it("count-up starts at the subtrahend and counts a short distance", () => {
    for (let i = 0; i < 100; i += 1) {
      const q = buildLine({ mode: "count_up" }, i, new Set());
      expect(q.from).toBe(q.subtrahend);
      expect(q.required).toHaveLength(q.difference);
      expect(q.difference).toBeLessThanOrEqual(10);
      expect(q.required.every((step) => step === 1)).toBe(true);
    }
  });

  it("bridging lands on the boundary before continuing", () => {
    const ten = buildLine({ mode: "bridge_ten", minuendRange: [14, 14], subtrahendRange: [6, 6] }, 0, new Set());
    expect(ten.from + ten.required[0]).toBe(10);
    expect(ten.required.reduce((at, step) => at + step, ten.from)).toBe(ten.difference);

    const hundred = buildLine({ mode: "bridge_hundred", minuendRange: [132, 132], subtrahendRange: [47, 47] }, 0, new Set());
    expect(hundred.from + hundred.required[0]).toBe(100);
    expect(hundred.required.reduce((at, step) => at + step, hundred.from)).toBe(hundred.difference);
  });

  it("compensation subtracts too much and then adds the excess back", () => {
    const q = buildLine({ mode: "compensate_subtrahend", minuendRange: [83, 83], subtrahendRange: [29, 29] }, 0, new Set());
    expect(q.required).toEqual([-30, 1]);
    expect(q.required.reduce((at, step) => at + step, q.from)).toBe(54);
  });

  it("constant difference changes both operands by the same offset", () => {
    for (let i = 0; i < 100; i += 1) {
      const q = buildLine({ mode: "constant_difference" }, i, new Set());
      expect(q.adjustedMinuend).toBe(q.minuend + q.offset!);
      expect(q.adjustedSubtrahend).toBe(q.subtrahend + q.offset!);
      expect(q.adjustedMinuend! - q.adjustedSubtrahend!).toBe(q.difference);
      expect(q.adjustedSubtrahend! % 10).toBe(0);
    }
  });

  it("tens and ones accepts either order but never introduces regrouping", () => {
    const q = buildLine({ mode: "jump_tens_ones", minuendRange: [87, 87], subtrahendRange: [42, 42] }, 0, new Set());
    expect(q.ordered).toBe(false);
    expect([...q.required].sort((a, b) => a - b)).toEqual([-40, -2]);
    expect(q.required.reduce((at, step) => at + step, q.from)).toBe(45);
  });

  it("hardens the strategy-defining constraints", () => {
    expect(lineSpec("count_up", { differenceRange: [20, 30] }).smallDifference).toBe(true);
    expect(lineSpec("bridge_ten", {}).crossBoundary).toBe(10);
    expect(lineSpec("bridge_hundred", {}).crossBoundary).toBe(100);
    expect(lineSpec("compensate_subtrahend", {}).subtrahendEndsIn).toEqual([8, 9]);
    expect(lineSpec("jump_tens_ones", {}).exchange).toBe("never");
  });

  it("hints distinguish a landing value from a measured distance", () => {
    const q = buildLine({ mode: "count_up", minuendRange: [83, 83], subtrahendRange: [79, 79] }, 0, new Set());
    expect(lineHints(q, { at: 81, made: [1, 1] })[1]).toContain("counted up 2 of 4");
  });
});

describe("the recall frames", () => {
  it("names the two modes that ask before they show", () => {
    expect(["five", "ten", "from_five", "from_ten"].filter((mode) =>
      isRecall(mode as Parameters<typeof isRecall>[0]))).toEqual(["from_five", "from_ten"]);
  });

  it("hints name the partners instead of counting counters out", () => {
    const q = buildFrame({ mode: "from_ten", subtrahendRange: [4, 4] }, 0, new Set());
    const hints = frameHints(q, { removed: 0 });
    expect(hints[1]).toContain("still holds all 10");
    expect(hints[1]).not.toContain("Take out");
    expect(hints.at(-1)).toBe("4 and 6 are the partners that make 10.");
  });

  it("counting frames still coach the removal", () => {
    const q = buildFrame({ mode: "ten", minuendRange: [8, 8], subtrahendRange: [3, 3] }, 0, new Set());
    expect(frameHints(q, { removed: 1 })[1]).toContain("Take out 2 more");
  });
});

describe("the subtraction fact relationships", () => {
  it("builds two additions and two ordered subtractions from one family", () => {
    const q = buildFact({ mode: "family", minuendRange: [8, 8], subtrahendRange: [3, 3] }, 0, new Set());
    expect(q.members).toEqual([
      { text: "3 + 5 =", answer: 8 },
      { text: "5 + 3 =", answer: 8 },
      { text: "8 − 3 =", answer: 5 },
      { text: "8 − 5 =", answer: 3 },
    ]);
    expect(q.expected).toBe("8,8,5,3");
  });

  it("turns subtraction into known part plus missing part equals whole", () => {
    const q = buildFact({ mode: "missing_addend", minuendRange: [9, 9], subtrahendRange: [4, 4] }, 0, new Set());
    expect(q.correctRelation).toBe("4 + ? = 9");
    expect(q.expected).toBe("5");
    expect(new Set(q.relations).size).toBe(3);
  });

  it("makes doubles from two equal parts", () => {
    for (let i = 0; i < 50; i += 1) {
      const q = buildFact({ mode: "doubles", nRange: [2, 10] }, i, new Set());
      expect(q.minuend).toBe(q.subtrahend * 2);
      expect(q.difference).toBe(q.subtrahend);
    }
  });

  it("keeps a known helper exactly one step from the target", () => {
    let removingMore = false;
    let removingLess = false;
    for (let i = 0; i < 200; i += 1) {
      const q = buildFact({ mode: "known_fact" }, i, new Set());
      const change = q.helper!.subtrahend - q.subtrahend;
      expect(Math.abs(change)).toBe(1);
      expect(q.helper!.minuend).toBe(q.minuend);
      expect(Math.abs(q.helper!.difference - q.difference)).toBe(1);
      if (change > 0) removingMore = true;
      if (change < 0) removingLess = true;
    }
    expect(removingMore).toBe(true);
    expect(removingLess).toBe(true);
  });

  it("never builds a family whose two parts are equal", () => {
    for (let i = 0; i < 200; i += 1) {
      const q = buildFact({ mode: "family" }, i, new Set());
      expect(q.subtrahend).not.toBe(q.difference);
      expect(new Set(q.members!.map((member) => member.text)).size).toBe(4);
    }
  });

  it("offers one helper and no choice that prints the answer", () => {
    for (let i = 0; i < 200; i += 1) {
      const q = buildFact({ mode: "known_fact" }, i, new Set());
      expect(q.helpers).toHaveLength(4);
      expect(q.helpers!.filter((choice) => isOneStepHelper(choice, q))).toEqual([q.helper]);
      for (const choice of q.helpers!) {
        expect(choice.minuend).toBeGreaterThanOrEqual(choice.subtrahend);
        expect(choice.subtrahend).toBeGreaterThanOrEqual(1);
        expect(choice.difference).toBe(choice.minuend - choice.subtrahend);
        if (choice !== q.helper) expect(choice.difference).not.toBe(q.difference);
      }
      expect(q.helpers!.some((choice) => choice.minuend === q.minuend && choice.subtrahend === q.subtrahend)).toBe(false);
    }
  });

  it("fact-family hints preserve the whole-first subtraction order", () => {
    const q = buildFact({ mode: "family", minuendRange: [8, 8], subtrahendRange: [3, 3] }, 0, new Set());
    expect(factHints(q, { helperChosen: false, filled: 2 })[1]).toContain("8 stays first");
  });
});

const NONE = { ones: 0, tens: 0, hundreds: 0 };

describe("the base-ten desk hints", () => {
  const q = () => buildBlocks({ mode: "trade_ten", minuendRange: [52, 52], subtrahendRange: [18, 18] }, 0, new Set());

  it("names the exchange the desk owes before anything else", () => {
    const hints = blockHints(q(), { held: { ones: 2, tens: 5, hundreds: 0 }, taken: NONE });
    expect(hints[1]).toContain("need 8 units but only 2");
    expect(hints.at(-1)).toContain("never how much it is worth");
  });

  it("counts what is still to come off once the desk can pay", () => {
    const hints = blockHints(q(), { held: { ones: 12, tens: 4, hundreds: 0 }, taken: { ones: 3, tens: 0, hundreds: 0 } });
    expect(hints[1]).toBe("Still to take away: 5 units, 1 ten-rod.");
  });

  it("reads the desk out once every block is off", () => {
    const hints = blockHints(q(), { held: { ones: 4, tens: 3, hundreds: 0 }, taken: { ones: 8, tens: 1, hundreds: 0 } });
    expect(hints[1]).toContain("3 tens and 4 ones");
    expect(hints.at(-1)).toBe("52 minus 18 is 34.");
  });

  it("stops owing an exchange once the column is paid", () => {
    const need = { ones: 8, tens: 1, hundreds: 0 };
    expect(owedExchange({ ones: 2, tens: 5, hundreds: 0 }, remainingNeed(need, NONE))).toBe("tens");
    expect(owedExchange({ ones: 4, tens: 3, hundreds: 0 }, remainingNeed(need, need))).toBeUndefined();
  });

  it("values a broken block exactly as it valued the whole one", () => {
    for (const before of [{ ones: 2, tens: 5, hundreds: 0 }, { ones: 5, tens: 2, hundreds: 4 }]) {
      const brokeTen = { ...before, tens: before.tens - 1, ones: before.ones + 10 };
      const brokeHundred = { ...before, hundreds: before.hundreds - 1, tens: before.tens + 10 };
      expect(totalOf(brokeTen)).toBe(totalOf(before));
      if (before.hundreds > 0) expect(totalOf(brokeHundred)).toBe(totalOf(before));
    }
  });
});

describe("the place value desk hints", () => {
  it("walks the expanded parts in the order the boxes ask for them", () => {
    const q = buildChart({ mode: "expanded", minuendRange: [67, 67], subtrahendRange: [24, 24] }, 0, new Set());
    expect(q.slots.map((slot) => slot.answer)).toEqual([40, 3, 43]);
    expect(chartHints(q, { filled: 1 })[1]).toContain("1 of 3 boxes");
    expect(chartHints(q, { filled: 1 })[1]).toContain("7 − 4 =");
  });

  it("keeps the check about rebuilding the whole", () => {
    const q = buildChart({ mode: "check_addition", minuendRange: [67, 67], subtrahendRange: [24, 24] }, 0, new Set());
    expect(q.expected).toBe("43,67");
    expect(chartHints(q, { filled: 1 })[1]).toContain("rebuild 67");
  });

  it("runs left to right as a shrinking running total", () => {
    const q = buildChart({ mode: "left_right", minuendRange: [67, 67], subtrahendRange: [24, 24] }, 0, new Set());
    expect(q.slots.map((slot) => slot.lead)).toEqual(["67 − 20 =", "47 − 4 ="]);
    expect(q.expected).toBe("47,43");
  });

  it("files the chart answer one digit per place", () => {
    const two = buildChart({ mode: "chart_subtract", minuendRange: [67, 67], subtrahendRange: [24, 24] }, 0, new Set());
    expect(two.places).toEqual(["tens", "ones"]);
    expect(two.expected).toBe("4,3");
    const three = buildChart({ mode: "chart_three", minuendRange: [486, 486], subtrahendRange: [132, 132] }, 0, new Set());
    expect(three.places).toEqual(["hundreds", "tens", "ones"]);
    expect(three.expected).toBe("3,5,4");
  });
});

describe("the column pad hints", () => {
  const q = () => buildColumn({ mode: "standard", minuendRange: [52, 52], subtrahendRange: [18, 18] }, 0, new Set());

  it("names the column that cannot pay and what the exchange does to it", () => {
    const hints = columnHints(q(), { top: [2, 5], filled: 0 });
    expect(hints[1]).toContain("ones column has 2 and needs to give 8");
    expect(hints.at(-1)).toContain("it becomes 4, and the ones become 12");
  });

  it("stops coaching the exchange once the column can pay", () => {
    const hints = columnHints(q(), { top: [12, 4], filled: 1 });
    expect(hints[1]).toContain("1 of 2 columns");
    expect(hints[1]).toContain("Every column can pay now");
  });

  it("looks past an empty column for something to give", () => {
    // 402: the tens are empty, so the ones must be served from the hundreds.
    expect(markFor([2, 0, 4], 0)).toEqual({ from: 2, oldValue: 4, newValue: 3, toValue: 12 });
  });
});

describe("the reasonableness claims", () => {
  it("offers mistakes a child could actually make", () => {
    const value = { minuend: 523, subtrahend: 178, difference: 345 };
    const kinds = claimsFor(value, 300).map((claim) => claim.kind);
    expect(kinds).toContain("reversed");
    expect(kinds).toContain("place_value");
    expect(kinds).toContain("added");
    expect(kinds.filter(isReasonable)).toHaveLength(2);
  });

  it("takes each column the wrong way round, the way the slip happens", () => {
    expect(reverseColumns(52, 18)).toBe(46);
    expect(reverseColumns(523, 178)).toBe(455);
  });

  it("never offers a wrong claim that equals the true answer", () => {
    for (let i = 0; i < 200; i += 1) {
      const value = { minuend: 400 + i, subtrahend: 100 + i % 90, difference: 0 };
      value.difference = value.minuend - value.subtrahend;
      for (const claim of claimsFor(value, value.difference)) {
        if (!isReasonable(claim.kind)) expect(claim.value).not.toBe(value.difference);
      }
    }
  });
});

describe("the reasonableness answers stay comparable", () => {
  it("keeps the field separator out of every reason", () => {
    // `expected` is "yes,<reason>"; a comma inside a reason splits it in half.
    for (const reason of Object.values(REASONS)) expect(reason).not.toContain(",");
  });
});
