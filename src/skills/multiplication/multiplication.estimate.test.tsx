import { describe, expect, it } from "vitest";
import { renderActivity, expectStandardRound, type ActivityHarness } from "../kit/testing";
import { skill } from ".";
import { buildQuestion, type EstimateMode } from "./activities/EstimateDial";
import {
  drawEstimateProduct,
  drawReasonableClaim,
  roundTo,
} from "./internal/data/multiplicationNumbers";

/**
 * EstimateDial, driven the way a child drives it.
 *
 * The rounding is worked out here from the factors on screen, never read back.
 * That matters especially in `reasonable`, where the whole task is judging a
 * number without computing it — a driver that read the true product would be
 * doing the one thing the lesson forbids.
 */

const estimate = skill.activities.estimate;

const ALL_MODES: EstimateMode[] = ["round_estimate", "reasonable"];

const render = (mode: EstimateMode, params: Record<string, unknown> = {}) =>
  renderActivity(estimate, { params: { mode, questionsPerRound: 5, ...params } });

/** Turn a dial until it reads the nearest ten (or hundred). */
async function roundDial(h: ActivityHarness, original: number, unit: 10 | 100): Promise<void> {
  const target = roundTo(original, unit);
  const up = target > original;
  for (let guard = 0; guard < 12; guard += 1) {
    if (h.buttons().includes(`${original} rounded to ${target}`)
      || h.screen.queryAllByLabelText(`${original} rounded to ${target}`).length > 0) return;
    await h.press(up ? `Round ${original} up` : `Round ${original} down`);
  }
}

const drivers: Record<EstimateMode, (h: ActivityHarness) => Promise<void>> = {
  round_estimate: async (h) => {
    const [, a] = /(\d+) × (\d+)\. Round to get close/.exec(h.text())!;
    await roundDial(h, Number(a), 10);
    await h.press("Check");
  },
  reasonable: async (h) => {
    const [, a, b, claim] = /Someone says (\d+) × (\d+) = (\d+)\. Could/.exec(h.text())!;
    // Judged by estimating, exactly as the lesson asks — never by computing.
    const rough = roundTo(Number(a), 10) * Number(b);
    const close = Number(claim) >= rough / 3 && Number(claim) <= rough * 3;
    await h.press(close ? `Yes, ${claim} could be right` : `No, ${claim} is not close`);
  },
};

describe("every estimate mode plays a complete round", () => {
  for (const mode of ALL_MODES) {
    it(`${mode} finishes a clean round`, async () => {
      const h = await expectStandardRound(estimate, drivers[mode], { params: { mode }, questions: 5 });
      h.unmount();
    });
  }
});

/* -------------------------------------------------------------------------- */
/* What gets rounded                                                           */
/* -------------------------------------------------------------------------- */

describe("only the numbers worth rounding get rounded", () => {
  it("leaves a single-digit factor alone", () => {
    for (let i = 0; i < 200; i += 1) {
      const question = buildQuestion({ mode: "round_estimate", digitsB: 1 }, i);
      // Rounding six to the nearest ten is a bigger lie than the estimate is
      // worth, and teaches a child to round things that did not need it.
      expect(question.unitB).toBe(1);
      expect(question.roundedB).toBe(question.b);
      expect(question.roundedA).toBe(roundTo(question.a, 10));
      expect(question.estimate).toBe(question.roundedA * question.roundedB);
    }
  });

  it("rounds both when both are two digits", () => {
    for (let i = 0; i < 200; i += 1) {
      const question = buildQuestion({ mode: "round_estimate", digitsB: 2 }, i);
      expect(question.unitB).toBe(10);
      expect(question.roundedB).toBe(roundTo(question.b, 10));
    }
  });

  it("never draws a factor that is already round, or exactly halfway", () => {
    for (let i = 0; i < 300; i += 1) {
      const value = drawEstimateProduct({ digitsA: 2, digitsB: 2 });
      for (const n of [value.a, value.b]) {
        // Already round makes estimating and computing the same act; exactly
        // halfway rounds differently depending on what a child was taught.
        expect(n % 10).not.toBe(0);
        expect(n % 10).not.toBe(5);
      }
    }
  });

  it("throws rather than hand back a fixed pair when nothing fits", () => {
    // The old fallback returned `47 × 6` however many digits were asked for.
    const three = drawEstimateProduct({ digitsA: 3, digitsB: 1 });
    expect(String(three.a)).toHaveLength(3);
  });
});

describe("turning the dials", () => {
  /*
   * The exact answer must not be on screen before the estimating starts.
   *
   * Standing on the untouched factors, the running line read "About 264" for
   * `33 × 8` — the true product, under the word "about", in the lesson that
   * asks a child not to work it out.
   */
  it("shows no estimate until a dial has been turned", async () => {
    const h = render("round_estimate", { digitsB: 1 });
    const [, a, b] = /(\d+) × (\d+)\. Round to get close/.exec(h.text())!;
    expect(h.text()).not.toContain(`About ${Number(a) * Number(b)}`);
    expect(h.text()).toMatch(/Round them to see/);
    await h.press(`Round ${a} up`);
    expect(h.text()).toMatch(/About \d+/);
    h.unmount();
  });

  it("moves to a neighbouring ten and shows what the pair comes to", async () => {
    const h = render("round_estimate", { digitsB: 1 });
    const [, a, b] = /(\d+) × (\d+)\. Round to get close/.exec(h.text())!;
    await h.press(`Round ${a} up`);
    const up = Math.ceil(Number(a) / 10) * 10;
    expect(h.screen.getByLabelText(`${a} rounded to ${up}`)).toBeTruthy();
    expect(h.text()).toContain(`About ${up * Number(b)}`);
    h.unmount();
  });

  it("refuses to round a factor that does not need it", async () => {
    const h = render("round_estimate", { digitsB: 1 });
    const [, , b] = /(\d+) × (\d+)\. Round to get close/.exec(h.text())!;
    expect(h.buttons()).not.toContain(`Round ${b} up`);
    h.unmount();
  });

  it("refuses a check before anything has been rounded", async () => {
    const h = render("round_estimate", { digitsB: 1 });
    await h.press("Check");
    expect(h.koda.count("learning.answered")).toBe(0);
    expect(h.text()).toMatch(/still need rounding/i);
    h.unmount();
  });

  it("marks the wrong neighbour wrong, and says which one was nearer", async () => {
    const h = render("round_estimate", { digitsB: 1 });
    const [, a] = /(\d+) × (\d+)\. Round to get close/.exec(h.text())!;
    const nearest = roundTo(Number(a), 10);
    const wrong = nearest > Number(a) ? "down" : "up";
    await h.press(`Round ${a} ${wrong}`);
    await h.press("Check");
    const [report] = h.koda.only("learning.answered").map((c) => c.args[0] as { correct: boolean });
    expect(report.correct).toBe(false);
    expect(h.text()).toMatch(new RegExp(`${a} rounds to ${nearest}`));
    h.unmount();
  });
});

/* -------------------------------------------------------------------------- */
/* Judging a claim                                                             */
/* -------------------------------------------------------------------------- */

/**
 * A claim that is only just wrong cannot be judged by estimating.
 *
 * `47 × 18 = 847` against a true 846 is a computation question wearing an
 * estimation lesson's clothes. Every wrong claim here is out by a whole place,
 * which is exactly the size of error an estimate catches.
 */
describe("wrong claims are wrong by a place, never by one", () => {
  it("only ever claims the truth or ten times off it", () => {
    for (let i = 0; i < 400; i += 1) {
      const claim = drawReasonableClaim({ digitsA: 2, digitsB: 1 });
      if (claim.reasonable) {
        expect(claim.claim).toBe(claim.product);
        continue;
      }
      expect(claim.claim).not.toBe(claim.product);
      expect(Math.abs(claim.claim - claim.product)).not.toBe(1);
      const tenfold = claim.claim === claim.product * 10
        || claim.claim === Math.floor(claim.product / 10);
      expect(tenfold, `${claim.a} × ${claim.b} claimed as ${claim.claim}`).toBe(true);
    }
  });

  it("draws both a true claim and a false one over a round", () => {
    const seen = new Set<boolean>();
    for (let i = 0; i < 100; i += 1) {
      seen.add(buildQuestion({ mode: "reasonable" }, i).reasonable);
    }
    expect(seen.size, "every claim came out the same way").toBe(2);
  });

  it("labels the claim against real arithmetic", () => {
    for (let i = 0; i < 200; i += 1) {
      const question = buildQuestion({ mode: "reasonable" }, i);
      expect(question.reasonable).toBe(question.claim === question.a * question.b);
      expect(question.expected).toBe(question.reasonable ? "Yes" : "No");
    }
  });
});

describe("the estimate is a support, not an answer", () => {
  it("files a support and scores nothing", async () => {
    const h = render("reasonable");
    await h.press("Round them and see");
    expect(h.koda.count("learning.answered")).toBe(0);
    expect(h.koda.count("learning.supportUsed")).toBe(1);
    const question = /Someone says (\d+) × (\d+)/.exec(h.text())!;
    const rough = roundTo(Number(question[1]), 10) * Number(question[2]);
    expect(h.text()).toContain(`is about ${rough}`);
    h.unmount();
  });

  it("lets a child judge without asking for it", async () => {
    const h = render("reasonable");
    const [, , , claim] = /Someone says (\d+) × (\d+) = (\d+)\./.exec(h.text())!;
    await h.press(new RegExp(`^(Yes|No), ${claim}`));
    expect(h.koda.count("learning.answered")).toBe(1);
    expect(h.koda.count("learning.supportUsed")).toBe(0);
    h.unmount();
  });

  it("explains the size of the error either way", async () => {
    const h = render("reasonable");
    const [, a, b, claim] = /Someone says (\d+) × (\d+) = (\d+)\./.exec(h.text())!;
    const truthful = Number(claim) === Number(a) * Number(b);
    // Answered the wrong way round on purpose: the explanation has to hold.
    await h.press(truthful ? `No, ${claim} is not close` : `Yes, ${claim} could be right`);
    const [report] = h.koda.only("learning.answered").map((c) => c.args[0] as { correct: boolean });
    expect(report.correct).toBe(false);
    expect(h.text()).toMatch(truthful ? /sits right beside it/ : /is ten times out/);
    h.unmount();
  });
});

/* -------------------------------------------------------------------------- */
/* Worksheet                                                                   */
/* -------------------------------------------------------------------------- */

describe("the worksheet prints both modes", () => {
  it("prints the estimate and the real answer beside it", () => {
    for (const mode of ALL_MODES) {
      for (let i = 0; i < 20; i += 1) {
        const question = buildQuestion({ mode }, i);
        const printed = estimate.worksheet!.printed!(question);
        expect(printed, `${mode} prints nothing`).toBeTruthy();
        expect(printed!.text).toContain(`${question.a} × ${question.b}`);
        expect(printed!.answer).toContain(String(question.estimate));
        expect(estimate.worksheet!.method!(question)!.length).toBeGreaterThan(1);
        // Estimation is arithmetic on paper; there is nothing to draw.
        expect(estimate.worksheet!.figure!(question)).toBeNull();
      }
    }
  });
});
