import { describe, expect, it } from "vitest";
import { describeActivitySmoke, expectStandardRound, renderActivity, type ActivityHarness } from "../kit/testing";
import { skill } from ".";
import { buildQuestion } from "./activities/NeighborLens";
import { neighbors, type Board } from "./internal/board";
import { tileLabel } from "./internal/BoardGrid";

describeActivitySmoke(skill);

const lens = skill.activities.neighbors;

/**
 * Driving the engine the way a child does: by what the buttons are called.
 *
 * The tests here press accessible names, which is also how a screen reader and
 * a keyboard reach them. Answers are computed from the question the engine
 * built, never read back out of the engine's own verdict — pressing whichever
 * button the engine calls correct would pass against an engine that judged
 * everything correct.
 */

/**
 * The boards a round will show, rebuilt exactly as the engine builds them.
 *
 * Including the `seen` set, which is not an optimisation: the engine skips a
 * question it has already asked, so a rebuild without it agrees only until the
 * first skip and then quietly describes a different board than the one on
 * screen.
 */
const roundOf = (params: Record<string, unknown>, count = 5) => {
  const seen = new Set<string>();
  return Array.from({ length: count }, (_, i) =>
    buildQuestion({ ...lens.defaultParams, ...params } as never, i, seen));
};
const questionAt = (params: Record<string, unknown>, index: number) => roundOf(params, index + 1)[index];

const pressTiles = async (h: ActivityHarness, board: Board, cells: readonly number[]) => {
  for (const cell of cells) await h.press(tileLabel(board, cell));
};

describe("select_neighbors: which tiles touch this one", () => {
  const params = { mode: "select_neighbors", anchors: ["center"], questionsPerRound: 3 };

  it("runs a whole round and scores it", async () => {
    const round = roundOf(params, 3);
    let n = 0;
    await expectStandardRound(
      lens,
      async (h) => {
        const q = round[n++];
        await pressTiles(h, q.board, q.expectedCells!);
        await h.press(new RegExp(`^Check \\(${q.expectedCells!.length}\\)$`));
      },
      { params, questions: 3 },
    );
  });

  it("counts a wrong set as wrong, and keeps the same question open", async () => {
    const h = renderActivity(lens, { params });
    const q = questionAt(params, 0);
    /* Everything but the corners: the misconception the level exists for. */
    const size = q.board.size;
    const orthogonal = q.expectedCells!.filter((cell) => {
      const [r, c] = [Math.floor(cell / size), cell % size];
      const [tr, tc] = [Math.floor(q.target / size), q.target % size];
      return r === tr || c === tc;
    });
    await pressTiles(h, q.board, orthogonal);
    await h.press(new RegExp(`^Check \\(${orthogonal.length}\\)$`));
    expect(h.koda.count("learning.answered")).toBe(1);
    expect(h.text()).toContain("the four corners");
    await h.press(/^(next|try again|continue)$/i);
    await h.settle();
    expect(h.koda.count("learning.present"), "a wrong answer re-asks, it does not move on").toBe(1);
    h.unmount();
  });

  it("refuses the outlined tile without scoring it", async () => {
    const h = renderActivity(lens, { params });
    const q = questionAt(params, 0);
    /* The outlined tile names itself as outlined, so a reader knows which one
       the question is about before touching anything. */
    await h.press(tileLabel(q.board, q.target, q.target));
    expect(h.text()).toContain("never touches itself");
    expect(h.koda.count("learning.answered"), "a refusal is not an answer").toBe(0);
    expect(h.koda.count("learning.supportUsed"), "nor is it a hint").toBe(0);
    h.unmount();
  });

  it("refuses an empty check without scoring it", async () => {
    const h = renderActivity(lens, { params });
    await h.press(/^Check$/);
    expect(h.koda.count("learning.answered")).toBe(0);
    expect(h.text()).toContain("touch the outlined one first");
    h.unmount();
  });

  it("lets a tile be taken back", async () => {
    const h = renderActivity(lens, { params });
    const q = questionAt(params, 0);
    const [first] = q.expectedCells!;
    const name = tileLabel(q.board, first);
    await h.press(name);
    await h.press(name);
    expect(h.text()).toContain("Check ");
    expect(h.text()).not.toContain("Check (1)");
    h.unmount();
  });
});

describe("count_same, read_clue and complement", () => {
  it("count_same: runs a round on the number buttons", async () => {
    const params = { mode: "count_same", anchors: ["center"], questionsPerRound: 3 };
    const round = roundOf(params, 3);
    let n = 0;
    await expectStandardRound(
      lens,
      async (h) => await h.press(String(round[n++].expectedCount)),
      { params, questions: 3 },
    );
  });

  it("complement: runs a round, and its answer is not the printed number", async () => {
    const params = { mode: "complement", anchors: ["center"], questionsPerRound: 3 };
    const round = roundOf(params, 3);
    let n = 0;
    await expectStandardRound(
      lens,
      async (h) => {
        const q = round[n++];
        // The trap this level is built around: answering with the clue's own
        // number. It is a different button from the right one unless the clue
        // is exactly half its neighbourhood.
        if (q.clue!.count !== q.expectedCount) expect(String(q.clue!.count)).not.toBe(String(q.expectedCount));
        await h.press(String(q.expectedCount));
      },
      { params, questions: 3 },
    );
  });

  it("read_clue: runs a round on the statement buttons", async () => {
    const params = { mode: "read_clue", anchors: ["center"], questionsPerRound: 3 };
    const round = roundOf(params, 3);
    let n = 0;
    await expectStandardRound(
      lens,
      async (h) => await h.press(round[n++].statements!.find((s) => s.correct)!.text),
      { params, questions: 3 },
    );
  });

  it("read_clue: names the misconception a wrong statement embodies", async () => {
    const params = { mode: "read_clue", anchors: ["center"] };
    for (const [trap, said] of [
      ["counts-itself", "never counts its own tile"],
      ["skips-diagonals", "corner-touching tiles count too"],
      ["wrong-color", "which colour the clue is counting"],
    ] as const) {
      const h = renderActivity(lens, { params });
      const q = questionAt(params, 0);
      await h.press(q.statements!.find((s) => s.trap === trap)!.text);
      expect(h.text(), trap).toContain(said);
      h.unmount();
    }
  });
});

describe("what every mode owes the round", () => {
  const modes = ["select_neighbors", "count_same", "read_clue", "complement"] as const;

  it.each(modes)("%s presents a prompt that states the whole question", (mode) => {
    for (let i = 0; i < 5; i += 1) {
      const q = questionAt({ mode }, i);
      expect(q.prompt!.length).toBeGreaterThan(20);
      expect(q.taskKind).toBe(`sweeper_${mode}`);
      expect(q.expected).toBeTruthy();
      expect(q.itemCount).toBe(neighbors(q.target, q.board.size).length);
    }
  });

  /*
   * The off-by-one that hit all five multiplication engines at once.
   *
   * `useSkillRound` counts questions from one and `buildQuestion` counts from
   * zero, so an engine that forwards the index unchanged silently skips its
   * first question and asks a sixth that no lesson designed.
   */
  it.each(modes)("%s asks its first question first", async (mode) => {
    const params = { mode, anchors: ["center"] };
    const h = renderActivity(lens, { params });
    const [shown] = h.koda.only("learning.present");
    expect((shown.args[0] as { prompt: string }).prompt).toBe(questionAt(params, 0).prompt);
    h.unmount();
  });

  it.each(modes)("%s prints a question that stands on its own", (mode) => {
    const q = questionAt({ mode }, 0);
    const printed = lens.worksheet!.printed!(q)!;
    expect(printed.text).toContain("____");
    expect(printed.answer.trim()).not.toBe("");
    // A printed question a child cannot answer from the paper is the failure
    // here: "Tap the tiles" tells a reader nothing about which tile.
    expect(printed.text).toMatch(/Row \d, column \d/);
  });
});
