import { describe, expect, it } from "vitest";

import {
  firstPracticeLesson,
  getCourseLessons,
  getSkillLessons,
  isPracticeLesson,
  nextSkillLesson,
  pathPosition,
  resumeLesson,
  skillLessonNumber,
} from "./index";
import type { ResolvedLesson } from "./index";
import type { Viewer } from "../skills/viewer";

/**
 * Which lesson "Continue" opens.
 *
 * The page used to answer this from the app's `activeLevelNumber` — the level
 * the Learn tab last opened, which starts at 1 and never moves until a round
 * begins. A learner eight lessons into a skill was offered lesson one, and a
 * learner with several skills registered got that on every skill but the one
 * they last played. These pin the rule that replaced it.
 */

const viewer: Viewer = { age: 7, showAllSkills: true } as Viewer;

const lessons = getCourseLessons(viewer);

/**
 * Found by `skillId/lessonId`, never by the bare id.
 *
 * A lesson id only has to be unique inside its own skill — that is what the
 * skill contract checks, and what the course's `skillId/lessonId` refs are for.
 * Two skills legitimately have a `practice-numberline`, and looking one up by
 * slug quietly returned whichever came first: a test marking addition's as
 * finished was marking counting's instead, and the case it was checking never
 * happened.
 */
const byRef = (ref: string): ResolvedLesson => {
  const lesson = lessons.find((l) => l.ref === ref);
  if (!lesson) throw new Error(`no lesson "${ref}" in the course`);
  return lesson;
};

/** Star counts, keyed the way the app stores them. */
const completing = (...refs: string[]): Record<number, number> =>
  Object.fromEntries(refs.map((ref) => [byRef(ref).levelNumber, 3]));

/* No grown-up has placed this learner anywhere, which is the default state and
   the one the placement cases below deliberately depart from. */
const unplaced = null;

describe("resumeLesson", () => {
  it("offers the first lesson when nothing has been played", () => {
    expect(resumeLesson(lessons, {}, viewer, unplaced)?.levelNumber).toBe(lessons[0].levelNumber);
  });

  it("moves past every lesson already finished", () => {
    const done = lessons.slice(0, 5);
    const completed = completing(...done.map((l) => l.ref));

    const next = resumeLesson(lessons, completed, viewer, unplaced);
    expect(next).toBeDefined();
    expect(next!.levelNumber).toBeGreaterThan(done[done.length - 1].levelNumber);
    expect(completed[next!.levelNumber]).toBeUndefined();
  });

  it("returns undefined once every lesson is finished", () => {
    const completed = completing(...lessons.map((l) => l.ref));
    expect(resumeLesson(lessons, completed, viewer, unplaced)).toBeUndefined();
  });

  it("never offers a lesson that is still locked", () => {
    for (const played of [0, 1, 3, 6]) {
      const completed = completing(...lessons.slice(0, played).map((l) => l.ref));
      const next = resumeLesson(lessons, completed, viewer, unplaced);
      if (!next) continue;
      expect(next.requires ?? []).toBeDefined();
      // Everything it requires has been satisfied, or it would not be offered.
      const satisfied = new Set(
        lessons.filter((l) => completed[l.levelNumber]).map((l) => l.conceptKey),
      );
      for (const key of next.requires ?? []) expect(satisfied.has(key)).toBe(true);
    }
  });

  it("resumes after the furthest lesson played, not the earliest unplayed one", () => {
    /* A child placed at unit 3 has units 1 and 2 open but unplayed. Reading the
       list front to back would hand them lesson one after a week's work. */
    const placedAt = lessons[7].levelNumber;
    const completed = completing(lessons[8].ref, lessons[9].ref);

    const next = resumeLesson(lessons, completed, viewer, placedAt);
    expect(next?.levelNumber).toBeGreaterThan(lessons[9].levelNumber);
  });

  it("falls back to a skipped lesson when there is nothing further ahead", () => {
    /* Everything from the skip onwards is done, so the gap is genuinely next. */
    const skipped = lessons[0];
    const completed = completing(...lessons.slice(1).map((l) => l.ref));

    expect(resumeLesson(lessons, completed, viewer, skipped.levelNumber)?.levelNumber).toBe(
      skipped.levelNumber,
    );
  });

  it("never offers practice, however much of the teaching is finished", () => {
    /* Practice sits in units of its own at the end of the flat course, so
       reading straight through pointed "Continue" at it the moment the teaching
       ran out. Practice is a choice a learner makes, never the answer to "what
       next" — checked at every depth, not just at the end. */
    for (const played of [0, 5, 20, lessons.filter((l) => !isPracticeLesson(l)).length]) {
      const completed = completing(...lessons.slice(0, played).map((l) => l.ref));
      const next = resumeLesson(lessons, completed, viewer, unplaced);
      if (next) expect(isPracticeLesson(next), next.ref).toBe(false);
    }
  });

  it("is not moved on by a practice run played early", () => {
    /* The other half of the same rule. A child who dips into practice has not
       moved further through the course, and treating it as the furthest thing
       played skipped every teaching lesson still open behind it. */
    const practice = lessons.find(isPracticeLesson);
    expect(practice).toBeDefined();

    const done = lessons.slice(0, 3);
    const completed = completing(...done.map((l) => l.ref), practice!.ref);

    const next = resumeLesson(lessons, completed, viewer, unplaced);
    expect(next?.levelNumber).toBe(lessons[3].levelNumber);
  });

  it("returns undefined once every teaching lesson is finished", () => {
    /* Untouched practice is not unfinished business: the page falls back to
       revision rather than being handed a practice lesson to "continue". */
    const completed = completing(
      ...lessons.filter((l) => !isPracticeLesson(l)).map((l) => l.ref),
    );
    expect(resumeLesson(lessons, completed, viewer, unplaced)).toBeUndefined();
  });

  it("answers per skill, so a second skill is not judged by the first's progress", () => {
    /* Synthetic rather than drawn from `course.json`: the shipped course has one
       skill today, and this is the case that broke — a learner with two skills
       registered was told to "Continue" at lesson one on whichever of them they
       had not just been playing. No `requires`, so unlocking never confounds it. */
    const make = (skillId: string, from: number): ResolvedLesson[] =>
      [0, 1, 2].map(
        (i) =>
          ({
            id: `${skillId}-${i}`,
            ref: `${skillId}/${skillId}-${i}`,
            skillId,
            levelNumber: from + i,
            title: `${skillId} ${i}`,
          }) as ResolvedLesson,
      );
    const alpha = make("alpha", 1);
    const beta = make("beta", 4);
    // Alpha finished, beta untouched — one record covering the whole course.
    const completed = { 1: 3, 2: 3, 3: 3 };

    expect(resumeLesson(alpha, completed, viewer, unplaced)).toBeUndefined();
    expect(resumeLesson(beta, completed, viewer, unplaced)?.levelNumber).toBe(4);
  });
});

describe("sequential lessons within a skill", () => {
  it("starts each skill's displayed lesson count at one", () => {
    const firstCounting = getSkillLessons("counting", viewer)[0];
    const firstAddition = getSkillLessons("addition", viewer)[0];

    expect(firstCounting).toBeDefined();
    expect(firstAddition).toBeDefined();
    expect(firstAddition.levelNumber).toBeGreaterThan(firstCounting.levelNumber);
    expect(skillLessonNumber(firstCounting, viewer)).toBe(1);
    expect(skillLessonNumber(firstAddition, viewer)).toBe(1);
  });

  it("chooses the immediate next lesson from the same skill", () => {
    const addition = getSkillLessons("addition", viewer).filter(
      (lesson) => !isPracticeLesson(lesson),
    );
    const current = addition[3];
    const next = nextSkillLesson(current, viewer);

    expect(next?.ref).toBe(addition[4].ref);
    expect(next?.skillId).toBe("addition");
    expect(skillLessonNumber(next!, viewer)).toBe(skillLessonNumber(current, viewer) + 1);
  });

  it("stops at the end of teaching instead of jumping into practice", () => {
    const countingTeaching = getSkillLessons("counting", viewer).filter(
      (lesson) => !isPracticeLesson(lesson),
    );

    expect(nextSkillLesson(countingTeaching[countingTeaching.length - 1], viewer)).toBeUndefined();
  });
});

/**
 * Where a lesson sits, and what a finished path is offered.
 *
 * A skill of fifteen lessons and five practice rounds is not a course of
 * twenty. Counting the whole skill told a child who had just finished
 * everything they were on "lesson 15 of 20" — five short of an end they had
 * already reached — and then handed them a screen with no next step.
 */
describe("the end of a path", () => {
  const teaching = () =>
    getSkillLessons("counting", viewer).filter((lesson) => !isPracticeLesson(lesson));
  const practice = () => getSkillLessons("counting", viewer).filter(isPracticeLesson);

  it("counts a lesson within its own path, not the whole skill", () => {
    const taught = teaching();
    const last = taught[taught.length - 1];

    expect(pathPosition(last, viewer)).toEqual({ number: taught.length, total: taught.length });
    // The skill-wide count is the number that read as an unfinished course.
    expect(skillLessonNumber(last, viewer)).toBeGreaterThan(taught.length - 1);
    expect(pathPosition(taught[0], viewer).number).toBe(1);
  });

  it("counts practice against the practice set", () => {
    const rounds = practice();

    expect(pathPosition(rounds[0], viewer)).toEqual({ number: 1, total: rounds.length });
  });

  it("offers the first practice round nobody has played", () => {
    const rounds = practice();
    const completed = { [rounds[0].levelNumber]: 3 };

    expect(firstPracticeLesson("counting", completed, viewer)?.ref).toBe(rounds[1].ref);
  });

  it("falls back to the first round once every one is played", () => {
    const rounds = practice();
    const completed = Object.fromEntries(rounds.map((lesson) => [lesson.levelNumber, 3]));

    expect(firstPracticeLesson("counting", completed, viewer)?.ref).toBe(rounds[0].ref);
  });

  it("has nothing to offer for a skill that ships no practice", () => {
    expect(firstPracticeLesson("nothing-here", {}, viewer)).toBeUndefined();
  });
});
