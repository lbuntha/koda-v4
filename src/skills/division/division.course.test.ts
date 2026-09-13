import { describe, expect, it } from "vitest";

import course from "../../curriculum/course.json";
import { skill } from ".";
import { resolveLesson, resolveActivity } from "../registry";

/**
 * Where division sits in the course.
 *
 * Built, tested and invisible is the failure this file exists to stop: a skill
 * registered in `registry.ts` and left out of `course.json` works perfectly and
 * no child ever reaches it.
 */

const refs = course.units.flatMap((u) => u.lessons).filter((r) => r.startsWith("division/"));

describe("every lesson reaches a learner", () => {
  it("places all sixty-eight, once each", () => {
    expect(skill.lessons).toHaveLength(68);
    expect(refs).toHaveLength(68);
    expect(new Set(refs).size).toBe(68);
  });

  it("places exactly the lessons the skill has, and no ghosts", () => {
    const own = skill.lessons.map((l) => `division/${l.id}`).sort();
    expect([...refs].sort()).toEqual(own);
  });

  it("resolves every reference to a real lesson and a real activity", () => {
    for (const ref of refs) {
      const lesson = resolveLesson(ref);
      expect(lesson, ref).toBeDefined();
      expect(resolveActivity(lesson?.activity ?? ""), `${ref} -> ${lesson?.activity}`).toBeDefined();
    }
  });
});

describe("teaching and practice are separate units", () => {
  it("never mixes a practice lesson into a teaching unit", () => {
    const practiceIds = new Set(
      skill.lessons
        .filter((l) => (l.params as { question?: { practice?: boolean } })?.question?.practice)
        .map((l) => `division/${l.id}`),
    );
    for (const unit of course.units) {
      const own = unit.lessons.filter((r) => r.startsWith("division/"));
      if (own.length === 0) continue;
      const practice = own.filter((r) => practiceIds.has(r));
      expect(
        practice.length === 0 || practice.length === own.length,
        `${unit.title} mixes teaching and practice`,
      ).toBe(true);
    }
  });

  it("puts every practice unit after every teaching unit", () => {
    const practiceIds = new Set(
      skill.lessons
        .filter((l) => (l.params as { question?: { practice?: boolean } })?.question?.practice)
        .map((l) => `division/${l.id}`),
    );
    const numbers = course.units
      .filter((u) => u.lessons.some((r) => r.startsWith("division/")))
      .map((u) => ({
        n: u.unitNumber,
        practice: u.lessons.every((r) => practiceIds.has(r)),
      }));
    const lastTeaching = Math.max(...numbers.filter((u) => !u.practice).map((u) => u.n));
    const firstPractice = Math.min(...numbers.filter((u) => u.practice).map((u) => u.n));
    expect(firstPractice).toBeGreaterThan(lastTeaching);
  });
});

describe("course order follows the lesson order", () => {
  it("never places a lesson before one it depends on", () => {
    const position = new Map(refs.map((ref, i) => [ref, i]));
    const taught = new Map<string, number>();
    for (const ref of refs) {
      const lesson = resolveLesson(ref);
      if (lesson?.conceptKey && !taught.has(lesson.conceptKey)) {
        taught.set(lesson.conceptKey, position.get(ref) as number);
      }
    }
    for (const ref of refs) {
      const lesson = resolveLesson(ref);
      const at = position.get(ref) as number;
      for (const need of lesson?.requires ?? []) {
        const taughtAt = taught.get(need);
        // A prerequisite met by another skill is not in this map at all, and
        // the manifest's `requires` is what covers those.
        if (taughtAt === undefined) {
          expect(skill.manifest.requires, `${ref} needs ${need}`).toContain(need);
        } else {
          expect(taughtAt, `${ref} needs ${need}, taught later`).toBeLessThan(at);
        }
      }
    }
  });
});
