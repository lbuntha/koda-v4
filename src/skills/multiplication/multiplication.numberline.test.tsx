import { describe, expect, it, vi } from "vitest";
import { renderActivity, expectStandardRound, type ActivityHarness } from "../kit/testing";
import { skill } from ".";
import { buildQuestion, type NumberLineMode } from "./activities/SkipTrack";

/**
 * SkipTrack, driven the way a child drives it.
 *
 * Every answer is worked out from the prompt's own numbers and the line's own
 * description — "3 hops of 5, on 15" — and never read back from the engine's
 * answer key. A driver that trusted `question.expected` would pass just as
 * happily against a wrong one.
 */

const numberline = skill.activities.numberline;

/** The line as it stands, read off the SVG's own label. */
const line = (h: ActivityHarness): { made: number; step: number; on: number } => {
  const labels = h.screen.getAllByRole("img").map((el) => el.getAttribute("aria-label") ?? "");
  const found = labels
    .map((label) => /^Number line: (\d+) hops of (\d+), on (\d+)$/.exec(label))
    .find(Boolean);
  expect(found, `no number line on screen; saw ${JSON.stringify(labels)}`).toBeTruthy();
  return { made: Number(found![1]), step: Number(found![2]), on: Number(found![3]) };
};

const render = (mode: NumberLineMode, params: Record<string, unknown> = {}) =>
  renderActivity(numberline, { params: { mode, questionsPerRound: 5, ...params } });

/** Hop forward `times` times, checking the line moves each time. */
async function hopTo(h: ActivityHarness, times: number): Promise<void> {
  for (let i = 0; i < times; i += 1) await h.press("Hop forward");
  expect(line(h).made).toBe(times);
}

const drivers: Record<NumberLineMode, (h: ActivityHarness) => Promise<void>> = {
  skip_count: async (h) => {
    const [, step, hops] = /Count in (\d+)s\. Make (\d+) hops/.exec(h.text())!;
    await hopTo(h, Number(hops));
    await h.press(`Land on ${Number(step) * Number(hops)}`);
  },
  hops_to_product: async (h) => {
    const [, hops, step] = /(\d+) × (\d+)\. Make/.exec(h.text())!;
    await hopTo(h, Number(hops));
    await h.press(`Land on ${Number(step) * Number(hops)}`);
  },
  missing_hop: async (h) => {
    const [, step, landing] = /Hops of (\d+) land on (\d+)\./.exec(h.text())!;
    // The hop count is worked out here, not read from the engine.
    await hopTo(h, Number(landing) / Number(step));
    await h.press("Check");
  },
  count_multiples: async (h) => {
    const [, value, step] = /Is (\d+) a multiple of (\d+)\?/.exec(h.text())!;
    const yes = Number(value) % Number(step) === 0;
    await h.press(yes ? /^Yes, / : /^No, /);
  },
};

describe("every number line mode plays a complete round", () => {
  for (const [mode, drive] of Object.entries(drivers) as [NumberLineMode, (h: ActivityHarness) => Promise<void>][]) {
    it(`${mode} finishes a clean round`, async () => {
      const h = await expectStandardRound(numberline, drive, {
        // Short runs: every hop is a press, and five questions of ten hops
        // proves nothing three hops does not.
        params: {
          mode,
          steps: [2, 5],
          hopRange: [2, 3],
          max: mode === "count_multiples" ? 20 : 100,
        },
        questions: 5,
      });
      h.unmount();
    });
  }
});

describe("the hops are placed one at a time", () => {
  it("moves the line forward and back, a hop at a time", async () => {
    const h = render("skip_count", { steps: [5], hopRange: [4, 4] });
    expect(line(h)).toEqual({ made: 0, step: 5, on: 0 });
    await h.press("Hop forward");
    expect(line(h)).toEqual({ made: 1, step: 5, on: 5 });
    await h.press("Hop forward");
    expect(line(h)).toEqual({ made: 2, step: 5, on: 10 });
    await h.press("Hop back");
    expect(line(h)).toEqual({ made: 1, step: 5, on: 5 });
    h.unmount();
  });

  it("will not hop back past zero, or past the end of the line", async () => {
    const h = render("skip_count", { steps: [5], hopRange: [3, 3] });
    await h.press("Hop back");
    expect(line(h).made).toBe(0);
    expect(h.text()).toMatch(/already at the start/i);
    // The line runs one hop past the answer, so an overshoot is possible — and
    // exactly one hop of it, so a child cannot wander off the apparatus.
    for (let i = 0; i < 6; i += 1) await h.press("Hop forward");
    expect(line(h).made).toBe(4);
    expect(h.text()).toMatch(/stops at 20/i);
    expect(h.koda.count("learning.answered"), "a refused hop was scored").toBe(0);
    h.unmount();
  });
});

describe("a move that is not allowed is refused, not scored", () => {
  it("will not take a landing before the hops are made", async () => {
    const h = render("skip_count", { steps: [5], hopRange: [4, 4] });
    await h.press("Hop forward");
    await h.press("Land on 20");
    expect(h.koda.count("learning.answered")).toBe(0);
    // The nudge names the live numbers, which is the §7 contract for this one.
    expect(h.text()).toMatch(/you have made 1 hop of 5\. you need 4/i);
    h.unmount();
  });

  it("takes it once the run is complete", async () => {
    const h = render("skip_count", { steps: [5], hopRange: [4, 4] });
    await hopTo(h, 4);
    await h.press("Land on 20");
    expect(h.koda.count("learning.answered")).toBe(1);
    h.unmount();
  });
});

/**
 * §12 trap 7: a skip count that never names its product has taught counting.
 */
describe("the run is always named as a multiplication", () => {
  it("says the product in the feedback, right or wrong", async () => {
    for (const answer of ["Land on 20", "Land on 15"]) {
      const h = render("skip_count", { steps: [5], hopRange: [4, 4] });
      await hopTo(h, 4);
      await h.press(answer);
      expect(h.text()).toMatch(/4 hops of 5 is 4 × 5 = 20\./);
      h.unmount();
    }
  });

  it("counts the landings out loud as they are reached", async () => {
    const h = render("skip_count", { steps: [5], hopRange: [3, 3] });
    await hopTo(h, 3);
    const said = h.koda.only("speech.say").map((call) => call.args[0] as string);
    expect(said).toContain("five");
    expect(said).toContain("ten");
    expect(said).toContain("fifteen");
    h.unmount();
  });

  it("says nothing on the way back — an undo is not the thing it undoes", async () => {
    const h = render("skip_count", { steps: [5], hopRange: [3, 3] });
    await hopTo(h, 2);
    const before = h.koda.count("speech.say");
    await h.press("Hop back");
    expect(h.koda.count("speech.say")).toBe(before);
    h.unmount();
  });

  it("is silent when audio_speech is off", async () => {
    const h = renderActivity(numberline, {
      params: { mode: "skip_count", steps: [5], hopRange: [3, 3], questionsPerRound: 5 },
      features: { audio_speech: false },
    });
    await hopTo(h, 3);
    expect(h.koda.count("speech.say")).toBe(0);
    h.unmount();
  });
});

/**
 * Every switch has to reach every engine.
 *
 * The features are declared once for the skill and read by each engine in its
 * own terms — on this apparatus `counting_badges` numbers the landings and
 * `strategy_scaffold` writes the repeated addition. A switch that reaches
 * `GroupTray` and stops there is a dead control on two thirds of the skill,
 * and the features suite over one engine would never have said so.
 */
describe("every feature reaches the number line", () => {
  /** The numbers written under the line, read out of the line itself. */
  const landingLabels = (h: ActivityHarness): string[] => {
    const svg = h.screen
      .getAllByRole("img")
      .find((el) => /^Number line:/.test(el.getAttribute("aria-label") ?? ""))!;
    return [...svg.querySelectorAll("text")].map((t) => t.textContent ?? "");
  };

  const twoHops = async (features?: Record<string, boolean>) => {
    const h = renderActivity(numberline, {
      params: { mode: "skip_count", steps: [5], hopRange: [4, 4], questionsPerRound: 5 },
      features,
    });
    await hopTo(h, 2);
    // Read before unmounting: a query deferred past `unmount` finds nothing,
    // which looks exactly like the feature being switched off.
    const seen = { labels: landingLabels(h), text: h.text(), koda: h.koda };
    return { ...seen, unmount: h.unmount };
  };

  it("counting_badges numbers the landings", async () => {
    const on = await twoHops();
    expect(on.labels).toEqual(["0", "5", "10"]);
    on.unmount();
    const off = await twoHops({ counting_badges: false });
    expect(off.labels).toEqual([]);
    off.unmount();
  });

  it("stops numbering a line with more landings than it can label", async () => {
    // Thirteen stops across 320 units is a number every twenty-five: past the
    // limit the badges are dropped rather than drawn on top of each other.
    const h = render("skip_count", { steps: [2], hopRange: [12, 12] });
    await hopTo(h, 3);
    expect(landingLabels(h)).toEqual([]);
    h.unmount();
  });

  it("running_product_badge shows where the hops have reached", async () => {
    const on = await twoHops();
    expect(on.text).toMatch(/So far: 10/);
    on.unmount();
    const off = await twoHops({ running_product_badge: false });
    expect(off.text).not.toMatch(/So far:/);
    off.unmount();
  });

  it("strategy_scaffold writes the repeated addition as it is built", async () => {
    const on = await twoHops();
    expect(on.text).toMatch(/5 \+ 5 = 10/);
    on.unmount();
    const off = await twoHops({ strategy_scaffold: false });
    expect(off.text).not.toMatch(/5 \+ 5/);
    off.unmount();
  });

  it("sound_chimes and haptic_feedback ride along with each hop", async () => {
    const on = await twoHops();
    expect(on.koda.count("sound.play")).toBeGreaterThan(0);
    expect(on.koda.count("haptics.tap")).toBeGreaterThan(0);
    on.unmount();
    const off = await twoHops({ sound_chimes: false, haptic_feedback: false });
    expect(off.koda.count("sound.play")).toBe(0);
    expect(off.koda.count("haptics.tap")).toBe(0);
    off.unmount();
  });
});

describe("the landings offered are the ones this task goes wrong by", () => {
  it("offers the answer and three honest near misses", () => {
    for (let i = 0; i < 200; i += 1) {
      const question = buildQuestion({ mode: "skip_count" }, i);
      expect(question.landing).toBe(question.hops * question.step);
      expect(question.choices).toContain(question.landing);
      expect(new Set(question.choices).size).toBe(4);
      for (const choice of question.choices) {
        expect(choice).toBeGreaterThan(0);
        // §12 trap 13: never the product nudged by one. A choice list built
        // that way lets the run be skipped and the numbers reasoned over.
        if (choice !== question.landing) {
          expect(Math.abs(choice - question.landing)).not.toBe(1);
        }
      }
    }
  });

  it("counts in the lengths a child actually skip counts in", () => {
    for (let i = 0; i < 200; i += 1) {
      const question = buildQuestion({ mode: "skip_count" }, i);
      expect([2, 3, 4, 5, 10]).toContain(question.step);
      expect(question.hops).toBeGreaterThanOrEqual(3);
      expect(question.landing).toBeLessThanOrEqual(100);
    }
  });

  it("leaves one hop of room past the answer, and no more", () => {
    for (const mode of ["skip_count", "hops_to_product", "missing_hop"] as NumberLineMode[]) {
      for (let i = 0; i < 100; i += 1) {
        const question = buildQuestion({ mode }, i);
        expect(question.lineMax).toBe(question.step * (question.hops + 1));
      }
    }
  });
});

describe("spotting multiples", () => {
  it("asks a question whose answer is the arithmetic, not the engine's word", () => {
    for (let i = 0; i < 200; i += 1) {
      const question = buildQuestion({ mode: "count_multiples" }, i);
      expect(question.isMultiple).toBe(question.value % question.step === 0);
      expect(question.expected).toBe(question.value % question.step === 0 ? "Yes" : "No");
    }
  });

  it("keeps a non-multiple close enough that size alone cannot answer it", () => {
    for (let i = 0; i < 200; i += 1) {
      const question = buildQuestion({ mode: "count_multiples" }, i);
      if (question.isMultiple) continue;
      const nearest = Math.round(question.value / question.step) * question.step;
      expect(Math.abs(question.value - nearest)).toBeLessThanOrEqual(2);
    }
  });

  it("runs the line to the first landing at or past the number asked about", () => {
    for (let i = 0; i < 200; i += 1) {
      const question = buildQuestion({ mode: "count_multiples" }, i);
      expect(question.lineMax % question.step).toBe(0);
      expect(question.lineMax).toBeGreaterThanOrEqual(question.value);
      expect(question.lineMax - question.value).toBeLessThan(question.step);
    }
  });

  /*
   * Both halves of the draw, forced.
   *
   * A *sequence* rather than a fixed value, because a pinned `Math.random` also
   * pins the offset a near miss is drawn at: at 0.9 the anchor lands on the
   * ceiling and the only offset ever tried is `+2`, which overshoots it two
   * hundred times and drops the generator into its documented fallback — a
   * multiple. Left as a constant this test would have quietly checked the
   * multiple branch twice.
   */
  it.each([
    [[0.1, 0.5], true, /is \d+ hops of 5, so a hop lands right on it/],
    [[0.9, 0.5, 0.1], false, /Hops of 5 go straight past/],
  ])("explains where the hops went (%j)", async (seeds, expectMultiple, message) => {
    let call = 0;
    vi.spyOn(Math, "random").mockImplementation(() => seeds[call++ % seeds.length]);
    const h = render("count_multiples", { steps: [5], max: 20 });
    const [, value, step] = /Is (\d+) a multiple of (\d+)\?/.exec(h.text())!;
    const truth = Number(value) % Number(step) === 0;
    expect(truth).toBe(expectMultiple);
    // Answered the wrong way round on purpose: the explanation has to hold
    // whether the child was right or not.
    await h.press(truth ? /^No, / : /^Yes, /);
    const [report] = h.koda.only("learning.answered").map((c) => c.args[0] as { correct: boolean });
    expect(report.correct).toBe(false);
    expect(h.text()).toMatch(message);
    h.unmount();
    vi.restoreAllMocks();
  });
});

describe("counting the hops back to a factor", () => {
  it("judges the hop count the child built, and does not refuse a short one", async () => {
    const h = render("missing_hop", { steps: [5], hopRange: [4, 4] });
    await hopTo(h, 3);
    await h.press("Check");
    expect(h.koda.count("learning.answered"), "a short run must be answerable and wrong").toBe(1);
    const [report] = h.koda.only("learning.answered").map((c) => c.args[0] as { correct: boolean });
    expect(report.correct).toBe(false);
    h.unmount();
  });
});

describe("the worksheet prints every mode", () => {
  it("prints a self-contained question and its answer", () => {
    for (const mode of Object.keys(drivers) as NumberLineMode[]) {
      for (let i = 0; i < 20; i += 1) {
        const question = buildQuestion({ mode }, i);
        const printed = numberline.worksheet!.printed!(question);
        expect(printed, `${mode} prints nothing`).toBeTruthy();
        expect(printed!.text).toContain(String(question.step));
        expect(printed!.answer).toBe(
          mode === "missing_hop"
            ? String(question.hops)
            : mode === "count_multiples"
              ? (question.isMultiple ? "Yes" : "No")
              : String(question.landing),
        );
        expect(numberline.worksheet!.method!(question)!.length).toBeGreaterThan(1);
        expect(numberline.worksheet!.figure!(question)).toBeTruthy();
      }
    }
  });
});
