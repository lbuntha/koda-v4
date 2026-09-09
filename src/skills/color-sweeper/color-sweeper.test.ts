import { describe, expect, it } from "vitest";
import { describeSkillContract } from "../kit/testing";
import { skill } from ".";
import { buildQuestion as buildLens } from "./activities/NeighborLens";
import { buildQuestion as buildBoard } from "./activities/SweeperBoard";
import { buildQuestion as buildLab } from "./activities/ClueLab";
import { labKey } from "./internal/reasons";
import { lensKey } from "./internal/lenses";
import { lessonIcons, lessonIconTones } from "../../components/ui/lessonIcons";
import { SVG_ASSET_IDS } from "../../assets/svg/ids";

describeSkillContract(skill);

/**
 * The audit: strings in JSON that name something which has to exist.
 *
 * Each of these shipped in multiplication and reached a screenshot rather than
 * a test run, because every one of them reads correctly and resolves to
 * nothing. An unregistered icon name draws a "?", and the lesson list looks
 * broken to a parent while every assertion about the lesson still passes.
 */
/** A lesson that has had its scaffolding taken away. */
const isPracticeLesson = (lesson: (typeof skill.lessons)[number]): boolean =>
  Boolean((lesson.params as { question?: { practice?: boolean } }).question?.practice);

describe("names in lesson data resolve to something", () => {
  it("uses only registered lesson icons", () => {
    const registered = Object.keys(lessonIcons);
    for (const lesson of skill.lessons) {
      expect(registered, `${lesson.id} draws a "?" for iconName "${lesson.iconName}"`)
        .toContain(lesson.iconName);
    }
  });

  it("uses only registered icon tones", () => {
    const tones = Object.keys(lessonIconTones);
    for (const lesson of skill.lessons) expect(tones).toContain(lesson.iconTone);
  });

  it("names a thumbnail the build actually has", () => {
    expect(SVG_ASSET_IDS as readonly string[]).toContain(skill.manifest.thumbnail);
  });

  it("gives every teaching lesson the play copy the round reads", () => {
    for (const lesson of skill.lessons.filter((l) => !isPracticeLesson(l))) {
      const play = (lesson.params as { play?: Record<string, unknown> }).play ?? {};
      for (const key of ["targetObjective", "stepByStep", "kidTip", "audioPrompt"]) {
        expect(play[key], `${lesson.id} has no ${key}`).toBeTruthy();
      }
      expect((play.stepByStep as string[]).length).toBeGreaterThanOrEqual(3);
    }
  });

  it("gives every practice lesson no hint and nothing to say", () => {
    /* The opposite requirement, and it is a requirement rather than an
       omission: a hint button with nothing behind it teaches a child that the
       app's controls are decorative. */
    for (const lesson of skill.lessons.filter(isPracticeLesson)) {
      const play = (lesson.params as { play?: Record<string, unknown> }).play ?? {};
      expect(play.kidTip, `${lesson.id} carries a hint into practice`).toBe("");
      expect(play.audioPrompt, `${lesson.id} speaks during practice`).toBe("");
    }
  });

  it("teaches exactly the concept keys its lessons carry", () => {
    const taught = new Set(skill.lessons.map((l) => l.conceptKey));
    expect([...taught].sort()).toEqual([...(skill.manifest.teaches ?? [])].sort());
  });
});

/**
 * Buttons a child taps have to be wide enough for the words in them.
 *
 * A square answer tile is right for one digit and wrong for a sentence. This is
 * a source scan rather than a rendering check because jsdom has no layout
 * engine and cannot see an overflow — the same reason the defect survived two
 * thousand tests in multiplication.
 */
describe("answer controls are shaped for what they hold", () => {
  it("never sizes a statement button as a digit tile", async () => {
    const source = await import("node:fs").then((fs) =>
      fs.readFileSync("src/skills/color-sweeper/activities/NeighborLens.tsx", "utf8"),
    );
    expect(source, "a fixed-width tile cannot hold a sentence").not.toMatch(/"choice"/);
    expect(source).not.toMatch(/w-14 h-14/);
  });
});

/**
 * Five questions, not one question five times.
 *
 * Caught by eye rather than by this suite: level 1 anchored to the centre of a
 * 3x3 board, and a 3x3 board has exactly one centre cell — so every question
 * in the round outlined the same tile and only the decorative colours moved.
 * Every assertion still passed, because each question was individually valid.
 *
 * These run each shipped lesson's own round the way the engine does and ask
 * whether the thing the lesson is about actually varies.
 */
describe("a round asks a different question each time", () => {
  /* Each lesson is driven through its own engine, because "the same question"
     means something different in each: a reading question is the tile it
     outlines, a board is the whole puzzle. */
  const engineOf = (lesson: (typeof skill.lessons)[number]) => {
    if (lesson.activity === "color-sweeper/board") return { build: buildBoard, identity: (q: { id: string }) => q.id, key: "board" };
    if (lesson.activity === "color-sweeper/reason") return { build: buildLab, identity: (q: unknown) => labKey(q as never), key: "reason" };
    return { build: buildLens, identity: (q: never) => lensKey(q), key: "neighbors" };
  };

  const roundOf = (lesson: (typeof skill.lessons)[number]) => {
    const params = lesson.params as { question: { questionsPerRound: number } };
    const { build } = engineOf(lesson);
    const defaults = skill.activities[engineOf(lesson).key].defaultParams;
    const seen = new Set<string>();
    return Array.from({ length: params.question.questionsPerRound }, (_, i) =>
      build({ ...defaults, ...(lesson.params as object) } as never, i, seen));
  };

  it.each(skill.lessons.map((l) => [l.title, l] as const))("%s varies its board", (_title, lesson) => {
    const round = roundOf(lesson);
    const identity = engineOf(lesson).identity as (q: unknown) => string;
    const distinct = new Set(round.map(identity)).size;
    if (isPracticeLesson(lesson)) {
      /*
       * §5 rule 8: deduplicate with bounded retries, and allow repetition once
       * a small space is exhausted. Nine questions over three anchors of a 3x3
       * board genuinely runs out, and repeating a board is the honest outcome
       * — quietly relaxing the technique to find a "new" one would not be.
       */
      expect(distinct, `${lesson.id} barely varies`).toBeGreaterThanOrEqual(round.length - 2);
    } else {
      expect(distinct, "two questions are the same board").toBe(round.length);
    }
  });

  it.each(skill.lessons.filter((l) => l.activity === "color-sweeper/neighbors").map((l) => [l.title, l] as const))(
    "%s varies what it points at, not only how it is painted",
    (_title, lesson) => {
      const round = roundOf(lesson) as ReturnType<typeof buildLens>[];
      /* Re-colouring a board is not a new question when the question is "which
         tiles touch this one" — the answer is identical, and the child sees the
         same puzzle twice. */
      const asked = new Set(round.map((q) => `${q.board.size}:${q.target}`));
      const mode = (lesson.params as { question: { mode: string } }).question.mode;
      if (mode === "select_neighbors") {
        expect(asked.size, "a question is repeated with the colours reshuffled").toBe(round.length);
      } else {
        expect(asked.size).toBeGreaterThanOrEqual(3);
      }
    },
  );

  it("never states the answer in the prompt", () => {
    for (const lesson of skill.lessons.filter((l) => l.activity === "color-sweeper/neighbors")) {
      for (const q of roundOf(lesson) as ReturnType<typeof buildLens>[]) {
        if (q.mode === "select_neighbors") {
          // "There are 8" turns finding the neighbourhood into matching a number.
          expect(q.prompt, `${lesson.id} gives the count away`).not.toMatch(/\b\d+\b/);
        }
        if (q.expectedCount !== undefined && q.mode !== "complement") {
          expect(q.prompt, `${lesson.id} gives the count away`).not.toContain(String(q.expectedCount));
        }
      }
    }
  });

  it("never puts a solved tile on a board a child is asked to solve", () => {
    /* The board engine's question deliberately carries no `solution` field, so
       an answer cannot reach the renderer even by accident. */
    for (const lesson of skill.lessons.filter((l) => l.activity === "color-sweeper/board")) {
      for (const q of roundOf(lesson) as ReturnType<typeof buildBoard>[]) {
        expect(Object.keys(q)).not.toContain("solution");
        expect(q.blanks.length).toBeGreaterThan(0);
        expect(q.blanks.every((cell) => q.board.givens[cell] === null)).toBe(true);
      }
    }
  });
});
