import { describe, expect, it } from "vitest";
import {
  buildQuestion,
  choicesFor,
  promptFor,
  specFor,
  trayHints,
  type TrayQuestion,
} from "./activities/CountTray";
import {
  buildQuestion as buildFrame,
  frameHints,
  specFor as frameSpec,
} from "./activities/FrameFill";
import {
  buildQuestion as buildBond,
  bondHints,
  specFor as bondSpec,
} from "./activities/BondTree";
import {
  buildQuestion as buildJump,
  jumpHints,
  specFor as jumpSpec,
} from "./activities/JumpLine";
import {
  buildQuestion as buildBlocks,
  readyToBundle,
  specFor as blockSpec,
} from "./activities/BlockYard";
import {
  buildQuestion as buildDesk,
  deskHints,
  specFor as deskSpec,
} from "./activities/PlaceValueDesk";
import { buildQuestion as buildChain, chainHints } from "./activities/ChainBoard";
import {
  buildQuestion as buildColumn,
  columnHints,
  specFor as columnSpec,
} from "./activities/ColumnPad";
import { buildQuestion as buildEstimate, estimateHints } from "./activities/EstimateDial";
import { buildQuestion as buildStory, type StoryMemory } from "./activities/StoryBoard";
import { buildQuestion as buildStrategy, type ProblemMemory } from "./activities/StrategyPicker";
import { STRATEGIES, fittingFor } from "./internal/data/strategyCards";
import { isPractice, modeAt } from "./internal/data/practice";
import {
  buildQuestion as buildFact,
  factHints,
  specFor as factSpec,
} from "./activities/FactDeck";
import { COUNTABLES } from "./internal/data/additionAssets";
import {
  carriesIn,
  friendlyPairCount,
  isBridging,
  isRegrouping,
  roundTo,
} from "./internal/data/additionNumbers";
/**
 * The hint ladder, tested against the state it claims to describe.
 *
 * A hint is the one piece of copy written *about* the screen rather than for
 * it, so it is the one that can drift: "you have counted 3" while four objects
 * carry a number is worse than no hint at all, and no rendered test would catch
 * it. The builders are pure and exported for exactly this.
 */

const question = (over: Partial<TrayQuestion> = {}): TrayQuestion => ({
  id: "q1",
  taskKind: "add_count_all",
  mode: "count_all",
  a: 3,
  b: 4,
  sum: 7,
  asset: COUNTABLES[0],
  expected: "7",
  itemCount: 7,
  ...over,
});

const idle = {
  counted: 0,
  merged: false,
  startPicked: null as number | null,
  fingers: { left: 0, right: 0 },
};

describe("the hint ladder", () => {
  it("opens with the lesson's own tip", () => {
    const [first] = trayHints(question(), { ...idle, kidTip: "Keep counting on." });
    expect(first).toBe("Keep counting on.");
  });

  it("stands up without one, so a lesson that authored none is still helped", () => {
    expect(trayHints(question(), idle)).toHaveLength(3);
  });

  it("never repeats a rung, so asking for more always gives more", () => {
    // `composeHints` drops a duplicate, which is what would happen if a lesson's
    // tip said what the activity's own first rung says.
    const rungs = trayHints(question(), { ...idle, counted: 2 });
    expect(new Set(rungs).size).toBe(rungs.length);
  });

  it("counts what the child has actually done, not what the question holds", () => {
    const [, second] = trayHints(question(), { ...idle, counted: 4 });
    expect(second).toContain("counted 4");
    expect(second).toContain("3 left");
  });

  it("tells a child who has counted nothing where to start", () => {
    const [, second] = trayHints(question(), idle);
    expect(second).toContain("Start at the left-hand group");
  });

  it("counting on names the number in the closed box, and the one after it", () => {
    const [, second, third] = trayHints(question({ mode: "count_on", a: 6, b: 3, sum: 9 }), idle);
    expect(second).toContain("The box holds 6");
    expect(second).toContain("seven");
    expect(third).toContain("7, 8, 9");
  });

  it("starting from the larger explains the saving, in both numbers", () => {
    const [, second] = trayHints(
      question({ mode: "count_on_larger", a: 2, b: 8, sum: 10 }),
      idle,
    );
    expect(second).toContain("8 is bigger than 2");
    // The reason, not just the instruction: two counts instead of eight.
    expect(second).toContain("only have 2 more");
  });

  it("stops short of the answer where the child is choosing between answers", () => {
    // Adding zero is answered from four tiles, so a last rung that named the
    // total would answer the question rather than explain the rule.
    const rungs = trayHints(question({ mode: "add_zero", a: 7, b: 0, sum: 7 }), idle);
    expect(rungs.at(-1)).toBe("Adding zero always leaves a number exactly as it was.");
    expect(rungs.at(-1)).not.toContain("7");
  });

  it("goes all the way where the answer is produced by counting", () => {
    // Counting every object *is* the answer, so the last rung may say the total.
    expect(trayHints(question(), idle).at(-1)).toContain("7");
  });

  it("tells a child mid-merge what is still in the way", () => {
    const [, second] = trayHints(question({ mode: "combine" }), idle);
    expect(second).toContain("Put them together");
  });

  it("reads the hands back as they are", () => {
    const [, second] = trayHints(question({ mode: "fingers", a: 4, b: 3, sum: 7 }), {
      ...idle,
      fingers: { left: 4, right: 1 },
    });
    expect(second).toContain("4 up on the left");
    expect(second).toContain("1 on the right");
  });
});

describe("the question a child is shown", () => {
  it("fills the lesson's own wording", () => {
    expect(promptFor(question({ a: 3, b: 4 }), "What is {a} plus {b}?")).toBe("What is 3 plus 4?");
  });

  it("falls back to wording that fits the mode", () => {
    expect(promptFor(question({ mode: "count_on", a: 6 }))).toBe("Start at 6 and count on.");
  });

  it("puts the answer among its neighbours, and never below zero", () => {
    expect(choicesFor(7)).toEqual([5, 6, 7, 8]);
    expect(choicesFor(1)).toEqual([0, 1, 2, 3]);
    expect(choicesFor(0)).toEqual([0, 1, 2, 3]);
  });
});

describe("the questions a round asks", () => {
  it("asks five different ones", () => {
    const seen = new Set<string>();
    const asked = Array.from({ length: 5 }, (_, i) =>
      buildQuestion({ mode: "count_all", addendRange: [1, 5], sumMax: 10 }, i + 1, seen),
    ).map((q) => `${q.a}+${q.b}`);
    expect(new Set(asked).size).toBe(5);
  });

  it("puts the zero on either side, so the rule is learned and not the position", () => {
    const seen = new Set<string>();
    const sides = new Set(
      Array.from({ length: 60 }, (_, i) =>
        buildQuestion({ mode: "add_zero", aRange: [1, 9], flipChance: 0.5 }, i + 1, seen),
      ).map((q) => (q.a === 0 ? "left" : "right")),
    );
    expect(sides).toEqual(new Set(["left", "right"]));
  });

  it("always carries the answer it will be judged against", () => {
    const seen = new Set<string>();
    for (const mode of ["count_all", "combine", "count_on", "count_on_larger", "add_zero", "add_one", "fingers"] as const) {
      const q = buildQuestion({ mode }, 1, seen);
      expect(q.expected, mode).toBe(String(q.sum));
      expect(q.taskKind, mode).toBe(`add_${mode}`);
    }
  });
});

describe("a lesson narrows a mode without erasing it", () => {
  it("keeps a mode's own range when the lesson does not restate it", () => {
    // The bug this pins: spreading a setup object straight over the defaults
    // wrote `aRange: undefined` for every key a lesson left out, so Count On
    // quietly started from one instead of from four.
    expect(specFor("count_on", {})).toMatchObject({ aRange: [4, 9], bRange: [1, 3] });
    expect(specFor("count_on", { bRange: [1, 2] })).toMatchObject({
      aRange: [4, 9],
      bRange: [1, 2],
    });
  });

  it("does not carry one mode's ceiling into another", () => {
    // `sumMax: 10` belonged to count-all and reached every mode through
    // `defaultParams`, capping Adding One's declared range of 1 to 15 at 9.
    expect(specFor("add_one", { aRange: [1, 15] }).sumMax).toBeUndefined();
    expect(specFor("count_all", {}).sumMax).toBe(10);
  });

  it("will not let a lesson redefine what a mode is", () => {
    expect(specFor("add_zero", { bRange: [4, 9] }).bRange).toEqual([0, 0]);
    expect(specFor("add_one", { bRange: [4, 9] }).bRange).toEqual([1, 1]);
    expect(specFor("count_on_larger", {}).minGap).toBe(2);
  });

  it("actually reaches the top of a range a lesson declared", () => {
    const seen = new Set<string>();
    const highest = Math.max(
      ...Array.from({ length: 120 }, (_, i) =>
        buildQuestion({ mode: "add_one", aRange: [1, 15], flipChance: 0 }, i + 1, seen).a,
      ),
    );
    expect(highest).toBeGreaterThan(10);
  });
});


describe("the frame asks one of two different questions", () => {
  it("asks for the total when counters are added to a frame", () => {
    const seen = new Set<string>();
    const q = buildFrame({ mode: "ten", aRange: [3, 3], bRange: [4, 4] }, 1, seen);
    expect(q.asks).toBe("total");
    expect(q.expected).toBe("7");
  });

  it("asks for what was added when the frame is being filled up", () => {
    // The likeliest bug in this engine: `make_ten` means "how many more", and
    // an `expected` of ten would mark every correct answer wrong.
    const seen = new Set<string>();
    const q = buildFrame({ mode: "make_ten", aRange: [6, 6] }, 1, seen);
    expect(q.asks).toBe("added");
    expect(q.expected).toBe("4");
    expect(q.given + q.added).toBe(10);
  });

  it("always fills the frame exactly, over many draws", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 60; i += 1) {
      const five = buildFrame({ mode: "make_five" }, i + 1, seen);
      expect(five.given + five.added).toBe(5);
      const ten = buildFrame({ mode: "make_ten" }, i + 1, new Set());
      expect(ten.given + ten.added).toBe(10);
    }
  });

  it("will not let a lesson turn a make-question into something else", () => {
    expect(frameSpec("make_ten", { sumMax: 6 })).toMatchObject({ sumMin: 10, sumMax: 10 });
    expect(frameSpec("ten", {}).sumMax).toBe(10);
  });

  it("tells a child what is still empty, and stops short of the answer", () => {
    const seen = new Set<string>();
    const q = buildFrame({ mode: "make_ten", aRange: [6, 6] }, 1, seen);
    const rungs = frameHints(q, { filled: 8 });
    expect(rungs[1]).toContain("2 spaces");
    expect(rungs.at(-1)).not.toContain(" 4");
  });
});

describe("the bond keeps each mode's shape", () => {
  it("always gives split_one a pair that crosses ten", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 60; i += 1) {
      const q = buildBond({ mode: "split_one" }, i + 1, seen);
      expect(isBridging(q.a, q.b), `${q.a} + ${q.b}`).toBe(true);
      // b breaks into what completes the ten, and the remainder.
      expect(q.answers[0]).toBe(10 - q.a);
      expect(q.answers[0] + q.answers[1]).toBe(q.b);
    }
  });

  it("never gives split_both a pair that regroups", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 60; i += 1) {
      const q = buildBond({ mode: "split_both" }, i + 1, seen);
      expect(isRegrouping(q.a, q.b), `${q.a} + ${q.b}`).toBe(false);
      expect(q.blanks).toHaveLength(4);
      expect(q.answers[0] % 10, "the tens box wants a whole ten").toBe(0);
    }
  });

  it("hides either part, so a child cannot learn a position", () => {
    const seen = new Set<string>();
    const sides = new Set(
      Array.from({ length: 60 }, (_, i) =>
        buildBond({ mode: "part_unknown" }, i + 1, seen).bonds[0].parts[0].blank ? "left" : "right",
      ),
    );
    expect(sides).toEqual(new Set(["left", "right"]));
  });

  it("reports every box as one answer", () => {
    const seen = new Set<string>();
    const q = buildBond({ mode: "split_both", addendRange: [23, 23] }, 1, seen);
    expect(q.expected.split(",")).toHaveLength(4);
  });

  it("names the ten a bridging pair is reaching for", () => {
    const seen = new Set<string>();
    const q = buildBond({ mode: "split_one", aRange: [8, 8], bRange: [5, 5] }, 1, seen);
    const [, second] = bondHints(q, { entries: {} });
    expect(second).toContain("8 needs 2 more");
  });
});


describe("the number line keeps each mode's shape", () => {
  it("never starts a bridging question already on the round number", () => {
    // There would be nothing to reach for, and the right jump would be zero.
    const seen = new Set<string>();
    for (let i = 0; i < 60; i += 1) {
      const q = buildJump({ mode: "bridge_ten" }, i + 1, seen);
      expect(q.a % 10, `${q.a}`).not.toBe(0);
      expect(q.required[0]).toBe(10 - (q.a % 10));
      expect(q.a + q.required[0]).toBe(Math.ceil((q.a + 1) / 10) * 10);
    }
  });

  it("offers the right jump beside its two near misses", () => {
    const seen = new Set<string>();
    const q = buildJump({ mode: "bridge_ten", aRange: [37, 37] }, 1, seen);
    expect(q.offered).toContain(3);
    expect(q.offered).toHaveLength(3);
    expect(new Set(q.offered).size, "a choice was offered twice").toBe(3);
  });

  it("always gives compensation an addend worth rounding", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 40; i += 1) {
      const q = buildJump({ mode: "compensate" }, i + 1, seen);
      expect([8, 9]).toContain(q.b % 10);
      // Jump the round number, then give back the difference.
      expect(q.required[0] % 10).toBe(0);
      expect(q.required[0] + q.required[1]).toBe(q.b);
      expect(q.required[1]).toBeLessThan(0);
    }
  });

  it("splits the second number into tens and ones, and needs both", () => {
    const seen = new Set<string>();
    const q = buildJump({ mode: "jump_tens_ones", addendRange: [34, 34] }, 1, seen);
    expect(q.required.slice().sort((x, y) => y - x)).toEqual([30, 4]);
    expect(q.required.reduce((t, n) => t + n, 0)).toBe(q.b);
  });

  it("marks the ticks on a path and leaves an open line bare", () => {
    const seen = new Set<string>();
    expect(buildJump({ mode: "path" }, 1, seen).ticks).toBe(1);
    expect(buildJump({ mode: "open" }, 2, seen).ticks).toBe(0);
    // Which line it is decides how the child answers.
    expect(buildJump({ mode: "path" }, 3, seen).answerKind).toBe("arrival");
    expect(buildJump({ mode: "open" }, 4, seen).answerKind).toBe("landing");
    expect(buildJump({ mode: "bridge_ten" }, 5, seen).answerKind).toBe("jump");
  });

  it("will not let a lesson take the rounding out of compensation", () => {
    expect(jumpSpec("compensate", { bRange: [11, 40] }).endsIn).toEqual([8, 9]);
    expect(jumpSpec("jump_tens_ones", {}).regroup).toBe("never");
  });

  it("says how far is left, from where the child actually is", () => {
    const seen = new Set<string>();
    const q = buildJump({ mode: "path", aRange: [3, 3], bRange: [4, 4] }, 1, seen);
    const [, second] = jumpHints(q, { at: 5, made: [1, 1], entry: "" });
    expect(second).toContain("You are on 5");
    expect(second).toContain("2 more hops");
  });
});


describe("the block yard keeps each mode's shape", () => {
  it("starts an exchange lesson holding ten of something", () => {
    // The un-carried column is the lesson. A yard that arrived already bundled
    // would have nothing to exchange.
    const seen = new Set<string>();
    for (let i = 0; i < 40; i += 1) {
      const q = buildBlocks({ mode: "trade_ones" }, i + 1, seen);
      expect(q.start.ones, `${q.a} + ${q.b}`).toBeGreaterThanOrEqual(10);
      expect(readyToBundle(q.start)).toBe("ones");
      // And the value is already right — it is the form that is unfinished.
      expect(q.start.tens * 10 + q.start.ones + q.start.hundreds * 100).toBe(q.sum);
    }
  });

  it("never gives a building lesson a carry to trip over", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 40; i += 1) {
      const q = buildBlocks({ mode: "build_add" }, i + 1, seen);
      expect(carriesIn(q.a, q.b), `${q.a} + ${q.b}`).toEqual([]);
      expect(q.start).toEqual({ hundreds: 0, tens: 0, ones: 0 });
    }
  });

  it("offers only the block a tens or hundreds lesson is about", () => {
    const seen = new Set<string>();
    expect(buildBlocks({ mode: "multiples_ten" }, 1, seen).offers).toEqual(["tens"]);
    expect(buildBlocks({ mode: "multiples_hundred" }, 2, seen).offers).toEqual(["hundreds"]);
    for (let i = 0; i < 20; i += 1) {
      const q = buildBlocks({ mode: "multiples_ten" }, i + 3, seen);
      expect(q.a % 10).toBe(0);
      expect(q.b % 10).toBe(0);
    }
  });

  it("will not let a lesson take the exchange out of an exchange lesson", () => {
    expect(blockSpec("trade_ones", { addendRange: [11, 20] }).regroup).toBe("ones");
    expect(blockSpec("build_add", { addendRange: [11, 99] }).regroup).toBe("never");
  });
});

describe("the chart keeps each mode's shape", () => {
  it("keeps the columns clean where the lesson is about columns", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 40; i += 1) {
      const q = buildDesk({ mode: "chart_add" }, i + 1, seen);
      expect(carriesIn(q.a, q.b), `${q.a} + ${q.b}`).toEqual([]);
      expect(q.blanks).toHaveLength(2);
    }
  });

  it("always gives partial sums a carry to keep", () => {
    // A silently non-regrouping partial-sums lesson teaches nothing and looks
    // completely fine — this is the trap the plan calls out for phase 8.
    const seen = new Set<string>();
    for (let i = 0; i < 40; i += 1) {
      const q = buildDesk({ mode: "partial_sums" }, i + 1, seen);
      expect(carriesIn(q.a, q.b), `${q.a} + ${q.b}`).toContain("ones");
    }
    expect(deskSpec("partial_sums", { addendRange: [11, 20] }).regroup).toBe("ones");
  });

  it("spells each number out as the values it is made of", () => {
    const seen = new Set<string>();
    const q = buildDesk({ mode: "expanded", addendRange: [342, 342] }, 1, seen);
    expect(q.rows[0].cells.map((c) => c.text)).toEqual(["300", "40", "2"]);
    expect(q.answers[0] % 100).toBe(0);
  });
});


describe("the fact deck keeps each mode's shape", () => {
  it("makes a double out of one number twice", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 30; i += 1) {
      const q = buildFact({ mode: "doubles", nRange: [1, 10] }, i + 1, seen);
      expect(q.a).toBe(q.b);
      expect(q.expected).toBe(String(q.a * 2));
    }
  });

  it("puts a near double exactly one step from the double it leans on", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 30; i += 1) {
      const up = buildFact({ mode: "near_up", nRange: [1, 9] }, i + 1, seen);
      expect(up.b).toBe(up.a + 1);
      expect(up.helper!.sum).toBe(up.a * 2);
      expect(up.sum).toBe(up.helper!.sum + 1);

      const down = buildFact({ mode: "near_down", nRange: [2, 10] }, i + 1, new Set());
      expect(down.b).toBe(down.a - 1);
      expect(down.sum).toBe(down.helper!.sum - 1);
    }
  });

  it("offers only real facts as helpers", () => {
    // An obviously silly option would let a child choose correctly without
    // thinking about which fact actually helps.
    const seen = new Set<string>();
    for (let i = 0; i < 30; i += 1) {
      const q = buildFact({ mode: "known_fact" }, i + 1, seen);
      expect(q.helpers!.length).toBeGreaterThan(1);
      for (const f of q.helpers!) expect(f.a + f.b).toBe(f.sum);
      expect(q.helpers!.some((f) => f.a === q.helper!.a && f.b === q.helper!.b)).toBe(true);
    }
  });

  it("always gives switching a gap worth switching for", () => {
    // 2 + 9 is worth reordering. 4 + 5 is not, and a lesson full of those
    // teaches that the strategy is pointless.
    const seen = new Set<string>();
    for (let i = 0; i < 30; i += 1) {
      const q = buildFact({ mode: "commute" }, i + 1, seen);
      expect(Math.abs(q.a - q.b)).toBeGreaterThanOrEqual(3);
      expect(q.expected).toBe(`${q.b}+${q.a}`);
      // The fact as shown is among the choices, because choosing it is the
      // mistake being assessed.
      expect(q.choices!.some((f) => f.a === q.a && f.b === q.b)).toBe(true);
    }
    expect(factSpec("commute", { aRange: [1, 9] }).minGap).toBe(3);
  });

  it("builds all four members of a family from three numbers", () => {
    const seen = new Set<string>();
    const q = buildFact({ mode: "family", aRange: [3, 3], bRange: [5, 5] }, 1, seen);
    expect(q.members!.map((m) => m.answer)).toEqual([8, 8, 5, 3]);
    expect(q.members!.map((m) => m.text)).toEqual(["3 + 5 =", "5 + 3 =", "8 − 3 =", "8 − 5 ="]);
  });

  it("tells a child to fetch the double before it tells them anything else", () => {
    const seen = new Set<string>();
    const q = buildFact({ mode: "near_up", nRange: [6, 6] }, 1, seen);
    const [, before] = factHints(q, { revealed: false });
    expect(before).toContain("Tap the double first");
    const [, after] = factHints(q, { revealed: true });
    expect(after).toContain("6 and 6 is 12");
  });
});

describe("the chain board keeps each mode's shape", () => {
  it("hides exactly one pair that makes ten", () => {
    // A second hidden ten would make a child's correct answer look wrong.
    const seen = new Set<string>();
    for (let i = 0; i < 40; i += 1) {
      const q = buildChain({ mode: "pairs", count: 4, target: 10 }, i + 1, seen);
      expect(q.values).toHaveLength(4);
      expect(friendlyPairCount(q.values, 10), q.values.join(" + ")).toBe(1);
      expect(q.sum).toBe(q.values.reduce((t, n) => t + n, 0));
    }
  });

  it("hides two pairs when the lesson asks for two", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 30; i += 1) {
      const q = buildChain({ mode: "compatible", count: 5, target: 10, pairsWanted: 2 }, i + 1, seen);
      expect(friendlyPairCount(q.values, 10), q.values.join(" + ")).toBe(2);
    }
  });

  it("keeps a free chain inside its ceiling", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 30; i += 1) {
      const q = buildChain({ mode: "chain", count: 4, addendRange: [2, 15], totalMax: 40 }, i + 1, seen);
      expect(q.sum).toBeLessThanOrEqual(40);
      expect(q.values).toHaveLength(4);
    }
  });

  it("counts the pairs still on the board, not the ones it started with", () => {
    const seen = new Set<string>();
    const q = buildChain({ mode: "pairs", count: 4, target: 10 }, 1, seen);
    const chips = q.values.map((value, i) => ({ id: `c${i}`, value, merged: false }));
    const [, before] = chainHints(q, { chips, step: 0 });
    expect(before).toContain("make 10");
    // Once the pair is gone the hint has to stop promising one.
    const [, after] = chainHints(q, { chips: [{ id: "m", value: q.sum, merged: true }], step: 0 });
    expect(after).toContain("One chip left");
  });
});

describe("left to right is not partial sums under another name", () => {
  it("keeps one number that grows, rather than parts totalled at the end", () => {
    const seen = new Set<string>();
    const lr = buildDesk({ mode: "left_right", addendRange: [47, 47] }, 1, seen);
    const ps = buildDesk({ mode: "partial_sums", addendRange: [47, 47] }, 2, new Set());

    // Two boxes, and the second one is the whole answer — not a part of it.
    expect(lr.blanks).toHaveLength(2);
    expect(lr.answers).toEqual([80, 94]);
    expect(lr.answers.at(-1)).toBe(lr.sum);

    // Partial sums keeps both columns and adds them afterwards.
    expect(ps.blanks).toHaveLength(4);
    expect(ps.answers.slice(0, 2)).toEqual([80, 14]);
  });

  it("says what you are holding, not what the parts were", () => {
    const seen = new Set<string>();
    const q = buildDesk({ mode: "left_right", addendRange: [47, 47] }, 1, seen);
    const [, second] = deskHints(q, { entries: { "run-1": "80" } });
    expect(second).toContain("holding 80");
  });
});

describe("the column pad keeps each mode's shape", () => {
  it("gives the standard method exactly one carry", () => {
    // Two carries is a different lesson. The sum ceiling is what stops the tens
    // carrying as well, so it is worth checking it actually does.
    const seen = new Set<string>();
    for (let i = 0; i < 40; i += 1) {
      const q = buildColumn({ mode: "standard" }, i + 1, seen);
      expect(carriesIn(q.a, q.b), `${q.a} + ${q.b}`).toEqual(["ones"]);
      expect(q.carryInto).toEqual(["tens"]);
      expect(q.sum).toBeLessThan(100);
    }
  });

  it("gives cascading two carries, and never needs a fourth column", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 40; i += 1) {
      const q = buildColumn({ mode: "cascade" }, i + 1, seen);
      expect(carriesIn(q.a, q.b), `${q.a} + ${q.b}`).toEqual(["ones", "tens"]);
      expect(q.carryInto).toEqual(["tens", "hundreds"]);
      expect(q.sum).toBeLessThan(1000);
      expect(q.places).toEqual(["hundreds", "tens", "ones"]);
    }
  });

  it("keeps a column for a digit that happens to be nought", () => {
    // Reading the columns off the digits dropped one whenever a nought turned
    // up: a sum of 80 came out with no ones column, so the last digit had
    // nowhere to go.
    const seen = new Set<string>();
    const q = buildColumn({ mode: "standard", aRange: [47, 47], bRange: [33, 33] }, 1, seen);
    expect(q.sum).toBe(80);
    expect(q.places).toEqual(["tens", "ones"]);
    expect(q.answerDigits).toEqual([8, 0]);
  });

  it("will not let a lesson widen a mode past its columns", () => {
    expect(columnSpec("standard", { addendRange: [15, 400], sumMax: 5000 }).sumMax).toBe(99);
    expect(columnSpec("cascade", { sumMax: 5000 }).regroup).toBe("both");
  });

  it("asks for the carry that is missing, by name", () => {
    const seen = new Set<string>();
    const q = buildColumn({ mode: "standard" }, 1, seen);
    const [, second] = columnHints(q, { digits: { ones: "5" }, carries: {} });
    expect(second).toContain("carry to go above the tens");
  });
});

describe("estimating asks for an estimate, not the answer", () => {
  it("expects the rounded total, and offers no exact answer among the choices", () => {
    // A child who works out the real total and looks for it will not find it —
    // which is the point, and why the prompt and the feedback both say "about".
    const seen = new Set<string>();
    for (let i = 0; i < 40; i += 1) {
      const q = buildEstimate({ mode: "round_estimate", digits: 2 }, i + 1, seen);
      const wanted = roundTo(q.a, 10) + roundTo(q.b, 10);
      expect(q.expected).toBe(String(wanted));
      expect(q.options!.every((o) => o % 10 === 0), q.options!.join(",")).toBe(true);
      if (q.sum % 10 !== 0) expect(q.options).not.toContain(q.sum);
    }
  });

  it("never draws a number that is already round", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 40; i += 1) {
      const q = buildEstimate({ mode: "round_estimate", digits: 2 }, i + 1, seen);
      // Rounding a round number teaches nothing, and a number sitting exactly
      // halfway makes "nearer" a coin toss.
      for (const n of [q.a, q.b]) {
        expect(n % 10).not.toBe(0);
        expect(n % 10).not.toBe(5);
      }
    }
  });

  it("claims an answer that is right, ten times too big, or ten times too small", () => {
    const seen = new Set<string>();
    const seenVerdicts = new Set<string>();
    for (let i = 0; i < 60; i += 1) {
      const q = buildEstimate({ mode: "reasonable", digits: 3 }, i + 1, seen);
      seenVerdicts.add(q.verdict!);
      if (q.verdict === "right") expect(q.claim).toBe(q.sum);
      if (q.verdict === "too_big") expect(q.claim).toBe(q.sum * 10);
      if (q.verdict === "too_small") expect(q.claim).toBe(Math.floor(q.sum / 10));
    }
    // All three verdicts come up, or the lesson is a coin toss with extra steps.
    expect(seenVerdicts).toEqual(new Set(["right", "too_big", "too_small"]));
  });

  it("stops short of judging for the child", () => {
    const seen = new Set<string>();
    const q = buildEstimate({ mode: "reasonable", digits: 3 }, 1, seen);
    const rungs = estimateHints(q, { rounded: [] });
    expect(rungs.at(-1)).toContain("Is it close, far too big, or far too small?");
  });
});

describe("story problems put the empty box where the type says", () => {
  const memory = () => ({ current: null as StoryMemory | null });

  it("asks for the whole when both parts are given", () => {
    const q = buildStory({ mode: "join" }, 1, new Set(), memory());
    const slots = q.rows.flatMap((r) => r.slots);
    expect(slots.filter((s) => s.value === undefined)).toHaveLength(0);
    expect(q.chips).toHaveLength(2);
    expect(q.answer).toBe(q.chips[0] + q.chips[1]);
  });

  it("tells change-unknown and start-unknown apart by which box is empty", () => {
    // The same three numbers and the same arithmetic. Which box is empty is the
    // entire difference, and it is the only thing a child has to read.
    const change = buildStory({ mode: "change_unknown" }, 1, new Set(), memory());
    const start = buildStory({ mode: "start_unknown" }, 1, new Set(), memory());

    const emptyOf = (q: typeof change) =>
      q.rows.flatMap((r) => r.slots).find((s) => s.value === undefined)!.id;

    expect(emptyOf(change)).toBe("change");
    expect(emptyOf(start)).toBe("start");
    // Both know the whole, and both hand the child exactly one number.
    for (const q of [change, start]) {
      expect(q.rows[0].whole).toBeDefined();
      expect(q.chips).toHaveLength(1);
    }
  });

  it("draws a comparison as two bars, lined up", () => {
    const q = buildStory({ mode: "compare" }, 1, new Set(), memory());
    expect(q.rows).toHaveLength(2);
    expect(q.rows[0].slots).toHaveLength(1);
    expect(q.rows[1].slots).toHaveLength(2);
    // The longer bar starts by matching the shorter one.
    expect(q.rows[1].slots[0].value).toBe(q.rows[0].slots[0].value);
    expect(q.answer).toBe(q.rows[1].slots[0].value! + q.rows[1].slots[1].value!);
  });

  it("carries a multi-step story across two questions", () => {
    const mem = memory();
    const seen = new Set<string>();
    const first = buildStory({ mode: "multi_step" }, 1, seen, mem);
    const second = buildStory({ mode: "multi_step" }, 2, seen, mem);

    expect(first.step).toBe(1);
    expect(second.step).toBe(2);
    // Same story, and the second step starts from the first step's answer.
    expect(second.text).toBe(first.text);
    expect(second.chips).toContain(first.answer);
    expect(second.answer).toBeGreaterThan(first.answer);
    expect(first.taskKind).toBe("story_multi_step_step1");
    expect(second.taskKind).toBe("story_multi_step_step2");

    // A third question starts a fresh story rather than repeating the second.
    const third = buildStory({ mode: "multi_step" }, 3, seen, mem);
    expect(third.step).toBe(1);
  });

  it("uses the lesson's own sentence, and fills it in", () => {
    // Code fills the placeholders; code never writes a sentence. The wording of
    // a word problem is curriculum and belongs where a teacher can edit it.
    const q = buildStory(
      { mode: "join", stories: ["{name} had {a} {thing} and got {b} more."], startRange: [4, 4], changeRange: [3, 3] },
      1,
      new Set(),
      memory(),
    );
    expect(q.text).toMatch(/^\w+ had 4 \w+ and got 3 more\.$/);
    expect(q.text).not.toContain("{");
  });
});

describe("controls stay tellable apart when two numbers match", () => {
  it("gives each rounding dial its own name", () => {
    // 47 + 47 is a perfectly good question, and it produced two dials whose
    // buttons read identically — so both taps landed on the first one and the
    // second addend was never rounded.
    const seen = new Set<string>();
    const q = buildEstimate({ mode: "round_estimate", digits: 2 }, 1, seen);
    expect(q.around).toHaveLength(2);
    expect(q.around[0]).not.toBe(q.around[1]);
  });
});

describe("choosing a strategy is judged on what suits the numbers", () => {
  it("knows counting on always works and is rarely the best", () => {
    // It is in the list precisely so a child can pick it and see what it costs.
    const countOn = STRATEGIES.find((s) => s.id === "count_on")!;
    expect(countOn.fits(48, 19)).toBe(true);
    expect(countOn.work(48, 19)).toHaveLength(19);
    const compensate = STRATEGIES.find((s) => s.id === "compensate")!;
    expect(compensate.fits(48, 19)).toBe(true);
    expect(compensate.work(48, 19)).toHaveLength(3);
  });

  it("does not offer a double for numbers that are not one", () => {
    const doubles = STRATEGIES.find((s) => s.id === "doubles")!;
    expect(doubles.fits(48, 19)).toBe(false);
    expect(doubles.fits(6, 6)).toBe(true);
    expect(fittingFor(48, 19).map((s) => s.id)).not.toContain("doubles");
  });

  it("only asks about numbers where something clever applies", () => {
    // Counting on always fits, so a pair with nothing else would leave one card
    // correct and the lesson pointless.
    const seen = new Set<string>();
    const memory = { current: null as ProblemMemory | null };
    for (let i = 0; i < 30; i += 1) {
      const q = buildStrategy({}, i * 2 + 1, seen, memory);
      expect(q.fitting.length, `${q.a} + ${q.b}`).toBeGreaterThan(1);
      memory.current = null;
    }
  });

  it("holds every right answer, not one of them", () => {
    const memory = { current: null as ProblemMemory | null };
    const q = buildStrategy({ addendRange: [8, 9] }, 1, new Set(), memory);
    expect(q.expected.split("|")).toEqual(q.fitting);
    expect(q.fitting.length).toBeGreaterThan(1);
  });

  it("compares the route the child chose against another, on the same numbers", () => {
    const memory = { current: null as ProblemMemory | null };
    const seen = new Set<string>();
    const first = buildStrategy({}, 1, seen, memory);
    memory.current!.chosen = first.fitting.find((id) => id !== "count_on") ?? "count_on";
    const second = buildStrategy({}, 2, seen, memory);

    expect(second.step).toBe(2);
    expect(second.a).toBe(first.a);
    expect(second.b).toBe(first.b);
    expect(second.paths).toHaveLength(2);
    // The shorter path is the one with fewer lines, and that is the answer.
    const shortest = second.paths!.reduce((best, p) => (p.lines.length < best.lines.length ? p : best));
    expect(second.expected).toBe(shortest.id);
  });
});

describe("practice cycles the modes it is given", () => {
  it("returns them in order, and wraps", () => {
    const setup = { modes: ["a", "b", "c"] };
    expect([1, 2, 3, 4, 5, 6, 7].map((i) => modeAt(setup, i, "z"))).toEqual([
      "a", "b", "c", "a", "b", "c", "a",
    ]);
  });

  it("covers every mode inside one run of a practice lesson", () => {
    // Ten questions over four modes has to reach all four. Sampling would not
    // guarantee it, which is the reason this cycles.
    const modes = ["five", "ten", "make_five", "make_ten"];
    const seen = new Set(
      Array.from({ length: 8 }, (_, i) => modeAt({ modes }, i + 1, "ten")),
    );
    expect(seen).toEqual(new Set(modes));
  });

  it("leaves a teaching lesson on its single mode", () => {
    expect([1, 2, 3].map((i) => modeAt({ mode: "ten" }, i, "five"))).toEqual(["ten", "ten", "ten"]);
    expect(modeAt({}, 1, "five")).toBe("five");
  });

  it("is off unless a lesson asks for it", () => {
    expect(isPractice({})).toBe(false);
    expect(isPractice({ practice: true })).toBe(true);
  });
});

