import { describe, expect, it } from "vitest";

import course from "../../curriculum/course.json";
import { skill } from ".";
import { resolveLesson, resolveActivity } from "../registry";

/**
 * Where fractions sits in the course.
 *
 * Built, tested and invisible is the failure this file exists to stop: a skill
 * registered in `registry.ts` and left out of `course.json` works perfectly and
 * no child ever reaches it.
 */

const refs = course.units.flatMap((u) => u.lessons).filter((r) => r.startsWith("fractions/"));

describe("every lesson reaches a learner", () => {
  it("places all sixty-nine, once each", () => {
    expect(skill.lessons).toHaveLength(69);
    expect(refs).toHaveLength(69);
    expect(new Set(refs).size).toBe(69);
  });

  it("places exactly the lessons the skill has, and no ghosts", () => {
    const own = skill.lessons.map((l) => `fractions/${l.id}`).sort();
    expect([...refs].sort()).toEqual(own);
  });

  it("resolves every reference to a real lesson and a real activity", () => {
    for (const ref of refs) {
      const lesson = resolveLesson(ref);
      expect(lesson, ref).toBeDefined();
      expect(resolveActivity(lesson?.activity ?? ""), `${ref} -> ${lesson?.activity}`).toBeDefined();
    }
  });

  it("keeps them in teaching order inside each unit", () => {
    const levelOf = new Map(
      skill.lessons.map((l) => [`fractions/${l.id}`, (l.params as { level: number }).level]),
    );
    for (const unit of course.units) {
      const own = unit.lessons.filter((r) => r.startsWith("fractions/"));
      const levels = own.map((r) => levelOf.get(r) as number);
      expect([...levels].sort((a, b) => a - b), unit.title).toEqual(levels);
    }
  });
});

describe("teaching and practice are separate units", () => {
  const practiceIds = new Set(
    skill.lessons
      .filter((l) => (l.params as { question?: { practice?: boolean } })?.question?.practice)
      .map((l) => `fractions/${l.id}`),
  );

  it("never mixes a practice lesson into a teaching unit", () => {
    for (const unit of course.units) {
      const own = unit.lessons.filter((r) => r.startsWith("fractions/"));
      if (own.length === 0) continue;
      const practice = own.filter((r) => practiceIds.has(r));
      expect(
        practice.length === 0 || practice.length === own.length,
        `${unit.title} mixes teaching and practice`,
      ).toBe(true);
    }
  });

  it("puts every practice unit after every teaching unit", () => {
    const index = new Map(course.units.map((u, i) => [u.id, i]));
    const teaching: number[] = [];
    const practising: number[] = [];
    for (const unit of course.units) {
      const own = unit.lessons.filter((r) => r.startsWith("fractions/"));
      if (own.length === 0) continue;
      (own.every((r) => practiceIds.has(r)) ? practising : teaching).push(index.get(unit.id) as number);
    }
    expect(Math.max(...teaching)).toBeLessThan(Math.min(...practising));
  });
});

describe("the units read as a course, not as a dump", () => {
  it("gives every fractions unit a title, a description and an icon", () => {
    for (const unit of course.units) {
      if (!unit.lessons.some((r) => r.startsWith("fractions/"))) continue;
      expect(unit.title, unit.id).toMatch(/^Unit \d+: /);
      expect(unit.description.split(/\s+/).length, unit.id).toBeGreaterThanOrEqual(5);
      expect(unit.icon, unit.id).toBeTruthy();
    }
  });

  it("holds every unit to a sane size", () => {
    for (const unit of course.units) {
      const own = unit.lessons.filter((r) => r.startsWith("fractions/"));
      if (own.length === 0) continue;
      expect(own.length, unit.title).toBeGreaterThanOrEqual(2);
      expect(own.length, unit.title).toBeLessThanOrEqual(8);
    }
  });

  it("numbers the units without a gap", () => {
    const numbers = course.units.map((u) => u.unitNumber);
    expect(numbers).toEqual(numbers.map((_, i) => i + 1));
  });
});
