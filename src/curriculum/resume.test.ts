import { describe, expect, it } from "vitest";

import { getCourseLessons, resumeLesson } from "./index";
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
const bySlug = (id: string): ResolvedLesson => {
  const lesson = lessons.find((l) => l.id === id);
  if (!lesson) throw new Error(`no lesson "${id}" in the course`);
  return lesson;
};

/** Star counts, keyed the way the app stores them. */
const completing = (...ids: string[]): Record<number, number> =>
  Object.fromEntries(ids.map((id) => [bySlug(id).levelNumber, 3]));

/* No grown-up has placed this learner anywhere, which is the default state and
   the one the placement cases below deliberately depart from. */
const unplaced = null;

describe("resumeLesson", () => {
  it("offers the first lesson when nothing has been played", () => {
    expect(resumeLesson(lessons, {}, viewer, unplaced)?.levelNumber).toBe(lessons[0].levelNumber);
  });

  it("moves past every lesson already finished", () => {
    const done = lessons.slice(0, 5);
    const completed = completing(...done.map((l) => l.id));

    const next = resumeLesson(lessons, completed, viewer, unplaced);
    expect(next).toBeDefined();
    expect(next!.levelNumber).toBeGreaterThan(done[done.length - 1].levelNumber);
    expect(completed[next!.levelNumber]).toBeUndefined();
  });

  it("returns undefined once every lesson is finished", () => {
    const completed = completing(...lessons.map((l) => l.id));
    expect(resumeLesson(lessons, completed, viewer, unplaced)).toBeUndefined();
  });

  it("never offers a lesson that is still locked", () => {
    for (const played of [0, 1, 3, 6]) {
      const completed = completing(...lessons.slice(0, played).map((l) => l.id));
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
    const completed = completing(lessons[8].id, lessons[9].id);

    const next = resumeLesson(lessons, completed, viewer, placedAt);
    expect(next?.levelNumber).toBeGreaterThan(lessons[9].levelNumber);
  });

  it("falls back to a skipped lesson when there is nothing further ahead", () => {
    /* Everything from the skip onwards is done, so the gap is genuinely next. */
    const skipped = lessons[0];
    const completed = completing(...lessons.slice(1).map((l) => l.id));

    expect(resumeLesson(lessons, completed, viewer, skipped.levelNumber)?.levelNumber).toBe(
      skipped.levelNumber,
    );
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
