import { describe, expect, it } from "vitest";
import { expectStandardRound, renderActivity, type ActivityHarness } from "../kit/testing";
import { skill } from ".";

/**
 * Counting's behaviour tests — the pattern a new skill copies.
 *
 * The kit drives the round; a skill supplies one small function per activity
 * saying how a child answers correctly. That division is the whole design: only
 * the skill knows what its buttons mean, and only the kit knows what a correct
 * round must report to the host.
 *
 * Answers are read back out of the telemetry rather than recomputed here. The
 * activity already tells the host what it expected via `learning.present`, so a
 * test that reads it cannot drift from the activity's own idea of the answer —
 * and a missing `expected` fails the test instead of passing quietly.
 */

const { orbit, subitize, tenframe, numberline, base10 } = skill.activities;

/** What the activity told the host the current answer is. */
const expected = (h: ActivityHarness): string => {
  const last = h.koda.only("learning.present").at(-1);
  const question = last?.args[0] as { expected?: string } | undefined;
  expect(question?.expected, "activity presented a question with no expected answer").toBeTruthy();
  return String(question!.expected);
};

/** How many things are on screen to be counted. */
const itemCount = (h: ActivityHarness): number => {
  const last = h.koda.only("learning.present").at(-1);
  const question = last?.args[0] as { itemCount?: number } | undefined;
  expect(question?.itemCount, "activity presented a question with no itemCount").toBeTypeOf("number");
  return question!.itemCount!;
};

/**
 * Tap every object in the play area, which is how counting is answered.
 *
 * Objects are labelled by what they are — "rocket 3", not "Object 3" — so the
 * position is matched rather than the noun, which changes per question.
 */
const tapEveryObject = async (h: ActivityHarness) => {
  for (let i = 1; i <= itemCount(h); i += 1) {
    await h.press(new RegExp(`^[a-z]+ ${i}\\b`, "i"));
  }
  // The activity normally holds after the last tap, so the final number is
  // spoken and seen before the round reacts. These tests set `settleMs: 0` —
  // the hold is display timing, and waiting a real second per question just to
  // watch an animation nothing here asserts on is a slow suite for no cover.
  await h.settle();
};

describe("counting activities play a standard round", () => {
  it("orbit: tapping every object counts it", async () => {
    await expectStandardRound(orbit, tapEveryObject, {
      params: { mode: "row", countRange: [4, 4], settleMs: 0 },
    });
  });

  it("orbit: comparing two groups", async () => {
    await expectStandardRound(
      orbit,
      async (h) => {
        // "SAME" | "A" | "B" — the activity names the winning side.
        const answer = expected(h);
        const label =
          answer === "SAME" ? /^Same!$/ : answer === "A" ? /^Left has more$/ : /^Right has more$/;
        await h.press(label);
      },
      { params: { mode: "compare", countRange: [3, 6] }, level: 3 },
    );
  });

  it("subitize: flash, then say how many", async () => {
    await expectStandardRound(
      subitize,
      async (h) => {
        await h.press(/^Show me$/);
        await h.settle(); // the tiles stay dead until the flash ends
        await h.press(new RegExp(`^${expected(h)}$`));
      },
      { params: { display: "grid", countRange: [3, 5], flashMs: 1 }, level: 4 },
    );
  });

  it("tenframe: filling the frame to a target", async () => {
    await expectStandardRound(
      tenframe,
      async (h) => {
        for (let i = 1; i <= Number(expected(h)); i += 1) {
          await h.press(new RegExp(`^Space ${i}\\b`));
        }
        await h.press(/^Check$/i);
      },
      { params: { mode: "fill", targetRange: [6, 6] }, level: 7 },
    );
  });

  it("numberline: hopping to the target", async () => {
    await expectStandardRound(
      numberline,
      async (h) => {
        // Hop until the frog arrives; the button disables itself at the target.
        for (let guard = 0; guard < 20; guard += 1) {
          if (!h.buttons().some((b) => /^Hop Forward/i.test(b))) break;
          await h.press(/^Hop Forward/i);
        }
        // The last hop holds while its number is said, the same as a count
        // does; `settleMs: 0` below skips the wait for the same reason.
        await h.settle();
      },
      { params: { mode: "hop", steps: [2], hopRange: [3, 3], settleMs: 0 }, level: 10 },
    );
  });

  it("base10: building a number out of tens and ones", async () => {
    await expectStandardRound(
      base10,
      async (h) => {
        const target = Number(expected(h));
        // Tapping a supply block adds one, the same as the + button — the path a
        // child on a keyboard uses, and the only one a DOM without layout can
        // drive. The drag rule itself is covered in Base10Foundry.test.ts.
        for (let i = 0; i < Math.floor(target / 10); i += 1) await h.press(/^Add one ten rod$/);
        for (let i = 0; i < target % 10; i += 1) await h.press(/^Add one one cube$/);
        await h.press(/^Check$/);
      },
      { params: { targetRange: [23, 23], bundleOnes: true }, level: 13 },
    );
  });
});

describe("counting activities report a wrong answer", () => {
  /** Any number tile that is not the right answer. Read off the screen rather
   *  than guessed, so the test cannot pick a tile the activity never offered. */
  const aWrongTile = (h: ActivityHarness, right: string): string => {
    const wrong = h.buttons().find((b) => /^\d+$/.test(b) && b !== right);
    expect(wrong, "activity offered no wrong answer to choose").toBeTruthy();
    return wrong!;
  };

  it("keeps the same question and asks the child to try again", async () => {
    const h = renderActivity(subitize, {
      params: { display: "grid", countRange: [3, 6], flashMs: 1, questionsPerRound: 5 },
      level: 4,
    });

    await h.press(/^Show me$/);
    await h.settle();
    const questionId = (h.koda.only("learning.present").at(-1)!.args[0] as { questionId: string })
      .questionId;
    await h.press(new RegExp(`^${aWrongTile(h, expected(h))}$`));

    const answered = h.koda.only("learning.answered").at(-1)!.args[0] as {
      correct: boolean;
      questionId: string;
    };
    expect(answered.correct, "a wrong answer is reported as wrong").toBe(false);
    expect(answered.questionId, "reported against the question that was asked").toBe(questionId);
    expect(h.buttons(), "the child is offered another go, not the next question").toContain(
      "Try again",
    );

    // The round does not move on, and nothing is scored yet.
    expect(h.koda.count("learning.completeLesson")).toBe(0);
    expect(h.results).toHaveLength(0);
    h.unmount();
  });

  it("scores a round with one miss below three stars", async () => {
    const h = renderActivity(subitize, {
      params: { display: "grid", countRange: [3, 6], flashMs: 1, questionsPerRound: 2 },
      level: 4,
    });

    // Question 1: wrong once, then right.
    await h.press(/^Show me$/);
    await h.settle();
    const right = expected(h);
    await h.press(new RegExp(`^${aWrongTile(h, right)}$`));
    await h.press(/^Try again$/);
    await h.press(new RegExp(`^${right}$`));
    await h.press(/^Next$/);
    await h.settle();

    // Question 2: clean.
    await h.press(/^Show me$/);
    await h.settle();
    await h.press(new RegExp(`^${expected(h)}$`));
    await h.press(/^Next$/);
    await h.settle();

    expect(h.results).toHaveLength(1);
    expect(h.results[0].stars, "one miss out of two is not a clean round").toBeLessThan(3);
    expect(h.results[0].accuracy).toBeCloseTo(0.5);
    h.unmount();
  });
});

/**
 * The last number of a count is the answer, so it has to be *heard*.
 *
 * The round used to wait a flat 900ms after the final tap and then submit,
 * which starts the praise clip — and a clip starts by stopping whatever is
 * speaking. On a phone a number word can take a few hundred milliseconds just
 * to begin, so the guess ran out first and the final number was cut off before
 * any of it came out: the child tapped the last rocket and got congratulated
 * instead of being told the total.
 */
describe("counting waits for the last number to be said", () => {
  const tapAll = async (h: ActivityHarness, count: number) => {
    for (let i = 1; i <= count; i += 1) await h.press(new RegExp(`^[a-z]+ ${i}\\b`, "i"));
  };

  it("orbit: does not submit while the final number is still playing", async () => {
    const h = renderActivity(orbit, {
      params: { mode: "row", countRange: [4, 4], questionsPerRound: 1 },
      holdSpeech: true,
    });

    await tapAll(h, 4);
    // Well past the old fixed hold, and the word has not finished.
    await h.settle(1400);
    expect(h.koda.count("learning.answered"), "submitted mid-word").toBe(0);

    h.koda.finishSpeaking();
    await h.settle(50);
    expect(h.koda.count("learning.answered"), "submitted once the word ended").toBe(1);
  });

  it("orbit: a word that never ends still lets the round move on", async () => {
    const h = renderActivity(orbit, {
      params: { mode: "row", countRange: [4, 4], questionsPerRound: 1 },
      holdSpeech: true,
    });

    await tapAll(h, 4);
    // Blocked autoplay, a clip that will not load: silence must not strand the
    // child on a finished scene.
    await h.settle(2800);
    expect(h.koda.count("learning.answered")).toBe(1);
  });

  /*
   * The number line had the same bug and it was worse there: the frog's last
   * hop *is* the skip count — "5, 10, 15, 20" — and the praise clip landed on
   * top of the final number every time, so the one number the lesson is named
   * after was the only one never heard.
   */
  it("numberline: does not congratulate over the last hop's number", async () => {
    const h = renderActivity(numberline, {
      params: { mode: "hop", steps: [5], hopRange: [3, 3], questionsPerRound: 1 },
      holdSpeech: true,
    });

    for (let i = 0; i < 3; i += 1) await h.press(/^Hop Forward/i);
    await h.settle(1400);
    expect(h.koda.count("learning.answered"), "congratulated over the last number").toBe(0);

    h.koda.finishSpeaking();
    await h.settle(50);
    expect(h.koda.count("learning.answered"), "submitted once the number ended").toBe(1);
  });

  it("numberline: a number that never ends still lets the round move on", async () => {
    const h = renderActivity(numberline, {
      params: { mode: "hop", steps: [5], hopRange: [3, 3], questionsPerRound: 1 },
      holdSpeech: true,
    });

    for (let i = 0; i < 3; i += 1) await h.press(/^Hop Forward/i);
    await h.settle(2800);
    expect(h.koda.count("learning.answered")).toBe(1);
  });
});
