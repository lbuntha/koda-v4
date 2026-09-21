import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { skill } from ".";

/**
 * Every dial in the Skill Manager must actually reach something.
 *
 * Addition has had this rule for a long time; counting never did, and the cost
 * was five settings that did nothing. Four of them — the step-label fields —
 * were read by four *other* skills' chrome helpers and by nothing in counting,
 * so a parent could rename "Warm-up Exercise", see the chip keep its old name,
 * and have no way to tell that from a bug. The fifth, "Tap pop scale", drove a
 * CSS variable that no code has ever set.
 *
 * A setting the Skill Manager offers and the app ignores is worse than a
 * missing feature: a missing feature is honest.
 */
const ROOT = process.cwd();
const fromRoot = (path: string) => readFileSync(join(ROOT, path), "utf8");

const SRC = join(ROOT, "src/skills/counting");

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
  /*
   * The files that honour a setting on every skill's behalf, named one by one.
   *
   * Named rather than scanned, so a stray mention of a key somewhere in the app
   * cannot pass for reading it — the same line addition's manifest test holds.
   * That these exist at all is the point: a setting read by shared chrome is
   * read once for everybody, which is why counting's step labels work now and
   * did not before.
   */
  parts.push(fromRoot("src/skills/kit/chrome/SkillRound.tsx")); // the step labels
  parts.push(fromRoot("src/skills/kit/round/useGuide.ts")); // the guide's patience
  parts.push(fromRoot("src/skills/sdk/createKodaSDK.ts")); // haptic strength
  parts.push(fromRoot("src/lib/premiumLessons.ts")); // how many lessons are free
  return parts.join("\n");
})();

describe("the skill manager tells the truth about counting", () => {
  it.each(Object.keys(skill.settings).map((key) => ({ key })))("$key is read somewhere", ({ key }) => {
    expect(
      sourceText.includes(`"${key}"`),
      `nothing reads "${key}", so moving that control changes nothing a child sees`,
    ).toBe(true);
  });

  it("gives every setting a control, and every control a setting", () => {
    const controls = new Set(skill.settingsSchema.map((f) => f.key));
    for (const key of Object.keys(skill.settings)) {
      expect(controls.has(key), `${key} has a value but no control`).toBe(true);
    }
    for (const field of skill.settingsSchema) {
      expect(
        Object.prototype.hasOwnProperty.call(skill.settings, field.key),
        `${field.key} has a control but no default`,
      ).toBe(true);
    }
  });
});
