import { describe, expect, it } from "vitest";
import { expectStandardRound, renderActivity, type ActivityHarness } from "../kit/testing";
import { skill } from ".";
import { buildQuestion, nextStep } from "./activities/SweeperBoard";
import { chipText, tileLabel } from "./internal/BoardGrid";
import { deduce } from "./internal/deduction";
import { enumerateSolutions } from "./internal/validation";
import { PALETTE } from "./internal/palette";
import { governed, scopeOf, type Color } from "./internal/board";

const board = skill.activities.board;

/**
 * Painting a board, driven by accessible name.
 *
 * The answers here are worked out independently — by asking the validator to
 * enumerate the board's solutions — rather than by reading the engine's own
 * key. An engine that graded everything correct would pass a test that pressed
 * whatever it called right.
 */
const roundOf = (params: Record<string, unknown>, count = 3) => {
  const seen = new Set<string>();
  return Array.from({ length: count }, (_, i) =>
    buildQuestion({ ...board.defaultParams, ...params } as never, i, seen));
};

/** The one colouring that satisfies every clue, found without the engine's help. */
const solutionOf = (q: ReturnType<typeof buildQuestion>): Color[] => {
  const found = enumerateSolutions(q.board);
  expect(found.status, "a lesson board must have exactly one answer").toBe("unique");
  return found.solutions[0];
};

const paint = async (h: ActivityHarness, q: ReturnType<typeof buildQuestion>, answer: Color[]) => {
  for (const cell of q.blanks) {
    await h.press(PALETTE[answer[cell]].name);
    await h.press(tileLabel(q.board, cell, undefined, q.board.givens));
  }
};

describe("colouring a board", () => {
  const params = { mode: "zero", anchors: ["center", "edge", "corner"], questionsPerRound: 3 };

  it("runs a whole round and scores it", async () => {
    const round = roundOf(params);
    let n = 0;
    await expectStandardRound(
      board,
      async (h) => {
        const q = round[n++];
        await paint(h, q, solutionOf(q));
        await h.press(/^Check$/);
      },
      { params, questions: 3 },
    );
  });

  it("refuses an unfinished board instead of marking it wrong", async () => {
    const [q] = roundOf(params, 1);
    const h = renderActivity(board, { params });
    await h.press(PALETTE[q.board.palette[0]].name);
    await h.press(tileLabel(q.board, q.blanks[0], undefined, q.board.givens));
    await h.press(/^Check/);
    expect(h.koda.count("learning.answered"), "an unfinished board is not an answer").toBe(0);
    expect(h.text()).toMatch(/still to colour/);
    h.unmount();
  });

  it("offers no way to repaint a fixed clue", async () => {
    /* A clue is the puzzle's own evidence. It is not a button that refuses —
       it is not a button, so there is nothing to press and nothing to undo. */
    const [q] = roundOf(params, 1);
    const clue = q.board.clues[0];
    const h = renderActivity(board, { params });
    const name = tileLabel(q.board, clue.cell, undefined, q.board.givens);
    expect(h.buttons(), "a clue tile is pressable").not.toContain(name);
    expect(h.screen.getByRole("img", { name })).toBeTruthy();
    for (const cell of q.blanks) {
      expect(h.buttons(), "a blank tile is not pressable").toContain(
        tileLabel(q.board, cell, undefined, q.board.givens),
      );
    }
    h.unmount();
  });

  it("scores a completed board once, not once per tile", async () => {
    const [q] = roundOf(params, 1);
    const h = renderActivity(board, { params });
    await paint(h, q, solutionOf(q));
    expect(h.koda.count("learning.answered"), "painting is not answering").toBe(0);
    await h.press(/^Check$/);
    expect(h.koda.count("learning.answered")).toBe(1);
    expect(h.text()).toContain("Every clue is true");
    h.unmount();
  });

  it("marks a wrong colouring wrong, and names a clue it breaks", async () => {
    const [q] = roundOf(params, 1);
    const answer = solutionOf(q);
    const wrong = [...answer];
    const flip = q.blanks[0];
    wrong[flip] = q.board.palette.find((c) => c !== answer[flip])!;
    const h = renderActivity(board, { params });
    await paint(h, q, wrong);
    await h.press(/^Check$/);
    expect(h.koda.count("learning.answered")).toBe(1);
    expect(h.text()).toContain("not true yet");
    h.unmount();
  });

  it("takes a colour back with Undo", async () => {
    const [q] = roundOf(params, 1);
    const h = renderActivity(board, { params });
    const cell = q.blanks[0];
    await h.press(PALETTE[q.board.palette[0]].name);
    await h.press(tileLabel(q.board, cell, undefined, q.board.givens));
    expect(h.text()).toContain(`(${q.blanks.length - 1} left)`);
    await h.press("Undo");
    expect(h.text()).toContain(`(${q.blanks.length} left)`);
    expect(h.koda.count("learning.answered")).toBe(0);
    h.unmount();
  });

  it("erases a tile back to blank", async () => {
    const [q] = roundOf(params, 1);
    const h = renderActivity(board, { params });
    const cell = q.blanks[0];
    const colour = q.board.palette[0];
    await h.press(PALETTE[colour].name);
    await h.press(tileLabel(q.board, cell, undefined, q.board.givens));
    await h.press("Erase");
    /* The tile now announces itself as painted, which is the point: a reader
       has to be able to tell a tile they coloured from one they did not. */
    const painted = [...q.board.givens];
    painted[cell] = colour;
    await h.press(tileLabel(q.board, cell, undefined, painted));
    expect(h.text()).toContain(`(${q.blanks.length} left)`);
    h.unmount();
  });
});

describe("hints come off the board as it stands", () => {
  it("names a step the visible clues justify, and no others", () => {
    for (const mode of ["zero", "full", "remaining"] as const) {
      const [q] = roundOf({ mode }, 1);
      const step = nextStep(q.board, q.board.givens);
      expect(step, `${mode} has no first move`).not.toBeNull();
      /* The words must match a rule the solver actually applied, not a
         plausible sentence about the board. */
      const applied = deduce(q.board, q.board.givens).steps[0];
      const clue = q.board.clues.find((c) => c.id === applied.evidence[0].clueId)!;
      expect(step!.name).toContain(String(clue.count));
      expect(step!.name).toContain(PALETTE[clue.color].name.toLowerCase());
    }
  });

  it("moves on once the tiles it was about are coloured", () => {
    const [q] = roundOf({ mode: "zero" }, 1);
    const first = nextStep(q.board, q.board.givens)!;
    const done = enumerateSolutions(q.board).solutions[0];
    /* With the board finished there is nothing left to deduce, so the hint has
       to stop describing a move rather than repeat a stale one. */
    expect(nextStep(q.board, done)).toBeNull();
    expect(first.worked.length).toBeGreaterThan(20);
  });
});

describe("every board this engine ships is solvable by the rules it teaches", () => {
  it.each(["zero", "full", "remaining", "chain", "overlap", "three_color"] as const)(
    "%s boards have one answer and a proof",
    (mode) => {
      for (let i = 0; i < 6; i += 1) {
        const q = buildQuestion({ mode } as never, i);
        expect(enumerateSolutions(q.board).status, `${mode} #${i}`).toBe("unique");
        expect(deduce(q.board).status).toBe("solved");
      }
    },
  );
});

describe("state cannot outlive the board it belongs to", () => {
  it("survives moving to the next question with tiles painted", async () => {
    /*
     * The regression this exists for: painted tiles were held on their own, so
     * for one render after a new question arrived they were the previous
     * puzzle's colours against the new puzzle's clues. The hint is computed
     * during render, `deduce` validates strictly, and the round died with
     * "Fixed tiles cannot be changed or erased" — in the middle of a child's
     * lesson, not in a test.
     */
    const params = { mode: "zero", anchors: ["center", "edge"], questionsPerRound: 2 };
    const round = roundOf(params, 2);
    const h = renderActivity(board, { params });
    await paint(h, round[0], solutionOf(round[0]));
    await h.press(/^Check$/);
    await h.press(/^(next|continue)$/i);
    await h.settle();
    expect(h.koda.count("learning.present"), "the second question was asked").toBe(2);
    /* And the new board starts blank rather than carrying the last one's paint. */
    expect(h.text()).toContain(`(${round[1].blanks.length} left)`);
    h.unmount();
  });
});

/**
 * Phase 3: four lessons and no new code.
 *
 * Which makes one question the whole gate — does a lesson's *title* match what
 * its boards actually require? A lesson can name a technique in its copy and
 * generate boards that a simpler rule finishes first, and nothing about it
 * looks wrong: the boards are valid, the answers unique, the round scores.
 * These read the proof the solver produced and insist the named rule is in it.
 */
describe("each lesson's boards need the technique it is named after", () => {
  const lessonNamed = (id: string) => skill.lessons.find((l) => l.id === id)!;
  const boardsOf = (id: string) => {
    const lesson = lessonNamed(id);
    const seen = new Set<string>();
    return Array.from({ length: 3 }, (_, i) =>
      buildQuestion({ ...board.defaultParams, ...(lesson.params as object) } as never, i, seen));
  };
  const proofOf = (q: ReturnType<typeof buildQuestion>) => deduce(q.board).steps;

  it("level 9 needs a clue whose count is already met", () => {
    for (const q of boardsOf("matches-already-found")) {
      const rules = proofOf(q).map((s) => s.rule);
      expect(rules, `${q.id}`).toContain("remaining-exclude");
    }
  });

  it("level 10 fills exactly one tile from a clue's shortfall", () => {
    for (const q of boardsOf("one-more-match")) {
      const fill = proofOf(q).find((s) => s.rule === "remaining-fill");
      expect(fill, `${q.id} never subtracts`).toBeDefined();
      expect(fill!.changes).toHaveLength(1);
    }
  });

  it("level 11 fills more than one, which is what separates it from level 10", () => {
    for (const q of boardsOf("all-remaining-match")) {
      const fill = proofOf(q).find((s) => s.rule === "remaining-fill" && s.changes.length > 1);
      expect(fill, `${q.id} decides only one tile, so it is level 10 again`).toBeDefined();
    }
  });

  it("level 12 cannot be finished without using an answer of your own", () => {
    for (const q of boardsOf("follow-the-clues")) {
      /* Depth 2 means a step that rests on a tile an earlier step decided.
         A board of independent one-move deductions is not a chain, however
         many moves it takes. */
      expect(proofOf(q).some((s) => s.depth >= 2), `${q.id} is not a chain`).toBe(true);
    }
  });

  it("adds no engine and no level branch", async () => {
    /* Phase 3's whole claim: four lessons, zero new code. Stated as "these
       four lessons run on an engine that already existed" rather than as a
       count of the skill's engines — the skill grew a third in Phase 7 and
       that says nothing about whether Phase 3 added one. */
    expect(Object.keys(skill.activities)).toContain("board");
    for (const id of ["matches-already-found", "one-more-match", "all-remaining-match", "follow-the-clues"]) {
      expect(lessonNamed(id).activity).toBe("color-sweeper/board");
    }
    const source = await import("node:fs").then((fs) =>
      fs.readFileSync("src/skills/color-sweeper/activities/SweeperBoard.tsx", "utf8"),
    );
    expect(source, "an engine that asks which level it is has stopped being one engine")
      .not.toMatch(/levelNumber\s*===|level\s*===\s*\d/);
  });
});

/**
 * Phase 4: §5 rule 6, and a pattern taught as a rule rather than a picture.
 */
describe("levels 13-16 need the reduction they are named after", () => {
  const boardsOf = (id: string) => {
    const lesson = skill.lessons.find((l) => l.id === id)!;
    const seen = new Set<string>();
    return Array.from({ length: 3 }, (_, i) =>
      buildQuestion({ ...board.defaultParams, ...(lesson.params as object) } as never, i, seen));
  };

  it.each(["shared-neighbors", "overlap-chains", "the-one-two-one", "the-one-two-two-one"])(
    "%s: every board fails to solve with subset reduction removed",
    (id) => {
      for (const q of boardsOf(id)) {
        /* §5 rule 6. A board that still finishes without the rule teaches
           something other than the rule it is named after. */
        expect(deduce(q.board, q.board.givens, { overlap: false }).status, `${q.id} needs no reduction`)
          .not.toBe("solved");
        expect(deduce(q.board).steps.some((s) => s.rule.startsWith("overlap"))).toBe(true);
      }
    },
  );

  it("the pattern lessons ship a wall that reads like the pattern and settles differently", () => {
    const wall = (q: ReturnType<typeof buildQuestion>) => q.board.clues
      .slice().sort((a, b) => a.cell - b.cell).map((c) => c.count).join("-");
    for (const id of ["the-one-two-one", "the-one-two-two-one"]) {
      const walls = boardsOf(id).map(wall);
      expect(walls, `${id} never shows a 1-2-1`).toContain("1-2-1");
      /* The look-alike's answer is not the memorised outcome. A child applying
         "ends marked, middle safe" to it is wrong, which is the whole reason
         it is in the pool. */
      const lookalike = boardsOf(id).find((q) => q.board.givens.filter((c) => c === null).length === 4 && wall(q) === "1-2-1");
      expect(lookalike, `${id} has no look-alike wall`).toBeDefined();
      const answer = enumerateSolutions(lookalike!.board).solutions[0];
      const row = lookalike!.blanks.map((c) => answer[c]);
      expect(new Set(row).size, "a look-alike whose answer is uniform is not a look-alike").toBe(2);
      expect(row[0]).toBe(row[2]);
      expect(row[1]).not.toBe(row[0]);
    }
  });

  it("a cross-colour clue says on its face what it counts", () => {
    for (const q of boardsOf("the-one-two-one")) {
      for (const clue of q.board.clues) {
        expect(clue.countedColor, "a pattern clue must count the other colour").not.toBe(clue.color);
        /* And a reader has to be told, or the wall is three orange tiles with
           numbers on and nothing saying what they count. */
        expect(tileLabel(q.board, clue.cell)).toContain(
          `clue counting ${PALETTE[clue.countedColor!].name.toLowerCase()}`,
        );
      }
    }
  });
});

describe("a partial question accepts what the clues settle, and nothing guessed", () => {
  const partial = () => {
    const lesson = skill.lessons.find((l) => l.id === "shared-neighbors")!;
    return buildQuestion({ ...board.defaultParams, ...(lesson.params as object) } as never, 0);
  };
  const params = { ...(skill.lessons.find((l) => l.id === "shared-neighbors")!.params as object) };

  it("asks for fewer tiles than the board has blank", () => {
    const q = partial();
    expect(q.asked.length).toBeGreaterThan(0);
    expect(q.asked.length).toBeLessThan(q.blanks.length);
    expect(q.partial).toBe(true);
  });

  it("marks leaving the undecidable tiles blank as correct", async () => {
    const q = partial();
    const answer = enumerateSolutions(q.board).solutions[0];
    const h = renderActivity(board, { params });
    for (const cell of q.asked) {
      await h.press(PALETTE[answer[cell]].name);
      await h.press(tileLabel(q.board, cell, undefined, q.board.givens));
    }
    await h.press(/^Check$/);
    expect(h.text()).toContain("Exactly what they settle");
    expect(h.koda.count("learning.answered")).toBe(1);
    h.unmount();
  });

  it("counts guessing the rest as wrong, and says why", async () => {
    const q = partial();
    const answer = enumerateSolutions(q.board).solutions[0];
    const h = renderActivity(board, { params });
    for (const cell of q.blanks) {
      await h.press(PALETTE[answer[cell]].name);
      await h.press(tileLabel(q.board, cell, undefined, q.board.givens));
    }
    await h.press(/^Check$/);
    /* Every tile is the right colour. It is still wrong, because two of them
       were not deducible and the lesson is about knowing which. */
    expect(h.text()).toContain("cannot decide every tile");
    h.unmount();
  });

  it("refuses an unfinished partial answer rather than scoring it", async () => {
    const q = partial();
    const answer = enumerateSolutions(q.board).solutions[0];
    const h = renderActivity(board, { params });
    await h.press(PALETTE[answer[q.asked[0]]].name);
    await h.press(tileLabel(q.board, q.asked[0], undefined, q.board.givens));
    await h.press(/^Check$/);
    if (q.asked.length > 1) {
      expect(h.text()).toMatch(/still blank/);
      expect(h.koda.count("learning.answered")).toBe(0);
    }
    h.unmount();
  });
});

/**
 * Phase 5: clues that are not about a neighbourhood.
 *
 * Each of these levels exists because a neighbourhood clue cannot say what it
 * says. So the test that matters is not "does the board solve" — it is "is the
 * new clue the thing that solves it".
 */
describe("levels 17-20 need the kind of clue they introduce", () => {
  const boardsOf = (id: string) => {
    const lesson = skill.lessons.find((l) => l.id === id)!;
    const seen = new Set<string>();
    return Array.from({ length: 3 }, (_, i) =>
      buildQuestion({ ...board.defaultParams, ...(lesson.params as object) } as never, i, seen));
  };

  it("17 stalls completely without the complement reading", () => {
    for (const q of boardsOf("count-the-other-color")) {
      const plain = deduce(q.board, q.board.givens, { complement: false });
      expect(plain.steps, `${q.id} needs no complement`).toHaveLength(0);
      const withIt = deduce(q.board);
      expect(withIt.steps.some((s) => s.evidence.some((e) => e.derived))).toBe(true);
      /* And it stays partly open, which is the honest state of the board and
         the thing the lesson asks the child to recognise. */
      expect(q.asked.length).toBeLessThan(q.blanks.length);
    }
  });

  it.each([
    ["how-many-are-left", "board"],
    ["a-whole-row", "line"],
    ["a-marked-area", "region"],
  ])("%s carries exactly one %s clue, and nothing else could decide the board", (id, kind) => {
    for (const q of boardsOf(id)) {
      expect(q.board.clues).toHaveLength(1);
      expect(scopeOf(q.board.clues[0]).kind).toBe(kind);
      /* §5 rule 6 in its simplest form: take the clue away and nothing is left
         that could finish the board. */
      const stripped = { ...q.board, clues: [] };
      expect(deduce(stripped).status).toBe("stalled");
      expect(deduce(q.board).status).toBe("solved");
    }
  });

  it("a region is never a rectangle, and never counts a tile outside itself", () => {
    for (const q of boardsOf("a-marked-area")) {
      const cells = governed(q.board.clues[0], q.board.size);
      const rows = new Set(cells.map((c) => Math.floor(c / q.board.size)));
      const cols = new Set(cells.map((c) => c % q.board.size));
      /* A block is a shape a child could have guessed. The point of a region
         clue is that its shape has no rule, so it has to be read. */
      expect(cells.length, "a rectangle is not a region worth outlining")
        .not.toBe(rows.size * cols.size);
      const outside = [...Array(q.board.size ** 2).keys()].filter((c) => !cells.includes(c));
      const answer = enumerateSolutions(q.board).solutions[0];
      const counted = cells.filter((c) => answer[c] === q.board.clues[0].countedColor).length;
      expect(counted).toBe(q.board.clues[0].count);
      expect(outside.length).toBeGreaterThan(0);
    }
  });

  it("says in words what each off-board clue counts over", () => {
    for (const id of ["how-many-are-left", "a-whole-row", "a-marked-area"]) {
      for (const q of boardsOf(id)) {
        const text = chipText(q.board.clues[0]);
        expect(text).toMatch(/^(Whole board|Row \d|Column \d|Outlined area): \d (orange|navy|cyan)$/);
      }
    }
  });
});

describe("levels 21-22: the condition has to change the answer", () => {
  const boardsOf = (id: string) => {
    const lesson = skill.lessons.find((l) => l.id === id)!;
    const seen = new Set<string>();
    return Array.from({ length: 3 }, (_, i) =>
      buildQuestion({ ...board.defaultParams, ...(lesson.params as object) } as never, i, seen));
  };

  it.each(["all-in-a-run", "a-gap-somewhere"])("%s is unsolvable from the bare count", (id) => {
    for (const q of boardsOf(id)) {
      expect(deduce(q.board).steps.some((s) => s.rule === "run")).toBe(true);
      /* §5 rule 7a. Strip the condition and the line must have more than one
         arrangement left — otherwise the count decided it and the braces or
         dashes were decoration. */
      const bare = { ...q.board, clues: q.board.clues.map(({ run, ...rest }) => rest) };
      expect(enumerateSolutions(bare).status, `${q.id} is decided by its count alone`).toBe("multiple");
      expect(enumerateSolutions(q.board).status).toBe("unique");
    }
  });

  it("says the condition in words, not only in punctuation", () => {
    /* Hexcells writes `{n}` and `-n-`. A child meeting braces for the first
       time has nothing to read them with, so the chip spells it out. */
    expect(chipText(boardsOf("all-in-a-run")[0].board.clues[0])).toMatch(/together$/);
    expect(chipText(boardsOf("a-gap-somewhere")[0].board.clues[0])).toMatch(/not together$/);
  });

  it("the two lessons differ by their condition and not their count", () => {
    const together = boardsOf("all-in-a-run")[0].board.clues[0];
    const apart = boardsOf("a-gap-somewhere")[0].board.clues[0];
    expect(together.count).toBe(apart.count);
    expect(together.run).not.toBe(apart.run);
  });
});

/**
 * Phase 6: three colours, and a board that does not say which technique to use.
 */
describe("levels 23-26", () => {
  const boardsOf = (id: string) => {
    const lesson = skill.lessons.find((l) => l.id === id)!;
    const seen = new Set<string>();
    return Array.from({ length: 3 }, (_, i) =>
      buildQuestion({ ...board.defaultParams, ...(lesson.params as object) } as never, i, seen));
  };

  it("23 needs two exclusions, not one", () => {
    for (const q of boardsOf("three-color-choices")) {
      expect(q.board.palette).toHaveLength(3);
      /* The habit every two-colour board builds is that ruling one colour out
         decides the tile. Here the first exclusion must leave two standing. */
      const steps = deduce(q.board).steps;
      const firstNarrowing = steps.flatMap((s) => s.changes).find((c) => c.before.length === 3);
      expect(firstNarrowing, `${q.id} never starts from three candidates`).toBeDefined();
      expect(firstNarrowing!.after.length).toBe(2);
    }
  });

  it("24 stalls entirely without the colour nobody counted", () => {
    for (const q of boardsOf("three-colors-and-overlap")) {
      expect(deduce(q.board, q.board.givens, { complement: false }).steps).toHaveLength(0);
      expect(deduce(q.board).steps.some((s) => s.evidence.some((e) => e.derived))).toBe(true);
      /* And it stays partly open: three tiles this small cannot all be settled,
         and recognising that is what the lesson asks for. */
      expect(q.asked.length).toBeLessThan(q.blanks.length);
      /* The clues genuinely count different colours. */
      expect(new Set(q.board.clues.map((c) => c.countedColor)).size).toBeGreaterThan(1);
    }
  });

  it("25 carries one total per colour, and never one shared total", () => {
    for (const q of boardsOf("three-color-totals")) {
      const totals = q.board.clues.filter((c) => scopeOf(c).kind === "board");
      expect(totals).toHaveLength(3);
      expect(new Set(totals.map((c) => c.countedColor)).size).toBe(3);
      /* Their counts sum to the board, which is the check a child should never
         have to do — and the reason adding them together says nothing. */
      expect(totals.reduce((n, c) => n + c.count, 0)).toBe(q.board.size ** 2);
    }
  });

  it("26 mixes at least three kinds and its proof uses at least two", () => {
    for (const q of boardsOf("every-kind-of-clue")) {
      const kinds = new Set(q.board.clues.map((c) => scopeOf(c).kind));
      expect(kinds.size, `${q.id} is not mixed`).toBeGreaterThanOrEqual(3);
      const used = new Set(
        deduce(q.board).steps.flatMap((s) => s.evidence)
          .map((e) => scopeOf(q.board.clues.find((c) => c.id === e.clueId)!).kind),
      );
      expect(used.size, "one kind of clue finishes it, so nothing was chosen").toBeGreaterThanOrEqual(2);
      expect(enumerateSolutions(q.board).status).toBe("unique");
    }
  });
});
