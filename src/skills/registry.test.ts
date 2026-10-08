import { describe, expect, it } from "vitest";
import { SKILLS, getSkill, loadSkill, loadedSkill, resolveActivity } from "./registry";

describe("skills load in two halves", () => {
  it("describes every skill before any game is loaded", () => {
    expect(SKILLS.map((skill) => skill.manifest.id)).toEqual([
      "counting", "addition", "subtraction", "multiplication", "division",
      "fractions", "observation", "bottle-sort", "color-sweeper",
    ]);
    for (const skill of SKILLS) expect(skill.lessons.length, skill.manifest.id).toBeGreaterThan(0);
  });

  it("resolves an activity only once its skill has loaded", async () => {
    const ref = "addition/tray";
    if (!loadedSkill("addition")) expect(resolveActivity(ref)).toBeUndefined();
    const skill = await loadSkill("addition");
    expect(skill).toBeDefined();
    expect(resolveActivity(ref)?.component).toBeTypeOf("function");
    expect(await loadSkill("addition"), "loaded once and kept").toBe(skill);
  });

  it("gives the same description as the loaded skill, so the two cannot drift", async () => {
    for (const info of SKILLS) {
      const full = (await loadSkill(info.manifest.id))!;
      expect(full.manifest, info.manifest.id).toEqual(info.manifest);
      expect(full.lessons, info.manifest.id).toEqual(info.lessons);
      expect(full.features, info.manifest.id).toEqual(info.features);
      // Every lesson points at a game its skill (or another loaded one) really has.
      for (const lesson of info.lessons) {
        const [owner] = lesson.activity.split("/");
        await loadSkill(owner);
        expect(resolveActivity(lesson.activity), `${info.manifest.id}/${lesson.id} → ${lesson.activity}`).toBeDefined();
      }
    }
  });

  it("answers an unknown skill with nothing rather than an error", async () => {
    expect(getSkill("no-such-skill")).toBeUndefined();
    await expect(loadSkill("no-such-skill")).resolves.toBeUndefined();
    expect(resolveActivity("no-such-skill/tray")).toBeUndefined();
  });
});
