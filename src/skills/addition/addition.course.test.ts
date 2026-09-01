import { describe, expect, it } from "vitest";
import { skill } from ".";
import courseJson from "../../curriculum/course.json";

/**
 * The two numbers both called "level", held in step.
 *
 * `params.level` is the skill's own ordering, which the contract test keeps at
 * 1..n. The number a child sees is the lesson's position in `course.json`,
 * counted across every unit. They agree only if the course lists this skill's
 * lessons in `params.level` order — and nothing enforces that, because the
 * course belongs to the app and the levels belong to the skill.
 *
 * Getting it wrong is silent: a lesson the skill calls level 7 tells the child
 * "Lesson 22 of 67" and every other screen agrees with it.
 */

const refs = (courseJson.units as { lessons: string[] }[]).flatMap((u) => u.lessons);
const mine = refs.filter((ref) => ref.startsWith("addition/"));
const levelOf = (id: string) =>
  (skill.lessons.find((l) => l.id === id)!.params as { level: number }).level;

describe("addition sits in the course in its own order", () => {
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

  it("comes after everything that was already in the course", () => {
    // Appended, never inserted: a unit slipped in earlier would renumber every
    // lesson after it, and a child's saved progress points at a number.
    const firstMine = refs.findIndex((ref) => ref.startsWith("addition/"));
    expect(refs.slice(firstMine).every((ref) => ref.startsWith("addition/"))).toBe(true);
  });
});
