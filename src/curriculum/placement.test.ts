import { describe, expect, it } from "vitest";

import { getCourseLessons, isUnlocked, resolveStartingPoint, startingPointForAge } from "./index";
import type { Viewer } from "../skills/viewer";

/**
 * Placing a child by the age bands the curriculum already carries.
 *
 * This replaced a dropdown of a hundred and seven units, so the thing under test
 * is not really the arithmetic — it is whether the answer is *defensible*: a
 * child must never be placed past work still aimed at them, and must never be
 * placed past the end of the course with nothing left to open.
 */

const ALL: Viewer = { age: 99, isDeveloper: false, showAllSkills: true };

/** The whole course in order, as placement sees it. */
const course = () => getCourseLessons(ALL);

describe("where a child of a given age starts", () => {
  it("starts the youngest children at the very beginning", async () => {
    // The first lesson is banded 4-6, so a five- or six-year-old has nothing to
    // skip. `null` rather than level 0: "the beginning" is its own answer.
    expect(startingPointForAge(5)).toBeNull();
    expect(startingPointForAge(6)).toBeNull();
  });

  it("never places a child past work still aimed at them", () => {
    // The rule that matters. For every age, the lesson the child lands on must
    // have a band that still reaches them.
    const lessons = course();
    for (const age of [6, 7, 8, 9, 10, 11, 12]) {
      const at = startingPointForAge(age);
      const landsOn = lessons.find((l) => l.levelNumber > (at ?? 0));
      expect(landsOn, `age ${age} has nothing to open`).toBeDefined();
      if (landsOn?.ageBand) {
        expect(landsOn.ageBand[1], `age ${age} was placed past ${landsOn.ref}`).toBeGreaterThanOrEqual(age);
      }
    }
  });

  it("always leaves something to do, even above the oldest band", () => {
    // The curriculum's highest band ends at 14. A sixteen-year-old must still get
    // a course, not a congratulations screen.
    const last = course()[course().length - 1].levelNumber;
    for (const age of [13, 14, 16, 30]) {
      const at = startingPointForAge(age);
      expect(at, `age ${age}`).not.toBeNull();
      expect(at!, `age ${age} was placed past the end`).toBeLessThan(last);
    }
  });

  it("moves a child further in as they get older, never backwards", () => {
    const points = [6, 7, 8, 9, 10, 11, 12].map((age) => startingPointForAge(age) ?? 0);
    const sorted = [...points].sort((a, b) => a - b);
    expect(points).toEqual(sorted);
  });

  it("skips a real part of the course for an older beginner", () => {
    // The whole purpose: a twelve-year-old must not be handed age-four work. If
    // this ever returns nothing skipped, placement has quietly stopped working.
    const at = startingPointForAge(12);

    expect(at).not.toBeNull();
    expect(at!).toBeGreaterThan(100);
  });

  it("treats a missing or nonsense age as the beginning", () => {
    expect(startingPointForAge(0)).toBeNull();
    expect(startingPointForAge(-3)).toBeNull();
    expect(startingPointForAge(Number.NaN)).toBeNull();
  });
});

describe("resolving what a parent chose", () => {
  it("follows the age band when that is the setting", () => {
    expect(resolveStartingPoint("age", 12)).toBe(startingPointForAge(12));
  });

  it("starts at the beginning when a parent asked for that", () => {
    // Explicitly chosen, and age must not override it.
    expect(resolveStartingPoint(null, 12)).toBeNull();
  });

  it("keeps a unit a grown-up pinned by hand", () => {
    expect(resolveStartingPoint(40, 12)).toBe(40);
  });

  it("can be applied twice without drifting", () => {
    // The gates pass a resolved level down into each other, so this has to hold.
    const once = resolveStartingPoint("age", 10)!;
    expect(resolveStartingPoint(once, 10)).toBe(once);
  });
});

describe("what age placement actually opens, as the default", () => {
  /** The lesson a padlock test would reach for: gated, and early. */
  const gated = () => {
    const lesson = course().find((l) => l.id === "count-scattered-objects");
    if (!lesson) throw new Error("no count-scattered-objects in the course");
    return lesson;
  };

  it("leaves a six-year-old to earn the early lessons", () => {
    // Placement gives them nothing, so `requires` is the only gate — which is the
    // behaviour every family had before this existed.
    expect(isUnlocked(gated(), {}, ALL, startingPointForAge(6))).toBe(false);
  });

  it("stops gating a seven-year-old behind work written for four-year-olds", () => {
    // The point of the feature. `count-scattered-objects` is banded 5-6 and sits
    // behind `corresponder`; a seven-year-old should not have to prove it.
    expect(isUnlocked(gated(), {}, ALL, startingPointForAge(7))).toBe(true);
  });

  it("opens an older beginner's own level without completing anything", () => {
    const at = startingPointForAge(12);
    const theirs = course().find((l) => l.levelNumber > at! && (l.requires?.length ?? 0) > 0);

    expect(theirs, "nothing gated left for a twelve-year-old").toBeDefined();
    expect(isUnlocked(theirs!, {}, ALL, at)).toBe(true);
  });
});
