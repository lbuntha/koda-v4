import { describe, expect, it } from "vitest";
import type { Lesson, Skill } from "../../types";

/**
 * The tests every skill must pass, written once.
 *
 * A skill is a folder of data — a manifest, a lessons file, a map of activities
 * — and almost everything that can go wrong with it is a broken reference
 * rather than broken logic: a lesson pointing at an activity that was renamed,
 * a `requires` naming a concept no lesson teaches, two lessons claiming level 7.
 * TypeScript cannot catch any of those, because they are strings inside JSON.
 * Every one of them shipped at least once during counting's build.
 *
 * So a skill's test file is one line:
 *
 *   describeSkillContract(skill);
 *
 * and it inherits the whole suite. When a rule is added here, every skill is
 * held to it on the next run — which is the only way a standard survives having
 * twenty skills instead of two.
 */

const SEMVER = /^\d+\.\d+\.\d+/;
const ACTIVITY_REF = /^[a-z0-9-]+\/[a-z0-9-]+$/;

/** Level number of a lesson. Lives in params so the host can re-order without
 *  rewriting lesson ids. */
const levelOf = (lesson: Lesson): unknown =>
  (lesson.params as { level?: unknown } | undefined)?.level;

export function describeSkillContract(skill: Skill): void {
  const { manifest, lessons, activities, features, settings, settingsSchema } = skill;

  describe(`skill contract: ${manifest.id}`, () => {
    describe("manifest", () => {
      it("has an id, name and description", () => {
        expect(manifest.id).toMatch(/^[a-z0-9-]+$/);
        expect(manifest.name.trim()).not.toBe("");
        expect(manifest.description.trim()).not.toBe("");
      });

      it("carries a semver version", () => {
        expect(manifest.version).toMatch(SEMVER);
      });

      it("is draft or published", () => {
        expect(["draft", "published"]).toContain(manifest.status);
      });

      it("names an age range that runs low to high", () => {
        const [low, high] = manifest.audience.ages;
        expect(low).toBeGreaterThan(0);
        expect(high).toBeGreaterThanOrEqual(low);
      });
    });

    describe("activities", () => {
      it("has at least one", () => {
        expect(Object.keys(activities).length).toBeGreaterThan(0);
      });

      it("keys the registry by each activity's own id", () => {
        for (const [key, activity] of Object.entries(activities)) {
          expect(activity.id).toBe(key);
        }
      });

      it("gives every activity a name, a component and default params", () => {
        for (const activity of Object.values(activities)) {
          expect(activity.name.trim()).not.toBe("");
          expect(typeof activity.component).toBe("function");
          expect(activity.defaultParams).toBeTypeOf("object");
        }
      });
    });

    describe("lessons", () => {
      it("has at least one", () => {
        expect(lessons.length).toBeGreaterThan(0);
      });

      it("gives every lesson an id, title and concept", () => {
        for (const lesson of lessons) {
          expect(lesson.id.trim(), `lesson ${lesson.id}`).not.toBe("");
          expect(lesson.title.trim(), `lesson ${lesson.id}`).not.toBe("");
          expect(lesson.concept.trim(), `lesson ${lesson.id}`).not.toBe("");
        }
      });

      it("uses each lesson id once", () => {
        const ids = lessons.map((l) => l.id);
        expect(new Set(ids).size).toBe(ids.length);
      });

      it("gives every lesson a distinct level number", () => {
        const levels = lessons.map(levelOf);
        for (const [i, level] of levels.entries()) {
          expect(level, `lesson ${lessons[i].id} has no params.level`).toBeTypeOf("number");
        }
        expect(new Set(levels).size, "two lessons claim the same level").toBe(levels.length);
      });

      it("numbers levels 1..n with no gaps", () => {
        const levels = (lessons.map(levelOf) as number[]).slice().sort((a, b) => a - b);
        expect(levels).toEqual(levels.map((_, i) => i + 1));
      });

      it("points every lesson at a well-formed activity reference", () => {
        for (const lesson of lessons) {
          expect(lesson.activity, `lesson ${lesson.id}`).toMatch(ACTIVITY_REF);
        }
      });

      it("resolves every activity reference that belongs to this skill", () => {
        for (const lesson of lessons) {
          const [skillId, activityId] = lesson.activity.split("/");
          if (skillId !== manifest.id) continue; // another skill's activity
          expect(
            activities[activityId],
            `lesson ${lesson.id} wants ${lesson.activity}, which this skill does not define`,
          ).toBeDefined();
        }
      });

      it("gives every lesson a concept key to file its evidence under", () => {
        for (const lesson of lessons) {
          expect(lesson.conceptKey, `lesson ${lesson.id}`).toBeTruthy();
        }
      });

      it("only requires concepts something earlier teaches", () => {
        // A `requires` naming a concept no earlier lesson carries is a lesson
        // nothing can ever unlock — silent, and invisible until a child is stuck.
        const taughtSoFar = new Set(manifest.requires ?? []);
        const inOrder = [...lessons].sort(
          (a, b) => (levelOf(a) as number) - (levelOf(b) as number),
        );
        for (const lesson of inOrder) {
          for (const need of lesson.requires ?? []) {
            expect(
              taughtSoFar.has(need),
              `lesson ${lesson.id} requires "${need}", which nothing before it teaches`,
            ).toBe(true);
          }
          if (lesson.conceptKey) taughtSoFar.add(lesson.conceptKey);
        }
      });
    });

    describe("settings", () => {
      it("uses each feature id once", () => {
        const ids = features.map((f) => f.id);
        expect(new Set(ids).size).toBe(ids.length);
      });

      it("describes only settings the skill actually has", () => {
        for (const field of settingsSchema) {
          expect(
            Object.prototype.hasOwnProperty.call(settings, field.key),
            `settingsSchema describes "${field.key}", which is not in settings`,
          ).toBe(true);
        }
      });
    });
  });
}
