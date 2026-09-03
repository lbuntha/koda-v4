import { afterEach, describe, expect, it } from "vitest";
import { skill } from ".";
import courseJson from "../../curriculum/course.json";
import { getCourseUnits } from "../../curriculum";
import { SkillStoreAPI } from "../../lib/skillStore";
import { DEFAULT_VIEWER } from "../viewer";

/**
 * The two numbers both called "level", held in step.
 *
 * `params.level` is subtraction's own 1..n ordering. The number a child sees is
 * the lesson's position across every unit of `course.json`. They agree only
 * while the course lists these lessons in `params.level` order, and nothing
 * enforces that on its own: the course belongs to the app, the levels belong to
 * the skill. Getting it wrong is silent — level 17 announces itself as
 * "Lesson 88" and every other screen repeats the wrong number.
 *
 * The skill is still being built a phase at a time, so these tests compare the
 * course against whatever the skill currently defines rather than against 63.
 */

const refs = (courseJson.units as { lessons: string[] }[]).flatMap((u) => u.lessons);
const mine = refs.filter((ref) => ref.startsWith("subtraction/"));
const levelOf = (id: string) =>
  (skill.lessons.find((l) => l.id === id)!.params as { level: number }).level;

describe("subtraction sits in the course in its own order", () => {
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

  it("sits in the course as one unbroken block", () => {
    // Appended, never interleaved: a unit slipped in among another skill's
    // would renumber lessons on both sides of it, and a child's saved progress
    // points at a number.
    const first = refs.findIndex((ref) => ref.startsWith("subtraction/"));
    const last = refs.length - 1 - [...refs].reverse().findIndex((ref) => ref.startsWith("subtraction/"));
    expect(refs.slice(first, last + 1).every((ref) => ref.startsWith("subtraction/"))).toBe(true);
  });

  it("starts after every lesson that came before it", () => {
    const first = refs.findIndex((ref) => ref.startsWith("subtraction/"));
    expect(first).toBeGreaterThan(0);
    expect(refs.slice(0, first).every((ref) => !ref.startsWith("subtraction/"))).toBe(true);
    expect(refs.at(-1)!.startsWith("subtraction/")).toBe(true);
  });
});

/**
 * Switching the skill off takes its lessons with it.
 *
 * The Skill Manager promises exactly this, and it is the one promise a child
 * would find broken rather than a developer: a parent turns subtraction off and
 * its lessons stay on the Learn page, opening into rounds from a skill that is
 * supposed to be gone.
 */
describe("disabling the skill empties it out of the course", () => {
  // Old enough for every band the skill teaches, and a developer because the
  // manifest stays at `status: "draft"` until the final publish phase.
  const learner = { ...DEFAULT_VIEWER, age: 9, isDeveloper: true };
  const subtractionLessons = (viewer = learner) =>
    getCourseUnits(viewer)
      .flatMap((unit) => unit.lessons)
      .filter((lesson) => lesson.skillId === "subtraction");

  afterEach(() => {
    if (!SkillStoreAPI.isSkillEnabled("subtraction")) SkillStoreAPI.toggleSkill("subtraction");
  });

  it("offers every lesson while it is on", () => {
    expect(subtractionLessons()).toHaveLength(skill.lessons.length);
  });

  it("offers none while it is off", () => {
    SkillStoreAPI.toggleSkill("subtraction");
    expect(subtractionLessons(), "a disabled skill still fills the Learn page").toHaveLength(0);
  });

  it("stays out of sight for a learner who is not a developer", () => {
    expect(subtractionLessons({ ...learner, isDeveloper: false })).toHaveLength(0);
  });
});
