import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Renaming a skill without renaming the skill.
 *
 * A deployment calls Counting Quest whatever suits its learners, and the code
 * keeps calling it what the manifest says. The two have to be different fields:
 * `name` is re-seeded from the manifest on every boot, so a rename written
 * there survives exactly until the next deploy — which is the bug this is
 * mostly here to prevent coming back.
 */

const bundled = {
  id: "counting",
  name: "Counting Quest",
  version: "1.0.0",
  description: "Count",
  category: "core" as const,
  author: "Koda",
  isEnabled: true,
  iconName: "Sparkles",
  tagline: "Count, compare and see small amounts at a glance.",
  features: [{ id: "sound", name: "Sound", description: "Sound", isEnabled: true }],
  settings: { speed: 1 },
};

beforeEach(() => {
  vi.resetModules();
  localStorage.clear();
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")));
});

describe("what to call a skill", () => {
  it("uses the manifest's name until somebody says otherwise", async () => {
    const { skillTitle } = await import("./skillStore");

    expect(skillTitle("Counting Quest")).toBe("Counting Quest");
    expect(skillTitle("Counting Quest", {})).toBe("Counting Quest");
    // Blank is not a name. A skill with an empty title would be a nameless row
    // on the Learn page, which reads as the app having lost it.
    expect(skillTitle("Counting Quest", { title: "   " })).toBe("Counting Quest");
    expect(skillTitle("Counting Quest", { title: "Counting Adventure" })).toBe(
      "Counting Adventure",
    );
  });

  it("keeps the rename when the bundle re-registers on the next boot", async () => {
    const { SkillStoreAPI, skillTitle } = await import("./skillStore");
    SkillStoreAPI.registerSkill(bundled);

    SkillStoreAPI.updateSkillListing("counting", { title: "Counting Adventure" });
    // Every load registers the bundled manifests again. The rename has to
    // survive that, and the manifest's own name has to come back through it —
    // renaming the skill in code must still reach a deployment that has not
    // renamed it itself.
    SkillStoreAPI.registerSkill({ ...bundled, name: "Counting Quest 2" });

    const stored = SkillStoreAPI.getSkill("counting");
    expect(stored?.title).toBe("Counting Adventure");
    expect(stored?.name).toBe("Counting Quest 2");
    expect(skillTitle(stored!.name, stored)).toBe("Counting Adventure");
  });

  it("goes back to the shipped name when the listing is reset", async () => {
    const { SkillStoreAPI, skillTitle } = await import("./skillStore");
    SkillStoreAPI.registerSkill(bundled);

    SkillStoreAPI.updateSkillListing("counting", {
      title: "Counting Adventure",
      tagline: "Ours",
    });
    SkillStoreAPI.resetSkillListing("counting");

    const stored = SkillStoreAPI.getSkill("counting");
    expect(stored?.title).toBeUndefined();
    expect(stored?.tagline).toBe(bundled.tagline);
    expect(skillTitle(stored!.name, stored)).toBe("Counting Quest");
  });

  it("clears the rename when the field is emptied", async () => {
    const { SkillStoreAPI } = await import("./skillStore");
    SkillStoreAPI.registerSkill(bundled);

    SkillStoreAPI.updateSkillListing("counting", { title: "Counting Adventure" });
    SkillStoreAPI.updateSkillListing("counting", { title: "  " });

    expect(SkillStoreAPI.getSkill("counting")?.title).toBeUndefined();
  });
});
