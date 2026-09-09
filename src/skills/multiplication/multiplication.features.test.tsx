import { afterEach, describe, expect, it, vi } from "vitest";
import { renderActivity, type ActivityHarness } from "../kit/testing";
import { skill } from ".";

const groups = skill.activities.groups;

const run = async (
  options: { features?: Record<string, boolean>; settings?: Record<string, unknown>; params?: Record<string, unknown> },
  drive?: (h: ActivityHarness) => Promise<void>,
) => {
  vi.spyOn(Math, "random").mockReturnValue(0.42);
  const h = renderActivity(groups, {
    params: { mode: "make_groups", groupRange: [3, 3], sizeRange: [2, 2], ...options.params },
    level: 1,
    features: options.features,
    settings: options.settings,
  });
  await drive?.(h);
  const result = {
    text: h.text(),
    calls: (name: string) => h.koda.count(name),
    buttons: h.buttons(),
    /*
     * Counted here, not returned as a closure.
     *
     * `run` unmounts before it returns, so a DOM query deferred to the call
     * site runs against an empty document and reports zero — which reads
     * exactly like the feature being off.
     */
    numbered: h.screen.queryAllByRole("img", { name: /\s\d+$/ }).length,
    pictures: h.screen.queryAllByRole("img").length,
    args: (name: string) => h.koda.only(name).map((call) => call.args),
  };
  h.unmount();
  vi.restoreAllMocks();
  return result;
};

/** Put one object into the first container: the smallest complete move. */
const placeOne = async (h: ActivityHarness) => {
  await h.press(/^Take one /);
  const bin = h.buttons().find((name) => /, holding \d+ of \d+$/.test(name));
  expect(bin).toBeTruthy();
  await h.press(bin!);
};

afterEach(() => vi.restoreAllMocks());

describe("every multiplication feature changes behaviour", () => {
  it("sound_chimes controls the placement chimes", async () => {
    const on = await run({}, placeOne);
    const off = await run({ features: { sound_chimes: false } }, placeOne);
    expect(on.calls("sound.play")).toBeGreaterThan(0);
    expect(off.calls("sound.play")).toBe(0);
  });

  it("audio_speech controls the spoken prompt and the read-aloud control", async () => {
    const readAloud = async (h: ActivityHarness) => {
      if (h.buttons().includes("Read question aloud")) await h.press("Read question aloud");
    };
    const on = await run({}, readAloud);
    const off = await run({ features: { audio_speech: false } }, readAloud);
    expect(on.calls("speech.say")).toBeGreaterThan(0);
    expect(off.calls("speech.say")).toBe(0);
    // A control that speaks nothing must not be on screen at all: the kit gates
    // its own lines, but this button is the activity's and needs its own gate.
    expect(on.buttons).toContain("Read question aloud");
    expect(off.buttons).not.toContain("Read question aloud");
  });

  it("audio_speech gates the count said as objects are placed", async () => {
    const on = await run({}, placeOne);
    const off = await run({ features: { audio_speech: false } }, placeOne);
    // The kit speaks the opening line and the hint; the count as a child taps
    // is the activity's own, and needs the activity's own gate.
    expect(on.args("speech.say").map(([text]) => text)).toContain("one");
    expect(off.calls("speech.say")).toBe(0);
  });

  it("counts the running total aloud as groups are added up", async () => {
    const spoken = await run(
      { params: { mode: "repeated_addition", groupRange: [3, 3], sizeRange: [4, 4] } },
      async (h) => {
        for (const bin of h.buttons().filter((n) => /^[a-z]+ \d+, \d+ /.test(n))) {
          await h.press(bin);
        }
      },
    );
    // Four, eight, twelve — the skip count the lesson is teaching.
    expect(spoken.args("speech.say").map(([text]) => text)).toEqual(
      expect.arrayContaining(["four", "eight", "twelve"]),
    );
  });

  it("says a refused move out loud as well as showing it", async () => {
    const refused = await run({}, async (h) => {
      const bin = h.buttons().find((n) => /, holding \d+ of \d+$/.test(n))!;
      await h.press(bin); // nothing in hand
    });
    expect(refused.text).toMatch(/tap a .* first/i);
    // A child who cannot read gets a buzz and a chime and nothing else without this.
    expect(refused.args("speech.say").map(([text]) => text)).toContain("Take one first.");
  });

  it("is silent in practice even with the voice switched on", async () => {
    const practice = await run({ params: { practice: true } }, placeOne);
    expect(practice.calls("speech.say"), "practice is retrieval, not a guided round").toBe(0);
  });

  it("haptic_feedback gates the SDK vibration", async () => {
    const on = await run({}, placeOne);
    const off = await run({ features: { haptic_feedback: false } }, placeOne);
    expect(on.calls("haptics.tap")).toBeGreaterThan(0);
    expect(off.calls("haptics.tap")).toBe(0);
  });

  it("counting_badges numbers the objects inside a group", async () => {
    const on = await run({}, placeOne);
    const off = await run({ features: { counting_badges: false } }, placeOne);
    // The number rides the artwork's accessible name, so it reaches a screen
    // reader too — which is what makes it a badge rather than decoration.
    expect(on.numbered).toBeGreaterThan(0);
    expect(off.numbered).toBe(0);
    // The objects are still drawn either way; only their numbering changed.
    expect(off.pictures).toBe(on.pictures);
  });

  it("running_product_badge controls the live total", async () => {
    const on = await run({}, placeOne);
    const off = await run({ features: { running_product_badge: false } }, placeOne);
    expect(on.text).toContain("So far");
    expect(off.text).not.toContain("So far");
  });

  it("strategy_scaffold controls the how-many-ready line", async () => {
    const on = await run({}, placeOne);
    const off = await run({ features: { strategy_scaffold: false } }, placeOne);
    expect(on.text).toMatch(/of 3 \w+ ready/);
    expect(off.text).not.toMatch(/of 3 \w+ ready/);
  });

  it("strategy_scaffold also controls the repeated-addition strip", async () => {
    const params = { mode: "repeated_addition", groupRange: [3, 3], sizeRange: [4, 4] };
    const on = await run({ params });
    const off = await run({ params, features: { strategy_scaffold: false } });
    expect(on.text).toContain("? + ? + ?");
    expect(off.text).not.toContain("? + ? + ?");
  });

  it("step_context_tags is enforced by the shared round chrome", async () => {
    const on = await run({});
    const off = await run({ features: { step_context_tags: false } });
    expect(on.text).toContain("Warm-up");
    expect(off.text).not.toContain("Warm-up");
  });

  /*
   * `premium_lessons` is read by `src/lib/premiumLessons.ts`, which decides
   * which lessons need a plan, and is covered by its own tests. It changes what
   * the Learn page offers rather than anything inside a round, so there is
   * nothing for an activity test to observe — this names it so the audit below
   * cannot pass by forgetting it.
   */
  /**
   * The one feature that belongs to a different engine.
   *
   * `times_table_chart` puts a reference chart behind a button in fact lessons,
   * so it is read by `FactDeck` rather than by the tray — and it is the reason
   * the feature waited until Phase 5, when there was finally a chart to show.
   */
  it("times_table_chart offers a reference chart in a fact lesson", async () => {
    const facts = skill.activities.facts;
    const on = renderActivity(facts, { params: { mode: "fives", partnerRange: [8, 8] } });
    expect(on.buttons()).toContain("Show the times table");
    await on.press("Show the times table");
    expect(on.screen.getByRole("img", { name: /^Times table up to \d+$/ })).toBeTruthy();
    // Looking a fact up is a support, not an answer.
    expect(on.koda.count("learning.supportUsed")).toBe(1);
    expect(on.koda.count("learning.answered")).toBe(0);
    on.unmount();

    const off = renderActivity(facts, {
      params: { mode: "fives", partnerRange: [8, 8] },
      features: { times_table_chart: false },
    });
    expect(off.buttons()).not.toContain("Show the times table");
    expect(off.screen.queryAllByRole("img", { name: /^Times table up to \d+$/ })).toHaveLength(0);
    off.unmount();
  });

  /*
   * A lookup table is the most complete help there is, so practice checks for
   * itself rather than trusting every practice lesson to switch the feature off.
   */
  it("never offers the chart in practice, however the feature is set", async () => {
    const facts = skill.activities.facts;
    const h = renderActivity(facts, {
      params: { practice: true, modes: ["fives", "doubles"], partnerRange: [4, 8] },
      features: { times_table_chart: true },
    });
    expect(h.buttons()).not.toContain("Show the times table");
    h.unmount();
  });

  it("covers every feature declared by the manifest", () => {
    const covered = new Set([
      "audio_speech", "sound_chimes", "haptic_feedback", "counting_badges",
      "running_product_badge", "strategy_scaffold", "step_context_tags",
      "premium_lessons", "times_table_chart",
    ]);
    for (const feature of skill.features) {
      expect(covered.has(feature.id), `${feature.id} has no feature test`).toBe(true);
    }
  });
});

describe("every setting has a reader", () => {
  it("answerInput swaps four choices for a number pad", async () => {
    const choices = await run({});
    const pad = await run({ settings: { answerInput: "pad" } });
    expect(choices.buttons.some((name) => /altogether$/.test(name))).toBe(true);
    expect(choices.buttons.some((name) => /^Digit \d$/.test(name))).toBe(false);
    expect(pad.buttons.some((name) => /^Digit \d$/.test(name))).toBe(true);
    expect(pad.buttons.some((name) => /altogether$/.test(name))).toBe(false);
  });

  it("speechRate reaches the spoken prompt", async () => {
    const fast = await run({ settings: { speechRate: 1.6 } }, async (h) => {
      await h.press("Read question aloud");
    });
    const said = fast.args("speech.say");
    expect(said.length).toBeGreaterThan(0);
    expect(said.some(([, opts]) => (opts as { rate?: number } | undefined)?.rate === 1.6)).toBe(true);
  });

  it("the step tag labels are the operator's words", async () => {
    const custom = await run({ settings: { warmupLabel: "Zebra Time" } });
    expect(custom.text).toContain("Zebra Time");
    expect(custom.text).not.toContain("Warm-up");
  });

  /**
   * `tableCeiling` has to reach the chart *and* the numbers.
   *
   * A chart that stops at ten beside a question asking for 11 × 7 is worse than
   * either choice on its own, so this checks both halves: the grid the child
   * reads, and the factors the questions are drawn from.
   */
  it("tableCeiling sets both the chart size and the factors drawn", async () => {
    const table = skill.activities.table;
    for (const [setting, ceiling] of [["12", 12], ["10", 10]] as [string, number][]) {
      const h = renderActivity(table, {
        params: { mode: "find_cell", questionsPerRound: 5 },
        settings: { tableCeiling: setting },
      });
      const grid = h.screen.getByRole("grid", { name: `Times table up to ${ceiling}` });
      // One header row plus `ceiling` rows of cells.
      expect(grid.querySelectorAll("button")).toHaveLength(ceiling * ceiling);
      const factors = h
        .buttons()
        .flatMap((label) => {
          const m = /^(\d+) times (\d+)$/.exec(label);
          return m ? [Number(m[1]), Number(m[2])] : [];
        });
      expect(Math.max(...factors)).toBe(ceiling);
      h.unmount();
    }
  });

  it("covers every setting declared by the manifest", () => {
    // The four tag labels share one reader; `freeLessons` is read by the shared
    // premium gate and covered with it.
    const covered = new Set([
      "warmupLabel", "activityLabel", "guidedLabel", "milestoneLabel",
      "speechRate", "answerInput", "freeLessons", "tableCeiling",
    ]);
    for (const key of Object.keys(skill.settings)) {
      expect(covered.has(key), `${key} has no reader`).toBe(true);
    }
  });
});
