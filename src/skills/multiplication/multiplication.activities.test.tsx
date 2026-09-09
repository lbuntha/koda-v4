import { describe, expect, it } from "vitest";
import { renderActivity, expectStandardRound, type ActivityHarness } from "../kit/testing";
import { skill } from ".";
import { buildQuestion, type GroupMode } from "./activities/GroupTray";

/**
 * GroupTray, driven the way a child drives it.
 *
 * Every answer here is worked out from what is on screen — the containers, what
 * they hold — and never read back from the engine's own answer key. A driver
 * that asks the activity what it wants and then gives it that will pass against
 * a wrong answer key, which is the one thing these tests exist to prevent.
 */

const groups = skill.activities.groups;

/** Every button, including the ones the mode has disabled. */
const labels = (h: ActivityHarness): string[] =>
  h.screen
    .getAllByRole("button")
    .map((b) => (b.getAttribute("aria-label") ?? b.textContent ?? "").trim());

/** What each container currently holds, read off its label. */
const binCounts = (h: ActivityHarness): number[] =>
  labels(h)
    .map((label) => /^[a-z]+ \d+, (?:holding )?(\d+)\b/.exec(label))
    .filter((match): match is RegExpExecArray => match !== null)
    .map((match) => Number(match[1]));

/** The tray a `make_groups` question is asking for. */
const target = (h: ActivityHarness): { groups: number; size: number } => {
  const bins = labels(h).filter((label) => /, holding \d+ of \d+$/.test(label));
  expect(bins.length, "make_groups draws one container per group").toBeGreaterThan(0);
  return { groups: bins.length, size: Number(/of (\d+)$/.exec(bins[0])![1]) };
};

const render = (mode: GroupMode, params: Record<string, unknown> = {}) =>
  renderActivity(groups, { params: { mode, questionsPerRound: 5, ...params } });

/** Fill every container to the number the prompt asked for. */
async function buildTray(h: ActivityHarness): Promise<void> {
  for (let guard = 0; guard < 80; guard += 1) {
    const unfinished = labels(h).find((label) => {
      const match = /, holding (\d+) of (\d+)$/.exec(label);
      return match !== null && Number(match[1]) < Number(match[2]);
    });
    if (!unfinished) return;
    await h.press(/^Take one /);
    await h.press(unfinished);
  }
  throw new Error("the tray never filled");
}

async function countEveryGroup(h: ActivityHarness): Promise<void> {
  for (let guard = 0; guard < 20; guard += 1) {
    const uncounted = labels(h).find(
      (label) => /^[a-z]+ \d+, \d+ /.test(label) && !label.endsWith(", counted"),
    );
    if (!uncounted) return;
    await h.press(uncounted);
  }
  throw new Error("the groups were never all counted");
}

const answerTotal = async (h: ActivityHarness, total: number) => {
  await h.press(`${total} altogether`);
};

/* -------------------------------------------------------------------------- */
/* One driver per mode, all seven shipped                                      */
/* -------------------------------------------------------------------------- */

const drivers: Record<GroupMode, (h: ActivityHarness) => Promise<void>> = {
  make_groups: async (h) => {
    const { groups: count, size } = target(h);
    await buildTray(h);
    await answerTotal(h, count * size);
  },
  equal_or_not: async (h) => {
    const counts = binCounts(h);
    expect(counts.length).toBeGreaterThan(1);
    const equal = counts.every((value) => value === counts[0]);
    await h.press(equal ? "Yes, all equal" : "No, one is different");
  },
  repeated_addition: async (h) => {
    const counts = binCounts(h);
    await countEveryGroup(h);
    await answerTotal(h, counts.reduce((sum, value) => sum + value, 0));
  },
  groups_to_equation: async (h) => {
    const counts = binCounts(h);
    const size = counts[0];
    // Worked out from the picture, then found among the options.
    await h.press(`${counts.length} × ${size} = ${counts.length * size}`);
  },
  factor_roles: async (h) => {
    const counts = binCounts(h);
    const groupSlot = labels(h).find((l) => /^counts the /.test(l) && !/ in each /.test(l))!;
    const eachSlot = labels(h).find((l) => /^counts the .* in each /.test(l))!;
    await h.press(`Number ${counts.length}`);
    await h.press(groupSlot);
    await h.press(`Number ${counts[0]}`);
    await h.press(eachSlot);
    await h.press("Check");
  },
  times_one: async (h) => {
    const counts = binCounts(h);
    await answerTotal(h, counts.reduce((sum, value) => sum + value, 0));
  },
  times_zero: async (h) => {
    expect(binCounts(h).every((count) => count === 0), "zero is drawn, not stated").toBe(true);
    await answerTotal(h, 0);
  },
};

describe("every shipped mode plays a complete round", () => {
  for (const [mode, drive] of Object.entries(drivers) as [GroupMode, (h: ActivityHarness) => Promise<void>][]) {
    it(`${mode} finishes a clean round`, async () => {
      /*
       * Deliberately small groups.
       *
       * `make_groups` needs one tap per object plus one to pick it up, so a
       * six-by-six tray is seventy-two presses a question and three hundred and
       * sixty a round — enough to time the test out under a loaded suite while
       * proving nothing the two-by-two tray does not.
       */
      const h = await expectStandardRound(groups, drive, {
        params: { mode, groupRange: [2, 3], sizeRange: [2, 3] },
        questions: 5,
      });
      h.unmount();
    });
  }
});

describe("the answer key matches the picture", () => {
  it("expects the product of the containers and their contents", async () => {
    const h = render("make_groups");
    const { groups: count, size } = target(h);
    await buildTray(h);
    await answerTotal(h, count * size);
    const [report] = h.koda.only("learning.answered").map((call) => call.args[0] as { correct: boolean; expected?: string });
    expect(report.correct, "a right answer was judged wrong").toBe(true);
    expect(report.expected).toBe(String(count * size));
    h.unmount();
  });

  it("offers exactly one equation that describes the picture", async () => {
    const h = render("groups_to_equation");
    const counts = binCounts(h);
    const correct = `${counts.length} × ${counts[0]} = ${counts.length * counts[0]}`;
    const options = labels(h).filter((label) => /=/.test(label));
    expect(options).toContain(correct);
    expect(options.filter((option) => option === correct)).toHaveLength(1);
    // No second option can total the same, or two answers would be right.
    const totals = options.map((option) => Number(/= (\d+)$/.exec(option)![1]));
    expect(totals.filter((value) => value === counts.length * counts[0])).toHaveLength(1);
    h.unmount();
  });
});

describe("a question is never vacuous", () => {
  it("never asks which factor is which when both are the same", () => {
    /*
     * Three groups of three has no wrong way round: both assignments are
     * right, so the question scores without teaching anything.
     *
     * Checked against the generator rather than by mounting two hundred rounds
     * — this is a property of the question, and React adds nothing to it.
     */
    for (let i = 0; i < 200; i += 1) {
      const question = buildQuestion({ mode: "factor_roles" }, i);
      expect(question.groups, `${question.groups} groups of ${question.size}`)
        .not.toBe(question.size);
    }
  });

  it("draws squares freely everywhere they are still answerable", () => {
    // A picture of three groups of three matches exactly one sentence, so the
    // constraint above is scoped to the one mode that needs it.
    const drawn = Array.from({ length: 200 }, (_, i) => buildQuestion({ mode: "groups_to_equation" }, i));
    expect(drawn.some((question) => question.groups === question.size)).toBe(true);
  });
});

describe("a wrong answer keeps the question", () => {
  it("asks again rather than moving on", async () => {
    const h = render("make_groups");
    const { groups: count, size } = target(h);
    await buildTray(h);
    const wrong = count * size + 1;
    await answerTotal(h, wrong);
    expect(h.koda.count("learning.answered")).toBe(1);
    // Same question, second attempt: no new question was presented.
    expect(h.koda.count("learning.present")).toBe(1);
    await h.press(/^(try again|again|retry)$/i).catch(() => undefined);
    await answerTotal(h, count * size);
    const reports = h.koda.only("learning.answered").map((c) => c.args[0] as { correct: boolean });
    expect(reports.map((r) => r.correct)).toEqual([false, true]);
    h.unmount();
  });
});

describe("a move that is not allowed is refused, not scored", () => {
  it("will not accept a total before the groups are built", async () => {
    const h = render("make_groups");
    const { groups: count, size } = target(h);
    await answerTotal(h, count * size);
    expect(h.koda.count("learning.answered"), "an unbuilt tray was scored").toBe(0);
    expect(h.text()).toMatch(/finish the/i);
    h.unmount();
  });

  it("will not put an object down without one in hand", async () => {
    const h = render("make_groups");
    const bin = labels(h).find((label) => /, holding \d+ of \d+$/.test(label))!;
    await h.press(bin);
    expect(binCounts(h).every((count) => count === 0)).toBe(true);
    expect(h.text()).toMatch(/tap a .* first/i);
    expect(h.koda.count("learning.answered")).toBe(0);
    h.unmount();
  });

  it("will not overfill a container", async () => {
    const h = render("make_groups");
    const { size } = target(h);
    for (let i = 0; i < size; i += 1) {
      await h.press(/^Take one /);
      await h.press(labels(h).find((l) => /, holding \d+ of \d+$/.test(l))!);
    }
    const full = labels(h).find((l) => new RegExp(`, holding ${size} of ${size}$`).test(l))!;
    await h.press(/^Take one /);
    await h.press(full);
    expect(h.text()).toMatch(/already has/i);
    expect(binCounts(h).filter((c) => c === size)).toHaveLength(1);
    h.unmount();
  });

  it("will not count the same group twice", async () => {
    const h = render("repeated_addition");
    const first = labels(h).find((l) => /^[a-z]+ 1, \d+ /.test(l))!;
    await h.press(first);
    const counted = labels(h).find((l) => l.endsWith(", counted"))!;
    await h.press(counted);
    expect(h.text()).toMatch(/already counted/i);
    expect(h.koda.count("learning.answered")).toBe(0);
    h.unmount();
  });

  it("will not check a half-filled pair of factor slots", async () => {
    const h = render("factor_roles");
    await h.press("Check");
    expect(h.koda.count("learning.answered"), "half an answer was scored").toBe(0);
    expect(h.text()).toMatch(/fill both/i);
    h.unmount();
  });

  it("judges both factor slots together, once", async () => {
    const h = render("factor_roles");
    const counts = binCounts(h);
    const groupSlot = labels(h).find((l) => /^counts the /.test(l) && !/ in each /.test(l))!;
    const eachSlot = labels(h).find((l) => /^counts the .* in each /.test(l))!;
    // Deliberately swapped.
    await h.press(`Number ${counts[0]}`);
    await h.press(groupSlot);
    await h.press(`Number ${counts.length}`);
    await h.press(eachSlot);
    await h.press("Check");
    expect(h.koda.count("learning.answered"), "one verdict for the pair").toBe(1);
    const [report] = h.koda.only("learning.answered").map((c) => c.args[0] as { correct: boolean });
    expect(report.correct, "the factors were the wrong way round").toBe(false);
    h.unmount();
  });
});

describe("a replayed round starts empty", () => {
  it("clears the tray between questions", async () => {
    const h = render("make_groups", { questionsPerRound: 2 });
    await drivers.make_groups(h);
    await h.press(/^(next|finish|continue)$/i);
    await h.settle();
    // The next question's containers hold nothing from the last one.
    expect(binCounts(h).every((count) => count === 0), "objects survived the question").toBe(true);
    h.unmount();
  });
});
