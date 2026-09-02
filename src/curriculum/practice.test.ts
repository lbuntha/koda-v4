import { describe, expect, it } from "vitest";

import { getCourseLessons, getCourseUnits, isPracticeLesson, practiceTitle } from "./index";
import type { Viewer } from "../skills/viewer";

/**
 * Which lessons are practice, and how the path is allowed to find out.
 *
 * The learning path shows practice in its own section rather than as more units
 * on the end of the path, so this answer decides what a learner sees where.
 * It is asserted against the real course: a new practice lesson that forgets
 * the flag would otherwise land silently in the middle of the teaching path.
 */

const viewer: Viewer = { age: 9, showAllSkills: true } as Viewer;

describe("telling practice from teaching", () => {
  it("reads the lesson's own params, not its title", () => {
    expect(isPracticeLesson({ params: { question: { practice: true } } } as never)).toBe(true);
    expect(isPracticeLesson({ params: { question: { practice: false } } } as never)).toBe(false);
    expect(isPracticeLesson({ params: { question: {} } } as never)).toBe(false);
    expect(isPracticeLesson({ params: {} } as never)).toBe(false);
    expect(isPracticeLesson({} as never)).toBe(false);
    // Named like practice, not flagged as practice: the flag decides, because
    // it is the same field the activity reads to turn the scaffolding off.
    expect(isPracticeLesson({ title: "Practice: Frames" } as never)).toBe(false);
  });

  it("agrees with every practice lesson the course actually ships", () => {
    const lessons = getCourseLessons(viewer);
    const flagged = lessons.filter(isPracticeLesson);
    const named = lessons.filter((l) => /^practice\b/i.test(l.title));

    expect(flagged.length).toBeGreaterThan(0);
    // Both skills contribute practice, so a regression in one is still caught.
    expect(new Set(flagged.map((l) => l.skillId)).size).toBeGreaterThan(1);
    expect(flagged.map((l) => l.ref).sort()).toEqual(named.map((l) => l.ref).sort());
  });

  it("leaves no practice lesson inside a teaching unit", () => {
    // The split the page makes is per lesson, so a mixed unit would still be
    // rendered correctly — but the course has no reason to have one, and one
    // appearing is worth knowing about.
    for (const unit of getCourseUnits(viewer)) {
      const practice = unit.lessons.filter(isPracticeLesson).length;
      expect(practice === 0 || practice === unit.lessons.length, unit.title).toBe(true);
    }
  });
});

describe("what the recommender is allowed to see", () => {
  it("is never a practice lesson", async () => {
    // Practice is not a next step, and it is not evidence either: one practice
    // lesson mixes several techniques under a single conceptKey, so a
    // recommender reading it as progress on that concept reads it wrong.
    const { buildCatalog } = await import("../skills/catalog");
    const catalog = buildCatalog(viewer);
    const refs = new Set(catalog.lessons.map((l) => l.ref));

    expect(refs.size).toBeGreaterThan(0);
    for (const lesson of getCourseLessons(viewer).filter(isPracticeLesson)) {
      expect(refs.has(lesson.ref), `${lesson.ref} was offered as a recommendation`).toBe(false);
    }
  });

  it("still holds the teaching lessons it was hiding them among", () => {
    // The guard against fixing the above by emptying the catalog.
    const taught = getCourseLessons(viewer).filter((l) => !isPracticeLesson(l));
    expect(taught.length).toBeGreaterThan(20);
  });
});

describe("naming a practice lesson where the surface already says practice", () => {
  it("drops the prefix and keeps the technique", () => {
    expect(practiceTitle("Practice: Number Bonds")).toBe("Number Bonds");
    expect(practiceTitle("Practice — Counting and Frames")).toBe("Counting and Frames");
    expect(practiceTitle("Practice - Facts")).toBe("Facts");
    // No separator either: the concept line of every practice lesson reads
    // "Practice Without Help", and the round chrome strips it the same way.
    expect(practiceTitle("Practice Without Help")).toBe("Without Help");
  });

  it("leaves a title that is not prefixed alone", () => {
    expect(practiceTitle("Number Bonds")).toBe("Number Bonds");
    // "Practising" is not the prefix, and must not be clipped to "ing".
    expect(practiceTitle("Practising Bonds")).toBe("Practising Bonds");
  });

  it("leaves every teaching lesson in the course untouched", () => {
    for (const lesson of getCourseLessons(viewer).filter((l) => !isPracticeLesson(l))) {
      expect(practiceTitle(lesson.title)).toBe(lesson.title);
    }
  });
});
