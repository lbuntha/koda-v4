import { describe, expect, it } from "vitest";
import { renderActivity, type ActivityHarness } from "../kit/testing";
import { skill } from ".";
import { orbitHints } from "./activities/TouchOrbit";
import { subitizeHints } from "./activities/SubitizingRush";
import { tenFrameHints } from "./activities/TenFrameRocket";
import { numberLineHints } from "./activities/FroggySkip";
import { base10Hints } from "./activities/Base10Foundry";

/**
 * The Hint button, and what is behind it.
 *
 * For most of this skill's life the answer was "nothing": every activity kept a
 * `showTip` boolean, toggled it on the button, logged `supportUsed("hint", 1)`
 * and rendered no hint anywhere. A child who asked for help got a highlighted
 * button and silence, and the log recorded that they had been helped.
 *
 * So these tests are in two halves. The first drives the button the way a stuck
 * child does and insists something readable comes back. The second checks the
 * words themselves against the question they describe — a hint that says "you
 * have touched 3" when four are tagged is worse than no hint, and only the copy
 * can be wrong in that way.
 */

const { orbit, subitize, tenframe, numberline, base10 } = skill.activities;

/** Every hint the child has been shown, in the order the rungs came. */
const hintRungs = (h: ActivityHarness): (number | undefined)[] =>
  h.koda
    .only("learning.supportUsed")
    .filter((call) => call.args[0] === "hint")
    .map((call) => call.args[1] as number | undefined);

/** The lesson each activity is normally mounted with, `play` copy and all. */
const lessonFor = (activityId: string) => {
  const lesson = skill.lessons.find((l) => l.activity === `counting/${activityId}`);
  const params = lesson?.params as Record<string, unknown>;
  return { params, level: (params?.level as number) ?? 1 };
};

describe("the hint button shows a hint", () => {
  const cases: [string, typeof orbit][] = [
    ["orbit", orbit],
    ["subitize", subitize],
    ["tenframe", tenframe],
    ["numberline", numberline],
    ["base10", base10],
  ];

  for (const [id, activity] of cases) {
    it(`${id}: opens with the lesson's own tip, and closes again`, async () => {
      const { params, level } = lessonFor(id);
      const h = renderActivity(activity, { params, level });
      const kidTip = (params.play as { kidTip?: string }).kidTip!;

      expect(h.text(), "the hint is not showing before it is asked for").not.toContain(kidTip);
      await h.press(/^Hint$/);
      expect(h.text(), "rung one is the lesson's own kidTip").toContain(kidTip);

      await h.press(/^Hide hint$/);
      expect(h.text()).not.toContain(kidTip);
      h.unmount();
    });

    it(`${id}: climbs to a question-specific rung and reports each one once`, async () => {
      const { params, level } = lessonFor(id);
      const h = renderActivity(activity, { params, level });

      await h.press(/^Hint$/);
      expect(hintRungs(h), "the gentlest rung is reported as level 1").toEqual([1]);
      expect(h.text()).toContain("Hint 1 of 3");

      await h.press(/^More help$/);
      expect(hintRungs(h), "climbing reports the rung it climbed to").toEqual([1, 2]);
      expect(h.text()).toContain("Hint 2 of 3");

      await h.press(/^More help$/);
      expect(hintRungs(h)).toEqual([1, 2, 3]);
      expect(h.text()).toContain("Hint 3 of 3");
      expect(h.buttons(), "the ladder ends rather than going dead").not.toContain("More help");

      // Closing and re-opening is not a second hint: it returns to the deepest
      // rung already read, and the log stays as it was.
      await h.press(/^Hide hint$/);
      await h.press(/^Hint$/);
      expect(h.text()).toContain("Hint 3 of 3");
      expect(hintRungs(h), "re-reading a hint is not taking another one").toEqual([1, 2, 3]);
      h.unmount();
    });
  }

  it("reads the hint aloud, because the child cannot read it", async () => {
    const { params, level } = lessonFor("orbit");
    const h = renderActivity(orbit, { params, level });
    const before = h.koda.count("speech.say");

    await h.press(/^Hint$/);
    const spoken = h.koda.only("speech.say").slice(before);
    expect(spoken.at(-1)?.args[0]).toBe((params.play as { kidTip: string }).kidTip);
    h.unmount();
  });

  it("says nothing aloud when the learner has speech turned off", async () => {
    const { params, level } = lessonFor("orbit");
    const h = renderActivity(orbit, { params, level, features: { audio_speech: false } });
    const before = h.koda.count("speech.say");

    await h.press(/^Hint$/);
    expect(h.text()).toContain((params.play as { kidTip: string }).kidTip);
    expect(h.koda.count("speech.say"), "shown, not spoken").toBe(before);
    h.unmount();
  });

  it("starts the next question at the bottom of the ladder", async () => {
    const h = renderActivity(numberline, {
      params: {
        ...lessonFor("numberline").params,
        mode: "hop",
        steps: [2],
        hopRange: [3, 3],
        settleMs: 0,
      },
      level: 10,
    });

    await h.press(/^Hint$/);
    await h.press(/^More help$/);
    expect(h.text()).toContain("Hint 2 of 3");

    // Hop to the last pad, which answers the question, then move on.
    for (let guard = 0; guard < 20; guard += 1) {
      if (!h.buttons().some((b) => /^Hop Forward/i.test(b))) break;
      await h.press(/^Hop Forward/i);
    }
    await h.settle();
    await h.press(/^next$/i);
    await h.settle();

    expect(h.text(), "the last question's hint does not follow the child").not.toContain("Hint 2 of 3");
    await h.press(/^Hint$/);
    expect(h.text()).toContain("Hint 1 of 3");
    h.unmount();
  });
});

/**
 * The wording, checked against the question it is about.
 *
 * Every builder is a pure function of the question and what the child has done
 * so far, which is the whole reason they are exported: the numbers inside a
 * hint are the part that can silently go wrong.
 */
describe("hint copy describes the question on screen", () => {
  const complete = (ladder: string[]) => {
    expect(ladder).toHaveLength(3);
    for (const rung of ladder) {
      expect(rung.length, `a hint this short says nothing: "${rung}"`).toBeGreaterThan(20);
      expect(rung.trim()).toBe(rung);
    }
  };

  it("orbit: counts a row from where the child has got to", () => {
    const question = {
      id: "q1",
      taskKind: "count_total",
      mode: "row" as const,
      count: 6,
      asset: { id: "counting-fish", name: "Fish", emoji: "🐟" },
    };
    const ladder = orbitHints(question as never, { tapped: 2, tappedA: 0, tappedB: 0 });
    complete(ladder);
    expect(ladder[1]).toContain("You have touched 2");
    expect(ladder[1], "the next number, not the one just said").toContain("3");
    expect(ladder[2]).toContain("6");
  });

  it("orbit: gives both counts to compare, and leaves the comparing to the child", () => {
    const question = {
      id: "q1",
      taskKind: "compare_groups",
      mode: "compare" as const,
      count: 5,
      asset: { id: "counting-fish", name: "Fish", emoji: "🐟" },
      compare: {
        countA: 7,
        countB: 5,
        assetA: { id: "counting-fish", name: "Fish", emoji: "🐟" },
        assetB: { id: "counting-leaf", name: "Leaves", emoji: "🍃" },
        layoutA: "cluster",
        layoutB: "line",
        answer: "A" as const,
      },
    };
    const ladder = orbitHints(question as never, { tapped: 0, tappedA: 0, tappedB: 0 });
    complete(ladder);
    expect(ladder[2]).toContain("left group has 7");
    expect(ladder[2]).toContain("right group has 5");
    expect(ladder[2], "the verdict is the question, so a hint must not give it").not.toMatch(
      /left has more|the left group wins/i,
    );
  });

  it("subitize: describes the set that was actually flashed", () => {
    const twoColor = subitizeHints(
      {
        id: "q1",
        taskKind: "subitize_set",
        total: 7,
        parts: { a: 3, b: 4, colors: { colorA: "bg-sky-400", colorB: "bg-rose-400" } },
      } as never,
      { seen: true },
    );
    complete(twoColor);
    expect(twoColor[2]).toContain("3 of one colour and 4 of the other");
    expect(twoColor[2], "the total is what is being asked for").not.toContain("7 in all");

    // The scatter rung reports the split the child actually saw, left to right.
    const scatter = subitizeHints(
      {
        id: "q2",
        taskKind: "subitize_set",
        total: 5,
        points: [{ x: 20, y: 30 }, { x: 30, y: 60 }, { x: 70, y: 20 }, { x: 80, y: 50 }, { x: 90, y: 70 }],
      } as never,
      { seen: true },
    );
    complete(scatter);
    expect(scatter[2]).toContain("2 on the left side and 3 on the right");
  });

  it("tenframe: reads the frame as the child has built it", () => {
    const fill = tenFrameHints(
      { id: "q1", taskKind: "tenframe_fill", mode: "fill", target: 8 } as never,
      { filled: 5 },
    );
    complete(fill);
    expect(fill[1]).toContain("full top row of 5 and 3 more");
    expect(fill[2]).toContain("Tap 3 more");

    const over = tenFrameHints(
      { id: "q1", taskKind: "tenframe_fill", mode: "fill", target: 6 } as never,
      { filled: 9 },
    );
    expect(over[2]).toContain("Tap 3 of them off again");

    const complement = tenFrameHints(
      { id: "q2", taskKind: "tenframe_complement", mode: "complement", target: 6, initial: 4 } as never,
      { filled: 0 },
    );
    complete(complement);
    expect(complement[2]).toContain("6 of them");

    const teen = tenFrameHints(
      { id: "q3", taskKind: "tenframe_teen", mode: "teen", target: 14 } as never,
      { filled: 2 },
    );
    complete(teen);
    expect(teen[1]).toContain("10 and 4 more");
    expect(teen[2]).toContain("tap 2 more");
  });

  it("numberline: uses the step this line actually takes", () => {
    const hop = numberLineHints(
      { id: "q1", taskKind: "numberline_hop", mode: "hop", step: 5, pads: [0, 5, 10, 15, 20] } as never,
      { hop: 2 },
    );
    complete(hop);
    expect(hop[1]).toContain("10 + 5 = 15");
    expect(hop[2]).toContain("0, 5, 10, 15, 20");

    // Half the sequences run backwards, and a hint that assumes counting up
    // would teach a child to distrust the line in front of them.
    const down = numberLineHints(
      {
        id: "q2",
        taskKind: "numberline_missing",
        mode: "missing",
        step: 3,
        sequence: [30, 27, null, 21, 18],
        answer: 24,
      } as never,
      { hop: 0 },
    );
    complete(down);
    expect(down[1]).toContain("down by 3");
    expect(down[2]).toContain("straight after 27");
    expect(down[2], "naming the answer would answer the question").not.toContain("24");
  });

  it("base10: names the move that place value actually requires next", () => {
    const question = { id: "q1", taskKind: "place_value_build", target: 23 } as never;

    const start = base10Hints(question, {
      built: { hundreds: 0, tens: 0, ones: 0 },
      setup: { bundleOnes: true },
    });
    complete(start);
    expect(start[1]).toContain("2 tens and 3 ones");
    expect(start[2]).toContain("Drag in 2 tens and 3 ones");

    // Ten loose ones is the case `check` refuses, so it is the case the hint
    // has to name — telling this child to add more blocks sends them backwards.
    const loose = base10Hints(question, {
      built: { hundreds: 0, tens: 1, ones: 13 },
      setup: { bundleOnes: true },
    });
    expect(loose[2]).toContain('"Make a Ten"');

    const done = base10Hints(question, {
      built: { hundreds: 0, tens: 2, ones: 3 },
      setup: { bundleOnes: true },
    });
    expect(done[2]).toContain("Press Check");
  });

  it("every teaching lesson writes the first rung itself", () => {
    // Rung one is the lesson's own words, so a lesson with no `kidTip` quietly
    // hands the child the activity's generic fallback instead of the strategy
    // this lesson is teaching.
    //
    // Practice is the exception, and deliberately so: it shows no hints at all,
    // so there is no rung one for it to write. A `kidTip` there would be copy
    // nothing can ever display.
    for (const lesson of skill.lessons) {
      const play = (lesson.params as { play?: { kidTip?: string; mode?: string } } | undefined)?.play;
      if (play?.mode === "practice") continue;
      expect(play?.kidTip?.trim(), `${lesson.id} has no kidTip`).toBeTruthy();
    }
  });

  it("practice lessons show no hints, so they author none", () => {
    const practices = skill.lessons.filter((l) => l.id.startsWith("practice-"));
    expect(practices.length).toBeGreaterThan(0);
    for (const lesson of practices) {
      const params = lesson.params as { question: { practice?: boolean }; play: { kidTip: string } };
      expect(params.question.practice, `${lesson.id} is not marked as practice`).toBe(true);
      expect(params.play.kidTip).toBe("");
      // Open from the start: a child who already knows the technique should not
      // have to sit through the lesson to reach the questions.
      expect(lesson.requires ?? []).toEqual([]);
    }
  });
});
