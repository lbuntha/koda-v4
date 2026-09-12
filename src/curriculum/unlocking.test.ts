import { describe, expect, it } from "vitest";

import {
  blockedFrom,
  getCourseLessons,
  isUnlocked,
  satisfiedConcepts,
  unlockedBy,
} from "./index";
import type { Viewer } from "../skills/viewer";

/**
 * What the padlocks are allowed to say.
 *
 * These are gating rules, not rendering: getting them wrong either strands a
 * child outside work they are ready for, or hands them a lesson they have no
 * foundation for. The previous implementation asked "is the lesson before this
 * one finished?", which silently collapsed a branching curriculum into a queue
 * — so the cases below are mostly about branching.
 */

/* Old enough for every lesson the counting skill ships, so age gating never
   confounds a test about prerequisites. */
const viewer: Viewer = { age: 7, showAllSkills: true } as Viewer;

const lessons = getCourseLessons(viewer);
const bySlug = (id: string) => {
  const lesson = lessons.find((l) => l.id === id);
  if (!lesson) throw new Error(`no lesson "${id}" in the course`);
  return lesson;
};

/** Star counts, keyed the way the app stores them. */
const completing = (...ids: string[]): Record<number, number> =>
  Object.fromEntries(ids.map((id) => [bySlug(id).levelNumber, 3]));

describe("isUnlocked", () => {
  it("opens every lesson that declares no prerequisites", () => {
    const none = {};
    const roots = lessons.filter((l) => !l.requires?.length);

    expect(roots.length).toBeGreaterThan(1);
    for (const root of roots) {
      expect(isUnlocked(root, none, viewer)).toBe(true);
    }
  });

  it("opens a later root without the lessons listed above it", () => {
    /* `quick-dice-patterns` is fourth in the counting skill and requires
       nothing. Under per-index gating it sat behind three unrelated lessons,
       which cost a beginner one of their two ways in. */
    expect(isUnlocked(bySlug("quick-dice-patterns"), {}, viewer)).toBe(true);
  });

  it("keeps a lesson shut until its prerequisite concept is done", () => {
    const scattered = bySlug("count-scattered-objects");

    expect(isUnlocked(scattered, {}, viewer)).toBe(false);
    expect(isUnlocked(scattered, completing("count-in-a-row"), viewer)).toBe(true);
  });

  it("needs every prerequisite of a lesson that has more than one", () => {
    /* `two-color-groups` requires both `conceptual-subitizer` and `counter`.
       Either alone must not be enough, or a child meets part-whole work with
       half its foundation. */
    const twoColour = bySlug("two-color-groups");
    const viaSubitising = completing("count-in-a-row", "quick-dice-patterns", "quick-dot-groups");
    const viaCounting = completing("count-in-a-row", "count-scattered-objects");

    expect(isUnlocked(twoColour, viaSubitising, viewer)).toBe(false);
    expect(isUnlocked(twoColour, viaCounting, viewer)).toBe(false);
    expect(isUnlocked(twoColour, { ...viaSubitising, ...viaCounting }, viewer)).toBe(true);
  });

  it("opens both branches that a single concept feeds", () => {
    /* `counter` unlocks comparison and skip counting at once. A queue can only
       ever offer one of them, which is the behaviour this replaced. */
    const afterCounter = completing("count-in-a-row", "count-scattered-objects");

    expect(isUnlocked(bySlug("comparing-two-groups"), afterCounter, viewer)).toBe(true);
    expect(isUnlocked(bySlug("skip-counting-by-2s-and-5s"), afterCounter, viewer)).toBe(true);
  });

  it("counts a concept as satisfied on completion, not on mastery", () => {
    /* Mastery needs eight first attempts across two separate days. Gating on it
       would leave a child who has just played a lesson perfectly still locked
       out until the day after tomorrow. One completed round is the bar here. */
    const justPlayedOnce = { [bySlug("count-in-a-row").levelNumber]: 1 };

    expect(satisfiedConcepts(justPlayedOnce, viewer).has("corresponder")).toBe(true);
    expect(isUnlocked(bySlug("count-scattered-objects"), justPlayedOnce, viewer)).toBe(true);
  });

  it("leaves a completed lesson open whatever its prerequisites say", () => {
    /* A curriculum edit must never strand a child outside something they have
       already done. */
    const deep = bySlug("build-numbers-with-hundreds-tens-ones");

    expect(isUnlocked(deep, completing("build-numbers-with-hundreds-tens-ones"), viewer)).toBe(true);
  });
});

describe("a child placed past the early work", () => {
  /**
   * Placement opens doors; it never claims anybody walked through them.
   *
   * The distinction these tests protect is the one the whole design turns on:
   * a placed lesson is *available* and still *unpractised*. Writing it as
   * completion instead would have been fewer lines and would have made the
   * parent's report say a child had mastered work they have never seen.
   */
  const lastOfUnitOne = Math.max(
    ...lessons.filter((l) => l.levelNumber <= 4).map((l) => l.levelNumber),
  );

  it("opens everything at or below the starting point", () => {
    for (const lesson of lessons.filter((l) => l.levelNumber <= lastOfUnitOne)) {
      expect(isUnlocked(lesson, {}, viewer, lastOfUnitOne)).toBe(true);
    }
  });

  it("opens what those lessons were the prerequisite for", () => {
    // The point of placing a child: the lesson *after* the skipped run has to
    // become reachable, or they are started at a unit with nothing open in it.
    const next = lessons.find(
      (l) => l.levelNumber > lastOfUnitOne && (l.requires?.length ?? 0) > 0,
    );
    expect(next, "the course has a gated lesson after unit one").toBeTruthy();

    expect(isUnlocked(next!, {}, viewer, null)).toBe(false);
    expect(isUnlocked(next!, {}, viewer, lastOfUnitOne)).toBe(true);
  });

  it("does not open the whole course", () => {
    const far = lessons[lessons.length - 1];
    expect(far.levelNumber).toBeGreaterThan(lastOfUnitOne + 1);
    // Something well past the starting point, whose prerequisites are not in
    // the skipped run, stays shut.
    const stillShut = lessons.filter(
      (l) =>
        l.levelNumber > lastOfUnitOne &&
        !isUnlocked(l, {}, viewer, lastOfUnitOne),
    );
    expect(stillShut.length).toBeGreaterThan(0);
  });

  it("counts a skipped concept as satisfied without counting it as done", () => {
    const satisfied = satisfiedConcepts({}, viewer, lastOfUnitOne);
    const skipped = lessons.filter((l) => l.levelNumber <= lastOfUnitOne && l.conceptKey);

    expect(skipped.length).toBeGreaterThan(0);
    for (const lesson of skipped) {
      expect(satisfied.has(lesson.conceptKey!)).toBe(true);
    }

    // …and nothing was written as completion. `completed` is still empty, which
    // is what keeps the parent's report truthful about what a child has done.
    expect(satisfiedConcepts({}, viewer, null).size).toBe(0);
  });

  it("changes nothing for a child who was not placed", () => {
    const gated = lessons.find((l) => (l.requires?.length ?? 0) > 0)!;
    expect(isUnlocked(gated, {}, viewer, null)).toBe(false);
  });
});

/**
 * What a padlock is able to say for itself.
 *
 * Colour Sweeper is the case these were written for: its first lesson requires
 * a concept taught in counting, so a learner who had not been through counting
 * met forty grey stones and no route out of them.
 */
describe("unlockedBy", () => {
  it("says nothing about a lesson that is already open", () => {
    expect(unlockedBy(bySlug("count-in-a-row"), {}, viewer, null)).toBeUndefined();
  });

  it("names the lesson that opens a locked one", () => {
    const scattered = bySlug("count-scattered-objects");
    expect(unlockedBy(scattered, {}, viewer, null)?.id).toBe("count-in-a-row");
  });

  it("walks past a prerequisite that is itself locked", () => {
    /* `touching-tiles` needs `counter`, which is taught by a lesson that needs
       `corresponder`. Answering "Counting Scattered Objects" would have moved
       the padlock rather than explained it. */
    const touching = bySlug("touching-tiles");
    const opens = unlockedBy(touching, {}, viewer, null);

    expect(opens?.id).toBe("count-in-a-row");
    expect(isUnlocked(opens!, {}, viewer, null)).toBe(true);
  });

  it("crosses into another skill, because that is where the wall usually is", () => {
    const touching = bySlug("touching-tiles");
    expect(touching.skillId).toBe("color-sweeper");
    expect(unlockedBy(touching, {}, viewer, null)?.skillId).toBe("counting");
  });

  it("stops pointing anywhere once the prerequisite is done", () => {
    const done = completing("count-in-a-row", "count-scattered-objects");
    expect(unlockedBy(bySlug("touching-tiles"), done, viewer, null)).toBeUndefined();
  });

  it("always answers with something the learner can open today", () => {
    /* The whole promise. Every locked lesson in the course, from a standing
       start, has to lead to a lesson that is playable now — a route that ends
       in another padlock is the dead end this exists to remove. */
    const locked = lessons.filter((l) => !isUnlocked(l, {}, viewer, null));
    expect(locked.length).toBeGreaterThan(50);

    for (const lesson of locked) {
      const opens = unlockedBy(lesson, {}, viewer, null);
      expect(opens, `${lesson.skillId}/${lesson.id} has no way in`).toBeDefined();
      expect(isUnlocked(opens!, {}, viewer, null), `${opens!.id} is itself locked`).toBe(true);
    }
  });
});

/**
 * Locked, or finished? The page that could not tell.
 *
 * Both states hand back no next lesson, and Colour Sweeper showed what reading
 * one as the other costs: "Every lesson complete" printed over a path where
 * nothing had ever been played.
 */
describe("blockedFrom", () => {
  const sweeper = lessons.filter((l) => l.skillId === "color-sweeper");
  const counting = lessons.filter((l) => l.skillId === "counting");

  it("names the way in when none of the path has opened", () => {
    expect(sweeper.length).toBeGreaterThan(0);
    expect(blockedFrom(sweeper, {}, viewer, null)?.id).toBe("count-in-a-row");
  });

  it("says nothing when the learner has somewhere to go", () => {
    expect(blockedFrom(counting, {}, viewer, null)).toBeUndefined();
  });

  it("says nothing about a path that is genuinely finished", () => {
    // Every teaching lesson starred: there is no next lesson here either, and
    // this is the state the page was right about all along.
    const everyTaught = Object.fromEntries(counting.map((l) => [l.levelNumber, 3]));
    expect(blockedFrom(counting, everyTaught, viewer, null)).toBeUndefined();
  });

  it("stops blocking once the prerequisite is done", () => {
    const done = completing("count-in-a-row", "count-scattered-objects");
    expect(blockedFrom(sweeper, done, viewer, null)).toBeUndefined();
  });
});
