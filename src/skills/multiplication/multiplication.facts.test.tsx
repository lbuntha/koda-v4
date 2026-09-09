import { describe, expect, it } from "vitest";
import { renderActivity, expectStandardRound, type ActivityHarness } from "../kit/testing";
import { skill } from ".";
import { buildQuestion, rowsFor, type FactMode } from "./activities/FactDeck";
import {
  HELPER_FACTS,
  applyAdjust,
  derivedProduct,
  productOf,
} from "./internal/data/helperFacts";

/**
 * FactDeck, driven the way a child drives it.
 *
 * The answer to every question is computed in the test from the fact on screen,
 * never read back from `question.expected`. A driver that trusted the engine's
 * own answer key would pass just as happily against a wrong one — which for a
 * skill whose whole content is a table of facts is the failure that matters.
 */

const facts = skill.activities.facts;

const ALL_MODES: FactMode[] = [
  "doubles",
  "tens",
  "fives",
  "double_double",
  "triple_double",
  "add_a_group",
  "subtract_a_group",
  "break_apart",
  "near_square",
  "known_fact",
];

/** The fact on screen, read off the prompt rather than the question object. */
const factOnScreen = (h: ActivityHarness): { a: number; b: number } => {
  const found = /(\d+) × (\d+)\./.exec(h.text());
  expect(found, `no fact on screen; saw ${JSON.stringify(h.text().slice(0, 120))}`).toBeTruthy();
  return { a: Number(found![1]), b: Number(found![2]) };
};

const render = (mode: FactMode, params: Record<string, unknown> = {}) =>
  renderActivity(facts, { params: { mode, questionsPerRound: 5, ...params } });

/**
 * One driver for all ten modes.
 *
 * Every mode asks the same thing — what is this product — and differs only in
 * what stands between the child and answering it. `known_fact` has to choose a
 * route first; the rest may turn a card over or not.
 */
const drive = async (h: ActivityHarness): Promise<void> => {
  const helper = h.buttons().find((label) => /^Use \d+ times \d+$/.test(label));
  if (helper) {
    // `known_fact`: try each candidate until one is accepted. A wrong choice is
    // refused rather than scored, which is exactly what this checks.
    for (const label of h.buttons().filter((l) => /^Use \d+ times \d+$/.test(l))) {
      await h.press(label);
      if (!h.buttons().some((l) => /^Use \d+ times \d+$/.test(l))) break;
    }
  }
  const { a, b } = factOnScreen(h);
  await h.press(`${a * b}`);
};

describe("every fact mode plays a complete round", () => {
  for (const mode of ALL_MODES) {
    it(`${mode} finishes a clean round`, async () => {
      const h = await expectStandardRound(facts, drive, {
        params: { mode, partnerRange: [2, 6] },
        questions: 5,
      });
      h.unmount();
    });
  }
});

/* -------------------------------------------------------------------------- */
/* The ladder drives the deck                                                  */
/* -------------------------------------------------------------------------- */

describe("every question is the ladder's own arithmetic", () => {
  it("reconstructs the product from the helper chain, for every mode that has one", () => {
    for (const mode of ALL_MODES) {
      for (let i = 0; i < 120; i += 1) {
        const question = buildQuestion({ mode }, i);
        expect(question.product).toBe(question.a * question.b);
        if (question.helpers.length === 0) {
          expect(["doubles", "tens"]).toContain(mode);
          continue;
        }
        // The helper card, worked through, has to land on the fact it claims to.
        expect(question.helpers.every((h) => h.product === h.a * h.b)).toBe(true);
        expect(question.adjustment).not.toBe("");
      }
    }
  });

  it("holds `helper × adjust === target` for all 108 rows", () => {
    expect(HELPER_FACTS).toHaveLength(108);
    for (const row of HELPER_FACTS) {
      expect(derivedProduct(row)).toBe(productOf(row.target));
      expect(applyAdjust(row.helpers.map(productOf), row.adjust)).toBe(productOf(row.target));
    }
  });

  it("drills the table the lesson named, and no other", () => {
    for (const [mode, drivers] of [
      ["add_a_group", [3]],
      ["add_a_group", [6]],
      ["break_apart", [7]],
      ["break_apart", [11, 12]],
    ] as [FactMode, number[]][]) {
      for (let i = 0; i < 60; i += 1) {
        const question = buildQuestion({ mode, drivers }, i);
        expect(drivers, `${mode} drew ${question.a} × ${question.b}`).toContain(question.driver);
      }
    }
  });

  it("refuses a lesson that asks a strategy for a table it does not derive", () => {
    // An authoring mistake, not a range to quietly widen: the sevens are not
    // reachable by doubling twice, and handing back the fours would hide it.
    expect(() => rowsFor("double_double", { drivers: [7] })).toThrow(/no double_double fact/);
    expect(() => rowsFor("near_square", { partnerRange: [2, 2] })).toThrow(/no near_square fact/);
  });

  it("never offers a table above twelve, or a partner outside the range asked for", () => {
    for (const mode of ALL_MODES) {
      for (let i = 0; i < 80; i += 1) {
        const question = buildQuestion({ mode, partnerRange: [4, 9] }, i);
        expect(question.a).toBeLessThanOrEqual(12);
        expect(question.b).toBeLessThanOrEqual(12);
        expect(question.a).toBeGreaterThan(0);
        expect(question.b).toBeGreaterThan(0);
      }
    }
  });
});

/* -------------------------------------------------------------------------- */
/* The helper is a support, not an answer                                      */
/* -------------------------------------------------------------------------- */

describe("turning the helper card over is a support, never an answer", () => {
  it("files a support and scores nothing", async () => {
    const h = render("fives", { partnerRange: [8, 8] });
    await h.press(/^Turn over the helper card/);
    expect(h.koda.count("learning.answered"), "the helper was scored as an answer").toBe(0);
    expect(h.koda.count("learning.supportUsed")).toBe(1);
    // And the card now says the fact and the move to make with it.
    expect(h.text()).toMatch(/10 × 8 = 80/);
    expect(h.text()).toMatch(/halve it/i);
    h.unmount();
  });

  it("lets a child answer without turning it over at all", async () => {
    const h = render("fives", { partnerRange: [8, 8] });
    await h.press("40");
    expect(h.koda.count("learning.answered")).toBe(1);
    expect(h.koda.count("learning.supportUsed")).toBe(0);
    h.unmount();
  });

  it("does not show a card for the facts that are known outright", async () => {
    for (const mode of ["doubles", "tens"] as FactMode[]) {
      const h = render(mode, { partnerRange: [6, 6] });
      expect(h.buttons().some((l) => /^Turn over the helper card/.test(l))).toBe(false);
      h.unmount();
    }
  });
});

/**
 * §12 trap 5. The single most-installed false rule in this topic.
 */
describe("times ten is never taught as adding a zero", () => {
  it("draws the tens as tens, and says so in the method", () => {
    const question = buildQuestion({ mode: "tens", partnerRange: [7, 7] }, 0);
    const method = facts.worksheet!.method!(question)!.join(" ");
    expect(method).toMatch(/7 tens/);
    expect(method).toMatch(/moves up a place/i);
    expect(method.toLowerCase()).not.toMatch(/add a zero|put a zero|add zero/);
  });

  it("shows a stick of ten for every ten, not a digit trick", async () => {
    const h = render("tens", { partnerRange: [7, 7] });
    expect(h.screen.getByRole("img", { name: "7 sticks of ten" })).toBeTruthy();
    expect(h.text().toLowerCase()).not.toMatch(/zero/);
    h.unmount();
  });

  /*
   * The picture and the sentence have to say the same thing.
   *
   * Found by opening the lesson, not by the suite: `10 × 2` was captioned
   * "what is 2 tens?" and drawn as two sticks of ten. The product is right
   * either way, which is why every test passed — but this skill fixes `a × b`
   * as *a groups of b*, so that sentence reads "ten twos" and the picture was
   * of something else. §12 trap 2, in the one lesson about which number counts
   * what.
   */
  it("writes the fact the way the model draws it", () => {
    for (let i = 0; i < 200; i += 1) {
      const question = buildQuestion({ mode: "tens" }, i);
      // `n × 10`: n groups of ten, which is what n sticks of ten shows.
      expect(question.b).toBe(10);
      expect(question.prompt).toContain(`What is ${question.a} tens?`);
      expect(question.a * 10).toBe(question.product);
    }
  });
});

describe("the doubles picture matches the order the fact is written in", () => {
  it("draws a groups of b, whichever way round the two is", async () => {
    for (let i = 0; i < 40; i += 1) {
      const question = buildQuestion({ mode: "doubles", partnerRange: [3, 7] }, i);
      expect([question.a, question.b]).toContain(2);
      const h = renderActivity(facts, {
        params: { mode: "doubles", questionsPerRound: 5 },
      });
      const drawn = h.screen
        .getAllByRole("img")
        .map((el) => el.getAttribute("aria-label") ?? "")
        .find((label) => /^\d+ groups of \d+$/.test(label));
      const fact = factOnScreen(h);
      expect(drawn, "no dot grid on screen").toBe(`${fact.a} groups of ${fact.b}`);
      h.unmount();
    }
  });

  it("calls it a double only when the two comes first", () => {
    for (let i = 0; i < 200; i += 1) {
      const question = buildQuestion({ mode: "doubles" }, i);
      if (question.a === 2) expect(question.prompt).toMatch(/What is double \d+\?/);
      else expect(question.prompt).toMatch(/What is \d+ twos/);
    }
  });
});

/* -------------------------------------------------------------------------- */
/* Choosing a route                                                            */
/* -------------------------------------------------------------------------- */

describe("known_fact asks for a route before it asks for an answer", () => {
  it("offers four true facts, exactly one of which helps", () => {
    for (let i = 0; i < 200; i += 1) {
      const question = buildQuestion({ mode: "known_fact" }, i);
      expect(question.candidates).toHaveLength(4);
      expect(question.candidates.filter((c) => c.helps)).toHaveLength(1);
      for (const candidate of question.candidates) {
        // Every option is a real fact...
        expect(candidate.product).toBe(candidate.a * candidate.b);
        // ...and none of the three wrong ones can be picked by arithmetic
        // alone, because none of them shares the target's product.
        if (!candidate.helps) expect(candidate.product).not.toBe(question.product);
      }
      // The one that helps really does derive the target.
      const helper = question.candidates.find((c) => c.helps)!;
      expect(
        question.helpers.some((h) => h.a === helper.a && h.b === helper.b),
        `${helper.a} × ${helper.b} is offered as the helper but is not in the chain`,
      ).toBe(true);
    }
  });

  it("withholds the answer buttons until a route is chosen", async () => {
    const h = render("known_fact", { partnerRange: [6, 8] });
    const before = h.buttons();
    expect(before.some((l) => /^Use \d+ times \d+$/.test(l))).toBe(true);
    expect(before.filter((l) => /^\d+$/.test(l)), "answers were offered before a route").toHaveLength(0);
    h.unmount();
  });

  /*
   * Over twenty fresh questions rather than one.
   *
   * Which of the four cards helps is drawn per question, so pressing the first
   * one lands on the helper about a quarter of the time — and a single-question
   * version of this test passes or fails on that draw. Twenty questions makes
   * the refusal certain to be exercised, and asserts the contract on every
   * press either way: a card that does not help is refused and never scored,
   * and the one that does clears the row.
   */
  it("refuses a fact that does not help, and scores nothing", async () => {
    const isOption = (label: string) => /^Use \d+ times \d+$/.test(label);
    let refusals = 0;
    let accepted = 0;

    for (let question = 0; question < 20; question += 1) {
      const h = render("known_fact", { partnerRange: [6, 8] });
      for (let guard = 0; guard < 4; guard += 1) {
        const options = h.buttons().filter(isOption);
        if (options.length === 0) break;
        // A different card each time. A refusal leaves the row up — pressing
        // the same one four times refuses it four times and never reaches the
        // helper, which is what the first version of this loop did.
        await h.press(options[guard]);
        if (h.buttons().filter(isOption).length === 0) {
          accepted += 1;
          break;
        }
        // Still on the row: the press must have said why, and scored nothing.
        expect(h.text()).toMatch(/no single move gets from it to/);
        refusals += 1;
      }
      expect(h.koda.count("learning.answered"), "a route was scored as an answer").toBe(0);
      h.unmount();
    }

    expect(refusals, "not one wrong route was refused in twenty questions").toBeGreaterThan(0);
    expect(accepted, "no question ever accepted its helper").toBe(20);
  });
});

/* -------------------------------------------------------------------------- */
/* Wrong answers                                                               */
/* -------------------------------------------------------------------------- */

/**
 * §12 trap 13. If the choices can be reasoned over, the strategy can be skipped.
 */
describe("the wrong answers are the ones this strategy produces", () => {
  it("never offers the product nudged by one", () => {
    for (const mode of ALL_MODES) {
      for (let i = 0; i < 120; i += 1) {
        const question = buildQuestion({ mode }, i);
        expect(question.choices).toContain(question.product);
        expect(new Set(question.choices).size).toBe(4);
        for (const choice of question.choices) {
          expect(choice).toBeGreaterThan(0);
          if (choice !== question.product) {
            expect(
              Math.abs(choice - question.product),
              `${mode} offered ${choice} against ${question.product}`,
            ).not.toBe(1);
          }
        }
      }
    }
  });

  it("offers the helper's own product, because stopping there is the mistake", () => {
    let offered = 0;
    for (let i = 0; i < 200; i += 1) {
      const question = buildQuestion({ mode: "subtract_a_group" }, i);
      const stopShort = question.helpers[question.helpers.length - 1].product;
      if (question.choices.includes(stopShort)) offered += 1;
    }
    expect(offered, "the helper's product is never among the choices").toBeGreaterThan(0);
  });

  it("names the helper when a child stops at it", async () => {
    // Nine sixes, from ten sixes take one away. Answering 60 is the whole
    // strategy minus its last step, and deserves better than "not quite".
    const h = render("subtract_a_group", { drivers: [9], partnerRange: [6, 6] });
    expect(factOnScreen(h)).toEqual({ a: 9, b: 6 });
    await h.press("60");
    const [report] = h.koda.only("learning.answered").map((c) => c.args[0] as { correct: boolean });
    expect(report.correct).toBe(false);
    expect(h.text()).toMatch(/60 is 10 × 6/);
    expect(h.text()).toMatch(/take one 6 away/i);
    h.unmount();
  });

  it("explains the route on a right answer too", async () => {
    const h = render("subtract_a_group", { drivers: [9], partnerRange: [6, 6] });
    await h.press("54");
    expect(h.text()).toMatch(/10 × 6 = 60, so 9 × 6 = 54/);
    h.unmount();
  });
});

/**
 * Every switch has to reach every engine.
 *
 * `strategy_scaffold` means the doubling picture and the sticks of ten here,
 * where on the tray it means the repeated addition. A switch that reaches one
 * engine and stops is a dead control on the rest of the skill, and a features
 * suite driven through a single activity would never say so.
 */
describe("every feature reaches the fact deck", () => {
  it("strategy_scaffold controls the models behind the fact", async () => {
    const on = render("doubles", { partnerRange: [6, 6] });
    expect(on.screen.queryAllByRole("img", { name: /^\d+ groups of \d+$/ })).toHaveLength(1);
    on.unmount();
    const off = renderActivity(facts, {
      params: { mode: "doubles", partnerRange: [6, 6], questionsPerRound: 5 },
      features: { strategy_scaffold: false },
    });
    expect(off.screen.queryAllByRole("img", { name: /^\d+ groups of \d+$/ })).toHaveLength(0);
    off.unmount();
  });

  it("audio_speech controls the helper spoken on reveal, and the read-aloud button", async () => {
    const on = render("fives", { partnerRange: [8, 8] });
    await on.press(/^Turn over the helper card/);
    expect(on.koda.only("speech.say").map((c) => c.args[0])).toContain("10 times 8 is 80.");
    expect(on.buttons()).toContain("Read question aloud");
    on.unmount();

    const off = renderActivity(facts, {
      params: { mode: "fives", partnerRange: [8, 8], questionsPerRound: 5 },
      features: { audio_speech: false },
    });
    await off.press(/^Turn over the helper card/);
    expect(off.koda.count("speech.say")).toBe(0);
    // A control that speaks nothing must not be on screen at all.
    expect(off.buttons()).not.toContain("Read question aloud");
    off.unmount();
  });

  it("sound_chimes and haptic_feedback ride along with turning the card", async () => {
    const on = render("fives", { partnerRange: [8, 8] });
    await on.press(/^Turn over the helper card/);
    expect(on.koda.count("sound.play")).toBeGreaterThan(0);
    expect(on.koda.count("haptics.tap")).toBeGreaterThan(0);
    on.unmount();

    const off = renderActivity(facts, {
      params: { mode: "fives", partnerRange: [8, 8], questionsPerRound: 5 },
      features: { sound_chimes: false, haptic_feedback: false },
    });
    await off.press(/^Turn over the helper card/);
    expect(off.koda.count("sound.play")).toBe(0);
    expect(off.koda.count("haptics.tap")).toBe(0);
    off.unmount();
  });

  it("answerInput swaps the four choices for a pad", async () => {
    const pad = renderActivity(facts, {
      params: { mode: "fives", partnerRange: [8, 8], questionsPerRound: 5 },
      settings: { answerInput: "pad" },
    });
    expect(pad.buttons()).toContain("Digit 4");
    expect(pad.buttons().filter((l) => /^\d+$/.test(l)), "choice tiles were offered too").toHaveLength(0);
    pad.unmount();
  });
});

/**
 * Practice takes the scaffolding away, on this engine as on every other.
 */
describe("practice runs the same deck with nothing to lean on", () => {
  it("says nothing and offers no hints", async () => {
    const h = renderActivity(facts, {
      params: { practice: true, modes: ["doubles", "fives", "known_fact"], partnerRange: [4, 8], questionsPerRound: 3 },
    });
    expect(h.buttons()).not.toContain("Read question aloud");
    const options = h.buttons().filter((l) => /^Use \d+ times \d+$/.test(l));
    if (options.length > 0) await h.press(options[0]);
    expect(h.koda.count("speech.say"), "practice spoke").toBe(0);
    h.unmount();
  });

  it("cycles the modes it was given rather than sampling them", () => {
    const modes = ["doubles", "fives", "known_fact"];
    for (let i = 0; i < 9; i += 1) {
      const question = buildQuestion({ practice: true, modes, partnerRange: [4, 8] }, i);
      expect(question.mode).toBe(modes[i % modes.length]);
    }
  });
});

/* -------------------------------------------------------------------------- */
/* Worksheet                                                                   */
/* -------------------------------------------------------------------------- */

describe("the worksheet prints all ten modes", () => {
  it("prints a question that stands on its own, and its answer", () => {
    for (const mode of ALL_MODES) {
      for (let i = 0; i < 20; i += 1) {
        const question = buildQuestion({ mode }, i);
        const printed = facts.worksheet!.printed!(question);
        expect(printed, `${mode} prints nothing`).toBeTruthy();
        expect(printed!.text).toContain(`${question.a} × ${question.b}`);
        if (mode === "known_fact") {
          expect(printed!.answer).toContain(String(question.product));
        } else {
          expect(printed!.answer).toBe(String(question.product));
          // A derived fact prints its helper, because paper has no card to turn.
          if (question.helpers.length > 0) {
            expect(printed!.text).toContain(`${question.helpers[0].a} × ${question.helpers[0].b}`);
          }
        }
        expect(facts.worksheet!.method!(question)!.length).toBeGreaterThan(1);
        // Facts are already written arithmetic; there is nothing to draw.
        expect(facts.worksheet!.figure!(question)).toBeNull();
      }
    }
  });
});
