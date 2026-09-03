import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
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


/**
 * Every line of a skill's own source, concatenated.
 *
 * A feature is a string in JSON and its reader is a string in a component, so
 * TypeScript sees no connection between them and only the text can be asked.
 * Crude on purpose: it cannot tell whether the flag changes anything worth
 * changing, only that somebody asked about it.
 */
const sourceUnder = (...dirs: string[]): string => {
  const parts: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) {
        parts.push(readFileSync(path, "utf8"));
      }
    }
  };
  for (const dir of dirs) walk(join(process.cwd(), dir));
  return parts.join("\n");
};

/**
 * The code that answers a feature question on every skill's behalf.
 *
 * Some switches are honoured once, centrally — the round hides the step tag,
 * the SDK swallows a vibration — precisely so that twenty skills do not each
 * have to remember. A flag read there is read.
 */
const sharedSource = (): string =>
  [
    sourceUnder("src/skills/kit", "src/skills/sdk"),
    /* A switch the app honours outside a round, on every skill's behalf. Not a
       directory: `src/lib` is the whole app, and scanning it would let any
       stray mention of an id pass for reading it. */
    readFileSync(join(process.cwd(), "src/lib/premiumLessons.ts"), "utf8"),
  ].join("\n");

/**
 * Whether a body of code asks whether this feature is on.
 *
 * Three spellings, one question: a skill asks `koda.config.isEnabled(...)`; the
 * SDK — which is what `config.isEnabled` *is* — asks it of itself under the name
 * `featureEnabled`; and code with no SDK to hand, because it runs outside a
 * round, asks the store directly with `SkillStoreAPI.isFeatureEnabled(id, ...)`.
 */
const asksAbout = (source: string, id: string): boolean =>
  new RegExp(`(?:isEnabled|featureEnabled)\\("${id}"`).test(source) ||
  new RegExp(`isFeatureEnabled\\([^)]*"${id}"`).test(source);

/** Feature ids the skill's own code asks about, in the order they first appear. */
const flagsAskedAbout = (source: string): string[] => [
  ...new Set([...source.matchAll(/config\.isEnabled\("([a-z0-9_]+)"/g)].map((m) => m[1])),
];

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

    /*
     * The Skill Manager shows one row per declared feature and a count of how
     * many are on. Both halves of that have to be true, and each half broke
     * once: counting shipped three switches nothing read — `tactile_pop` never
     * existed in any activity — and addition read `strategy_scaffold` in nine
     * activities without declaring it, so the scaffold was permanently on and
     * no parent could reach it.
     */
    describe("features the manager shows", () => {
      const source = sourceUnder(`src/skills/${manifest.id}`);
      const answered = `${source}\n${sharedSource()}`;

      it.each(features)("$id is read somewhere", ({ id }) => {
        expect(
          asksAbout(answered, id),
          `nothing asks about the "${id}" feature — not the skill, not the round`,
        ).toBe(true);
      });

      it("declares every flag its activities ask about", () => {
        const declared = new Set(features.map((f) => f.id));
        for (const asked of flagsAskedAbout(source)) {
          expect(
            declared.has(asked),
            `the skill reads "${asked}" but declares no such feature, so nothing can switch it`,
          ).toBe(true);
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
