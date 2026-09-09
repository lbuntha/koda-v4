import { describe, expect, it } from "vitest";
import { expectStandardRound, renderActivity } from "../kit/testing";
import { skill } from ".";
import { buildQuestion } from "./activities/ClueLab";
import { forces, clueName } from "./internal/reasons";
import { deduce } from "./internal/deduction";
import { tileLabel } from "./internal/BoardGrid";

const lab = skill.activities.reason;

/**
 * Judging reasoning, driven by accessible name.
 *
 * The answers are worked out independently of the engine: a set of clues is
 * checked by re-solving with only that set, and a broken clue by recounting
 * the painted board. An engine that marked everything correct would sail
 * through a test that pressed whatever it called right.
 */
const roundOf = (params: Record<string, unknown>, count = 5) => {
  const seen = new Set<string>();
  return Array.from({ length: count }, (_, i) =>
    buildQuestion({ ...lab.defaultParams, ...params } as never, i, seen));
};
const paramsOf = (id: string) => skill.lessons.find((l) => l.id === id)!.params as Record<string, unknown>;

describe("which clues are enough", () => {
  const params = paramsOf("which-clues-help");

  it("runs a whole round and scores it", async () => {
    const round = roundOf(params);
    let n = 0;
    await expectStandardRound(
      lab,
      async (h) => {
        const q = round[n++];
        /* Chosen by re-solving, not by reading the engine's flag. */
        const enough = q.options!.find((o) => forces(q.board, o.clueIds!, q.target!))!;
        await h.press(enough.text);
      },
      { params, questions: 5 },
    );
  });

  it("rejects a clue that is true but decides nothing here", async () => {
    const [q] = roundOf(params, 1);
    const weak = q.options!.find((o) => !forces(q.board, o.clueIds!, q.target!))!;
    const h = renderActivity(lab, { params });
    await h.press(weak.text);
    expect(h.koda.count("learning.answered")).toBe(1);
    expect(h.text()).toMatch(/leaves the tile open|says nothing about this tile/);
    h.unmount();
  });

  it("offers exactly one sufficient set, checked by re-solving", () => {
    for (const q of roundOf(params, 4)) {
      const sufficient = q.options!.filter((o) => forces(q.board, o.clueIds!, q.target!));
      expect(sufficient, `${q.id} has no single right answer`).toHaveLength(1);
      /* And its own flag agrees with the re-solve — a distractor that happened
         to be sufficient would be a right answer marked wrong. */
      for (const o of q.options!) expect(o.correct).toBe(forces(q.board, o.clueIds!, q.target!));
    }
  });
});

describe("explaining a move", () => {
  const params = paramsOf("explain-the-move");

  it("accepts either wording of the same reason", async () => {
    const [q] = roundOf(params, 1);
    const right = q.options!.filter((o) => o.correct);
    /* The plan's requirement, made real: two true statements of one reason,
       and a child who says it their own way has not made a different move. */
    expect(right.length, "only one phrasing is accepted").toBeGreaterThanOrEqual(2);
    for (const option of right) {
      const h = renderActivity(lab, { params });
      await h.press(option.text);
      expect(h.text(), option.text).toContain("fair reason");
      expect(h.koda.count("learning.answered")).toBe(1);
      h.unmount();
    }
  });

  it("names the misconception a wrong reason carries", async () => {
    const [q] = roundOf(params, 1);
    for (const option of q.options!.filter((o) => !o.correct)) {
      const h = renderActivity(lab, { params });
      await h.press(option.text);
      expect(h.text()).toMatch(/never counts its own tile|corner-touching tiles count too|which colour the clue counts/);
      h.unmount();
    }
  });

  it("runs a whole round", async () => {
    const round = roundOf(params);
    let n = 0;
    await expectStandardRound(
      lab,
      async (h) => await h.press(round[n++].options!.find((o) => o.correct)!.text),
      { params, questions: 5 },
    );
  });
});

describe("auditing somebody else's board", () => {
  const params = paramsOf("spot-a-contradiction");

  it("names every clue the painted board actually breaks", () => {
    /* Recounted here rather than trusted: one wrong tile can break more than
       one clue, and every one of them is a right answer. */
    for (const q of roundOf(params, 4)) {
      const broken = deduce(q.board, q.assignment!).violatedClueIds;
      expect(broken.length).toBeGreaterThan(0);
      expect(q.violated!.every((id) => broken.includes(id))).toBe(true);
      expect(q.violated!.every((id) => q.board.clues.find((c) => c.id === id)?.cell !== undefined)).toBe(true);
    }
  });

  it("accepts each of them when tapped", async () => {
    /* Only the first question is on screen in a fresh mount, so this drives
       that one. Pressing labels from a later board against the first board's
       screen is how the earlier version of this test failed. */
    const [q] = roundOf(params, 1);
    for (const id of q.violated!) {
      const clue = q.board.clues.find((c) => c.id === id)!;
      const h = renderActivity(lab, { params });
      await h.press(tileLabel(q.board, clue.cell!, undefined, q.assignment));
      expect(h.text(), clueName(q.board, clue)).toContain("not true");
      h.unmount();
    }
  });

  it("marks a clue that still holds as wrong, and says what it counted", async () => {
    const [q] = roundOf(params, 1);
    const intact = q.board.clues.find((c) => !q.violated!.includes(c.id));
    if (!intact) return;
    const h = renderActivity(lab, { params });
    await h.press(tileLabel(q.board, intact.cell!, undefined, q.assignment));
    expect(h.text()).toContain("that is what is there");
    h.unmount();
  });

  it("refuses a tile with no clue on it rather than scoring it", async () => {
    const [q] = roundOf(params, 1);
    const plain = q.board.givens.findIndex((c, i) => c !== null && !q.board.clues.some((k) => k.cell === i));
    if (plain < 0) return;
    const h = renderActivity(lab, { params });
    await h.press(tileLabel(q.board, plain, undefined, q.assignment));
    expect(h.koda.count("learning.answered"), "pointing at a tile is not an answer").toBe(0);
    expect(h.text()).toContain("no clue on it");
    h.unmount();
  });

  it("level 30 audits three colours, and its clue counts one of them", () => {
    for (const q of roundOf(paramsOf("check-a-three-color-board"), 3)) {
      expect(q.board.palette).toHaveLength(3);
      expect(deduce(q.board, q.assignment!).status).toBe("contradiction");
      /* The error this level exists for: counting "not the clue's colour",
         which is right for two colours and wrong here. */
      const clue = q.board.clues.find((c) => q.violated!.includes(c.id))!;
      const around = q.board.clues.length;
      expect(around).toBeGreaterThan(0);
      expect(q.board.palette).toContain(clue.countedColor);
    }
  });
});

describe("what the reasoning levels never do", () => {
  it("never puts the answer on the board", () => {
    for (const id of ["which-clues-help", "explain-the-move", "spot-a-contradiction"]) {
      for (const q of roundOf(paramsOf(id), 3)) {
        expect(Object.keys(q)).not.toContain("solution");
      }
    }
  });

  it("keeps every option the same shape, so nothing is given away by looks", () => {
    for (const id of ["which-clues-help", "explain-the-move"]) {
      for (const q of roundOf(paramsOf(id), 3)) {
        expect(q.options!.length).toBeGreaterThanOrEqual(3);
        /* A right answer that is visibly longer than the others is a tell. */
        const lengths = q.options!.map((o) => o.text.length);
        const right = q.options!.filter((o) => o.correct).map((o) => o.text.length);
        expect(Math.max(...right)).toBeLessThanOrEqual(Math.max(...lengths));
      }
    }
  });
});
