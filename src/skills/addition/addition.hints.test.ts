import { describe, expect, it } from "vitest";
import {
  buildQuestion,
  choicesFor,
  promptFor,
  specFor,
  trayHints,
  type TrayQuestion,
} from "./activities/CountTray";
import { COUNTABLES } from "./internal/data/additionAssets";

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
