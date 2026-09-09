import { afterEach, describe, expect, it } from "vitest";
import { skill } from ".";
import courseJson from "../../curriculum/course.json";
import { getCourseUnits } from "../../curriculum";
import { SkillStoreAPI } from "../../lib/skillStore";
import { DEFAULT_VIEWER } from "../viewer";

/**
 * The two numbers both called "level", held in step.
 *
 * `params.level` is multiplication's own 1..n ordering. The number a child sees
 * is the lesson's position across every unit of `course.json`. They agree only
 * while the course lists these lessons in `params.level` order, and nothing
 * enforces that on its own. Getting it wrong is silent: a lesson announces
 * itself as the wrong number and every other screen repeats it.
 *
 * The skill is built a phase at a time, so these compare the course against
 * whatever the skill currently defines rather than against 68.
 */

const refs = (courseJson.units as { lessons: string[] }[]).flatMap((u) => u.lessons);
const mine = refs.filter((ref) => ref.startsWith("multiplication/"));
const levelOf = (id: string) =>
  (skill.lessons.find((l) => l.id === id)!.params as { level: number }).level;

describe("multiplication sits in the course in its own order", () => {
  it("places every lesson the skill defines", () => {
    const placed = new Set(mine.map((ref) => ref.split("/")[1]));
    const defined = skill.lessons.map((l) => l.id);
    expect(placed.size).toBe(defined.length);
    for (const id of defined) expect(placed.has(id), `${id} is not in any unit`).toBe(true);
  });

  it("places each of them exactly once", () => {
    expect(new Set(mine).size, "a lesson appears in two units").toBe(mine.length);
  });

  it("lists them in the order the skill numbers them", () => {
    const levels = mine.map((ref) => levelOf(ref.split("/")[1]));
    expect(levels).toEqual([...levels].sort((a, b) => a - b));
    expect(levels[0]).toBe(1);
    expect(levels.at(-1)).toBe(skill.lessons.length);
  });

  it("numbers its own levels contiguously from one", () => {
    // A gap or a collision here reorders lessons silently; nothing throws.
    const levels = skill.lessons
      .map((l) => (l.params as { level: number }).level)
      .sort((a, b) => a - b);
    expect(levels).toEqual(levels.map((_, i) => i + 1));
  });

  it("sits in the course as one unbroken block", () => {
    const first = refs.findIndex((ref) => ref.startsWith("multiplication/"));
    const last = refs.length - 1 - [...refs].reverse().findIndex((ref) => ref.startsWith("multiplication/"));
    expect(refs.slice(first, last + 1).every((ref) => ref.startsWith("multiplication/"))).toBe(true);
  });

  it("starts after every lesson that came before it", () => {
    const first = refs.findIndex((ref) => ref.startsWith("multiplication/"));
    expect(first).toBeGreaterThan(0);
    expect(refs.slice(0, first).every((ref) => !ref.startsWith("multiplication/"))).toBe(true);
  });
});

/**
 * Switching the skill off takes its lessons with it.
 *
 * The one promise a child would find broken rather than a developer: a parent
 * turns multiplication off and its lessons stay on the Learn page, opening into
 * rounds from a skill that is supposed to be gone.
 */
describe("disabling the skill empties it out of the course", () => {
  /* An ordinary nine-year-old. The skill was a draft through the build and
     reached nobody but a developer; since Phase 17 it is published, so the
     learner who matters here is one without a developer flag. */
  const learner = { ...DEFAULT_VIEWER, age: 9, isDeveloper: false };
  const myLessons = (viewer = learner) =>
    getCourseUnits(viewer)
      .flatMap((unit) => unit.lessons)
      .filter((lesson) => lesson.skillId === "multiplication");

  afterEach(() => {
    if (!SkillStoreAPI.isSkillEnabled("multiplication")) SkillStoreAPI.toggleSkill("multiplication");
  });

  it("offers every lesson while it is on", () => {
    expect(myLessons()).toHaveLength(skill.lessons.length);
  });

  it("offers none while it is off", () => {
    SkillStoreAPI.toggleSkill("multiplication");
    expect(myLessons(), "a disabled skill still fills the Learn page").toHaveLength(0);
  });

  /*
   * Published, and therefore actually reaching a child.
   *
   * The inverse of what this asserted through the build. A skill that slipped
   * back to draft would empty itself off the Learn page for every learner who
   * is not a developer, and the only visible symptom would be lessons that
   * quietly stopped being there.
   */
  it("is published, so it reaches a learner who is not a developer", () => {
    expect(skill.manifest.status).toBe("published");
    expect(myLessons({ ...DEFAULT_VIEWER, age: 9, isDeveloper: false })).toHaveLength(skill.lessons.length);
  });
});
