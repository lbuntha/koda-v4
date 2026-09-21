import { describe, expect, it } from "vitest";
import { skill } from ".";
import { orbitHints } from "./activities/TouchOrbit";
import { subitizeHints } from "./activities/SubitizingRush";
import { tenFrameHints } from "./activities/TenFrameRocket";
import { numberLineHints } from "./activities/FroggySkip";
import { base10Hints } from "./activities/Base10Foundry";

/**
 * The ladder, and the promise that it stays simple.
 *
 * There is one ladder in this skill now. The Hint button and the coach show the
 * same three rungs, so these words are every word of help a child ever meets —
 * which makes their quality a property of the skill rather than of one panel.
 *
 * Two things are checked, and the first is the one that decays. **Simplicity is
 * a contract, not an intention:** fifteen lessons across five engines will drift
 * into fifteen voices unless something objects, and a rung that has grown into a
 * paragraph is exactly what a stuck five-year-old stops reading. So the shape is
 * asserted for every engine, in every mode, rather than admired in a style
 * guide.
 *
 * The second is that the numbers inside a rung match the question it describes.
 * A hint saying "you have touched 3" while four are tagged is worse than no hint
 * at all, and only the copy can be wrong in that way.
 */

/**
 * How long a rung may be.
 *
 * Sixteen words is about a breath, and about what a child will hear before they
 * go back to the screen. Anything longer is not a sentence a five-year-old is
 * read to from — it is a paragraph, and it belongs behind the bubble's Next
 * button as a page of the lesson's method, not in front of them at the moment
 * they are stuck.
 */
const MAX_WORDS = 16;

const words = (rung: string) => rung.trim().split(/\s+/).length;

/** The shape every ladder in this skill holds to, whatever it is teaching. */
const simple = (ladder: string[], where: string) => {
  expect(ladder, `${where}: three rungs — say it, show it, walk it`).toHaveLength(3);
  for (const [i, rung] of ladder.entries()) {
    expect(rung.trim(), `${where} rung ${i + 1} has loose whitespace`).toBe(rung);
    expect(rung.length, `${where} rung ${i + 1} says nothing: "${rung}"`).toBeGreaterThan(15);
    expect(
      words(rung),
      `${where} rung ${i + 1} is ${words(rung)} words — a paragraph, not a nudge: "${rung}"`,
    ).toBeLessThanOrEqual(MAX_WORDS);
  }
};

describe("every rung is short enough to be read to a five-year-old", () => {
  it("orbit: a row, a scatter and a comparison", () => {
    const asset = { id: "counting-fish", name: "Fish", emoji: "🐟" };
    const row = { id: "q", taskKind: "t", mode: "row" as const, count: 6, asset };
    for (const tapped of [0, 2, 5]) {
      simple(orbitHints(row as never, { tapped, tappedA: 0, tappedB: 0 }), `row@${tapped}`);
    }

    const scatter = { ...row, mode: "scatter" as const, count: 8 };
    for (const tapped of [0, 3, 7]) {
      simple(orbitHints(scatter as never, { tapped, tappedA: 0, tappedB: 0 }), `scatter@${tapped}`);
    }

    const compare = {
      ...row,
      mode: "compare" as const,
      compare: {
        countA: 7,
        countB: 5,
        assetA: asset,
        assetB: asset,
        layoutA: "line",
        layoutB: "cluster",
        answer: "A",
      },
    };
    for (const [a, b] of [[0, 0], [3, 2]]) {
      simple(orbitHints(compare as never, { tapped: 0, tappedA: a, tappedB: b }), `compare@${a}/${b}`);
    }
  });

  it("tenframe: filling, making ten and teens", () => {
    for (const target of [3, 7, 9]) {
      for (const filled of [0, target - 1, target, target + 1]) {
        simple(
          tenFrameHints({ id: "q", taskKind: "t", mode: "fill", target } as never, { filled }),
          `fill ${target}@${filled}`,
        );
      }
    }
    for (const initial of [2, 6, 8]) {
      simple(
        tenFrameHints({ id: "q", taskKind: "t", mode: "complement", target: 10, initial } as never, {
          filled: 0,
        }),
        `complement@${initial}`,
      );
    }
    for (const target of [11, 15, 19]) {
      for (const filled of [0, target - 10, target - 9]) {
        simple(
          tenFrameHints({ id: "q", taskKind: "t", mode: "teen", target } as never, { filled }),
          `teen ${target}@${filled}`,
        );
      }
    }
  });

  it("numberline: hopping, and the missing step", () => {
    const pads = [0, 5, 10, 15, 20];
    for (const hop of [0, 2, 4]) {
      simple(
        numberLineHints({ id: "q", taskKind: "t", mode: "hop", step: 5, pads } as never, { hop }),
        `hop@${hop}`,
      );
    }
    for (const sequence of [[3, 6, null, 12], [30, 27, null, 21], [null, 8, 10, 12]]) {
      simple(
        numberLineHints({ id: "q", taskKind: "t", mode: "missing", step: 3, sequence } as never, {
          hop: 0,
        }),
        `missing ${sequence.join(",")}`,
      );
    }
  });

  it("base10: building, bundling and overshooting", () => {
    const setup = { bundleOnes: true, bundleTens: true, hundreds: true };
    const states = [
      { hundreds: 0, tens: 0, ones: 0 },
      { hundreds: 1, tens: 2, ones: 3 },
      { hundreds: 0, tens: 0, ones: 12 },
      { hundreds: 0, tens: 11, ones: 0 },
      { hundreds: 2, tens: 9, ones: 9 },
    ];
    for (const built of states) {
      simple(
        base10Hints({ id: "q", taskKind: "t", target: 123 } as never, { built, setup }),
        `base10 ${JSON.stringify(built)}`,
      );
    }
  });

  it("subitize: a dice pattern, a scatter and two colours", () => {
    for (const seen of [false, true]) {
      simple(
        subitizeHints({ id: "q", taskKind: "t", total: 7 } as never, { seen }),
        `grid seen=${seen}`,
      );
      simple(
        subitizeHints(
          {
            id: "q",
            taskKind: "t",
            total: 5,
            points: [
              { x: 20, y: 20 },
              { x: 30, y: 60 },
              { x: 70, y: 30 },
              { x: 80, y: 70 },
              { x: 60, y: 50 },
            ],
          } as never,
          { seen },
        ),
        `scatter seen=${seen}`,
      );
      simple(
        subitizeHints(
          { id: "q", taskKind: "t", total: 7, parts: { a: 3, b: 4, colors: {} } } as never,
          { seen },
        ),
        `parts seen=${seen}`,
      );
    }
  });
});

describe("a rung describes the question actually on screen", () => {
  it("orbit: counts a row from where the child has got to", () => {
    const question = {
      id: "q1",
      taskKind: "count_total",
      mode: "row" as const,
      count: 6,
      asset: { id: "counting-fish", name: "Fish", emoji: "🐟" },
    };
    const ladder = orbitHints(question as never, { tapped: 2, tappedA: 0, tappedB: 0 });
    expect(ladder[1]).toContain("You have counted 2");
    expect(ladder[1], "the next number, not the one just said").toContain("three");
    expect(ladder[2]).toContain("6");
  });

  it("orbit: gives both counts to compare, and leaves the comparing to the child", () => {
    const question = {
      id: "q1",
      taskKind: "compare_groups",
      mode: "compare" as const,
      count: 7,
      asset: { id: "counting-fish", name: "Fish", emoji: "🐟" },
      compare: {
        countA: 7,
        countB: 5,
        assetA: { id: "counting-fish", name: "Fish", emoji: "🐟" },
        assetB: { id: "counting-sun", name: "Suns", emoji: "☀️" },
        layoutA: "line",
        layoutB: "cluster",
        answer: "A",
      },
    };
    const ladder = orbitHints(question as never, { tapped: 0, tappedA: 0, tappedB: 0 });
    expect(ladder[2]).toContain("Left has 7");
    expect(ladder[2]).toContain("Right has 5");
    // The verdict is the question. A rung that gave it would leave nothing to answer.
    expect(ladder[2], "the comparing is the child's job").not.toMatch(/left has more|bigger group/i);
  });

  it("tenframe: reads the frame as the child has built it", () => {
    const fill = tenFrameHints({ id: "q", taskKind: "t", mode: "fill", target: 8 } as never, {
      filled: 5,
    });
    expect(fill[1]).toContain("full top row of 5");
    expect(fill[2]).toContain("Tap 3 more");

    const over = tenFrameHints({ id: "q", taskKind: "t", mode: "fill", target: 6 } as never, {
      filled: 9,
    });
    expect(over[2]).toContain("Tap 3 off");

    const teen = tenFrameHints({ id: "q", taskKind: "t", mode: "teen", target: 14 } as never, {
      filled: 2,
    });
    expect(teen[1]).toContain("10 and 4 more");
    expect(teen[2]).toContain("Tap 2 more");
  });

  it("tenframe: making ten counts the gaps without naming the answer", () => {
    const complement = tenFrameHints(
      { id: "q", taskKind: "t", mode: "complement", target: 10, initial: 4 } as never,
      { filled: 0 },
    );
    expect(complement[1]).toContain("4 boxes are full");
    // The child answers by choosing a number, so no rung may say which.
    for (const rung of complement) {
      expect(rung, "the number of empty boxes is the answer").not.toMatch(/\b6\b/);
    }
  });

  it("numberline: uses the step this line actually takes", () => {
    const hop = numberLineHints(
      { id: "q", taskKind: "t", mode: "hop", step: 5, pads: [0, 5, 10, 15, 20] } as never,
      { hop: 2 },
    );
    expect(hop[1]).toContain("10 + 5 is 15");
    expect(hop[2]).toContain("0, 5, 10, 15, 20");

    const down = numberLineHints(
      { id: "q", taskKind: "t", mode: "missing", step: 3, sequence: [33, 30, 27, null, 21] } as never,
      { hop: 0 },
    );
    expect(down[1]).toContain("down by 3");
    expect(down[2]).toContain("27");
    expect(down[2], "naming the answer would answer the question").not.toContain("24");
  });

  it("base10: names the move that place value actually requires next", () => {
    const setup = { bundleOnes: true, bundleTens: false, hundreds: false };
    const start = base10Hints({ id: "q", taskKind: "t", target: 23 } as never, {
      built: { hundreds: 0, tens: 0, ones: 0 },
      setup,
    });
    expect(start[1]).toContain("2 tens and 3 ones");
    expect(start[2]).toContain("Drag in 2 tens and 3 ones");

    // Bundling wins over adding: `check` refuses ten loose ones, so a rung that
    // said "drag in more" would send the child further from the answer.
    const loose = base10Hints({ id: "q", taskKind: "t", target: 23 } as never, {
      built: { hundreds: 0, tens: 1, ones: 12 },
      setup,
    });
    expect(loose[2]).toContain('"Make a Ten"');

    const done = base10Hints({ id: "q", taskKind: "t", target: 23 } as never, {
      built: { hundreds: 0, tens: 2, ones: 3 },
      setup,
    });
    expect(done[2]).toContain("Press Check");
  });
});

describe("the lessons hold up their end", () => {
  it("every teaching lesson writes the first rung itself", () => {
    const teaching = skill.lessons.filter(
      (l) => !(l.params as { question?: { practice?: boolean } }).question?.practice,
    );
    expect(teaching.length).toBe(15);
    for (const lesson of teaching) {
      const play = (lesson.params as { play?: { kidTip?: string } }).play;
      expect(play?.kidTip?.trim(), `${lesson.id} has no kidTip`).toBeTruthy();
      expect(
        words(play!.kidTip!),
        `${lesson.id}'s kidTip is too long to be the gentlest rung`,
      ).toBeLessThanOrEqual(MAX_WORDS);
    }
  });

  it("every teaching lesson asks for the coach, and no practice lesson does", () => {
    for (const lesson of skill.lessons) {
      const params = lesson.params as {
        guide?: { enabled?: boolean };
        question?: { practice?: boolean };
      };
      if (params.question?.practice) {
        expect(params.guide, `${lesson.id} is practice and must not be coached`).toBeUndefined();
      } else {
        expect(params.guide?.enabled, `${lesson.id} has no coach`).toBe(true);
      }
    }
  });

  it("practice lessons show no help, so they author none", () => {
    const practices = skill.lessons.filter(
      (l) => (l.params as { question?: { practice?: boolean } }).question?.practice,
    );
    expect(practices).toHaveLength(5);
    for (const lesson of practices) {
      const params = lesson.params as { play: { kidTip: string } };
      expect(params.play.kidTip).toBe("");
      expect(lesson.requires ?? []).toEqual([]);
    }
  });
});
