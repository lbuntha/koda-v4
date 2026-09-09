import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { skill } from ".";
import { buildQuestion as buildLens, lensHints } from "./activities/NeighborLens";
import { buildQuestion as buildBoard, sweeperHints } from "./activities/SweeperBoard";
import { buildQuestion as buildLab, labHints } from "./activities/ClueLab";

/**
 * Phase 9: the things a reader is told exist.
 *
 * Every one of these is a promise made somewhere outside the code — in the
 * plan, in a lesson's JSON, in the manifest — and each is the kind that reads
 * correctly right up until somebody looks.
 */

const plan = readFileSync("docs/COLOR_SWEEPER_BUILD_PLAN.md", "utf8");
const isPractice = (l: (typeof skill.lessons)[number]) =>
  Boolean((l.params as { question?: { practice?: boolean } }).question?.practice);
const teaching = skill.lessons.filter((l) => !isPractice(l));

describe("the plan describes every lesson that exists", () => {
  it("gives all forty a worked example", () => {
    for (const lesson of skill.lessons) {
      const level = (lesson.params as { level: number }).level;
      expect(plan, `§17 has no Lesson ${level}`).toMatch(new RegExp(`### Lesson ${String(level).padStart(2, "0")} — `));
    }
  });

  it("gives each of those the six things §18 requires of it", () => {
    /* The plan's own coverage rule: a lesson is incomplete if it has a title
       and a board but lacks a question constraint, worked example, wrong-answer
       behaviour, hint policy and motion specification. */
    const blocks = plan.split(/(?=^### Lesson \d\d — )/m).filter((b) => b.startsWith("### Lesson"));
    expect(blocks).toHaveLength(40);
    for (const block of blocks) {
      const name = block.slice(0, block.indexOf("\n"));
      for (const heading of ["Child's task", "Worked reasoning", "Answer / successful action",
        "Common mistake", "Hint direction", "Animation"]) {
        expect(block.replace(/’/g, "'"), `${name} has no "${heading}"`).toContain(`**${heading}`);
      }
    }
  });

  it("records a delivery note for every phase it claims is done", () => {
    for (const phase of [0, 1, 2, 3, 4, 5, 6, 7, 8]) {
      const heading = phase === 0 ? "## Status — Phase 0 delivery record" : `## Status — Phase ${phase} delivery record`;
      expect(plan, `no record for phase ${phase}`).toContain(heading);
    }
  });
});

describe("the hint ladder every teaching lesson promises", () => {
  const hintsFor = (lesson: (typeof skill.lessons)[number]): string[] => {
    const params = lesson.params as Record<string, unknown>;
    const copy = ((params.play ?? {}) as { kidTip?: string }).kidTip;
    if (lesson.activity === "color-sweeper/board") {
      const q = buildBoard({ ...skill.activities.board.defaultParams, ...params } as never, 0);
      return sweeperHints(q, copy, q.board.givens);
    }
    if (lesson.activity === "color-sweeper/reason") {
      const q = buildLab({ ...skill.activities.reason.defaultParams, ...params } as never, 0);
      return labHints(q, copy);
    }
    const q = buildLens({ ...skill.activities.neighbors.defaultParams, ...params } as never, 0);
    return lensHints(q, copy, { chosen: 0 });
  };

  it.each(teaching.map((l) => [l.id, l] as const))("%s offers three rungs, all of them saying something", (_id, lesson) => {
    const rungs = hintsFor(lesson);
    expect(rungs.length, `${lesson.id} has a short ladder`).toBeGreaterThanOrEqual(3);
    for (const rung of rungs) expect(rung.trim().length, lesson.id).toBeGreaterThan(15);
    expect(new Set(rungs).size, `${lesson.id} repeats a rung`).toBe(rungs.length);
  });

  it("never puts the answer on the deepest rung of a choice question", () => {
    /* An action lesson may explain a placement fully — a child still has to
       make it. A choice lesson may not: the deepest rung there would be the
       answer with extra words round it. */
    for (const lesson of teaching.filter((l) => l.activity === "color-sweeper/reason")) {
      const q = buildLab({ ...skill.activities.reason.defaultParams, ...(lesson.params as object) } as never, 0);
      const deepest = hintsFor(lesson).at(-1)!;
      if (q.options) {
        for (const option of q.options.filter((o) => o.correct)) {
          expect(deepest, `${lesson.id} hands over the answer`).not.toContain(option.text);
        }
      }
    }
  });

  it("gives practice no ladder at all", () => {
    for (const lesson of skill.lessons.filter(isPractice)) {
      const copy = ((lesson.params as { play?: { kidTip?: string } }).play ?? {}).kidTip;
      expect(copy, `${lesson.id} carries a hint`).toBe("");
    }
  });
});

describe("the manifest describes the skill that exists", () => {
  it("teaches exactly the keys its lessons carry, each named once", () => {
    const taught = [...new Set(skill.lessons.map((l) => l.conceptKey!))].sort();
    expect([...(skill.manifest.teaches ?? [])].sort()).toEqual(taught);
    expect(new Set(skill.manifest.teaches).size).toBe(skill.manifest.teaches!.length);
  });

  it("declares an age range covering every lesson's own band", () => {
    const [low, high] = skill.manifest.audience.ages;
    for (const lesson of skill.lessons) {
      const [from, to] = (lesson as { ageBand?: [number, number] }).ageBand ?? [low, high];
      expect(from, `${lesson.id} starts below the skill`).toBeGreaterThanOrEqual(low);
      expect(to, `${lesson.id} runs past the skill`).toBeLessThanOrEqual(high);
    }
  });

  it("stays a draft until somebody asks otherwise", () => {
    expect(skill.manifest.status).toBe("draft");
  });

  it("claims a standard only where the plan says it applies", () => {
    /* MP3 is construct-an-argument and critique-the-reasoning-of-others, which
       is levels 27-30 and nothing else. A standard on a counting lesson would
       be a claim nobody could support. */
    const withMP3 = skill.lessons.filter((l) => (l.standards ?? []).includes("CCSS.MATH.PRACTICE.MP3"));
    expect(withMP3.map((l) => (l.params as { level: number }).level).sort((a, b) => a - b)).toEqual([27, 28, 29, 30]);
  });
});
