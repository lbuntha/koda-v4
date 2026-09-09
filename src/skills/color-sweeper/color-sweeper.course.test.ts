import { afterEach, describe, expect, it } from "vitest";
import { skill } from ".";
import courseJson from "../../curriculum/course.json";
import { getCourseUnits } from "../../curriculum";
import { SkillStoreAPI } from "../../lib/skillStore";
import { DEFAULT_VIEWER } from "../viewer";

/**
 * The two numbers both called "level", held in step.
 *
 * `params.level` is this skill's own 1..n ordering. The number a child sees is
 * the lesson's position across every unit of `course.json`. They agree only
 * while the course lists these lessons in `params.level` order, and nothing
 * enforces that on its own. Getting it wrong is silent.
 *
 * The skill is built a phase at a time, so these compare the course against
 * whatever the skill currently defines rather than against 40.
 */

const refs = (courseJson.units as { lessons: string[] }[]).flatMap((u) => u.lessons);
const mine = refs.filter((ref) => ref.startsWith("color-sweeper/"));
const levelOf = (id: string) =>
  (skill.lessons.find((l) => l.id === id)!.params as { level: number }).level;

describe("color sweeper sits in the course in its own order", () => {
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

  it("sits in the course as one unbroken block, after everything before it", () => {
    const first = refs.findIndex((ref) => ref.startsWith("color-sweeper/"));
    const last = refs.length - 1 - [...refs].reverse().findIndex((ref) => ref.startsWith("color-sweeper/"));
    expect(first).toBeGreaterThan(0);
    expect(refs.slice(first, last + 1).every((ref) => ref.startsWith("color-sweeper/"))).toBe(true);
  });

  it("numbers its own levels contiguously from one", () => {
    const levels = skill.lessons
      .map((l) => (l.params as { level: number }).level)
      .sort((a, b) => a - b);
    expect(levels).toEqual(levels.map((_, i) => i + 1));
  });
});

/**
 * A draft reaches a developer and nobody else.
 *
 * The state this skill should be in for the whole build: five levels that
 * teach reading and cannot yet solve anything. A skill that slipped to
 * published would put an unfinished puzzle on a child's Learn page, and the
 * only visible sign would be lessons that appeared.
 */
describe("visibility while the skill is a draft", () => {
  const child = { ...DEFAULT_VIEWER, age: 9, isDeveloper: false };
  const developer = { ...DEFAULT_VIEWER, age: 9, isDeveloper: true, showAllSkills: false };
  const myLessons = (viewer: typeof child) =>
    getCourseUnits(viewer)
      .flatMap((unit) => unit.lessons)
      .filter((lesson) => lesson.skillId === "color-sweeper");

  afterEach(() => {
    if (!SkillStoreAPI.isSkillEnabled("color-sweeper")) SkillStoreAPI.toggleSkill("color-sweeper");
  });

  it("is a draft, and so reaches nobody who is not a developer", () => {
    expect(skill.manifest.status).toBe("draft");
    expect(myLessons(child)).toHaveLength(0);
  });

  it("offers every lesson to a developer previewing it", () => {
    expect(myLessons(developer)).toHaveLength(skill.lessons.length);
  });

  it("empties out of the course when it is switched off, preview or not", () => {
    SkillStoreAPI.toggleSkill("color-sweeper");
    expect(myLessons(developer), "a disabled skill still fills the Learn page").toHaveLength(0);
  });
});
