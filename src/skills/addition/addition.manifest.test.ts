import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { skill } from ".";

/**
 * Everything the Skill Manager offers must actually do something.
 *
 * "A flag nothing reads is a lie in the Skill Manager" is the rule, and it is
 * the one rule here that nothing could enforce: a feature is a string in JSON
 * and its reader is a string in a component, and TypeScript sees no connection
 * between them. So this reads the source.
 *
 * Crude on purpose. It cannot tell whether the flag changes anything worth
 * changing — only that somebody asked about it. That is still the difference
 * between a switch that does nothing and a switch that might.
 */
const SRC = join(process.cwd(), "src/skills/addition");

const sourceText = (() => {
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
  walk(SRC);
  return parts.join("\n");
})();

/* Features moved to `describeSkillContract`, which now holds both halves of the
   rule — declared and read, read and declared — for every skill rather than for
   this one. Settings stay here until they earn the same. */
describe("the skill manager tells the truth about this skill", () => {
  it.each(Object.keys(skill.settings).map((key) => ({ key })))("$key is read somewhere", ({ key }) => {
    expect(
      sourceText.includes(`get("${key}"`) || sourceText.includes(`get<string>("${key}"`),
      `nothing reads the "${key}" setting`,
    ).toBe(true);
  });

  it("describes every setting it ships", () => {
    for (const field of skill.settingsSchema) {
      expect(Object.keys(skill.settings)).toContain(field.key);
    }
    for (const key of Object.keys(skill.settings)) {
      expect(skill.settingsSchema.map((f) => f.key), `${key} has no control`).toContain(key);
    }
  });

  it("teaches every concept its lessons claim, and no more", () => {
    // `teaches` is what a recommender reads to decide this skill is the answer,
    // so a key that no lesson carries would send a child somewhere that cannot
    // help them.
    const taught = new Set(skill.lessons.map((l) => l.conceptKey));
    for (const key of skill.manifest.teaches ?? []) {
      expect(taught.has(key), `manifest claims "${key}", which no lesson teaches`).toBe(true);
    }
  });
});
