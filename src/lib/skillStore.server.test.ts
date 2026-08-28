import { beforeEach, describe, expect, it, vi } from "vitest";

const bundled = {
  id: "counting",
  name: "Counting Quest",
  version: "1.0.0",
  description: "Count",
  category: "core" as const,
  author: "Koda",
  isEnabled: true,
  iconName: "Sparkles",
  features: [{ id: "sound", name: "Sound", description: "Sound", isEnabled: true }],
  settings: { speed: 1 },
};

beforeEach(() => {
  vi.resetModules();
  localStorage.clear();
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")));
});

describe("skill registration and family configuration", () => {
  it("does not turn bundle registration into a family sync mutation", async () => {
    const { SkillStoreAPI } = await import("./skillStore");
    const { Outbox } = await import("./sync/outbox");

    SkillStoreAPI.registerSkill(bundled);

    expect(SkillStoreAPI.getSkill("counting")).toBeTruthy();
    expect(Outbox.peekMutations(10)).toHaveLength(0);
  });

  it("applies a server-pulled family configuration to the running store", async () => {
    const { SkillStoreAPI } = await import("./skillStore");
    const { applyChanges } = await import("./sync/apply");
    SkillStoreAPI.registerSkill(bundled);

    applyChanges(
      [
        {
          kind: "skill",
          key: "counting",
          body: { ...bundled, id: undefined, isEnabled: false },
          rev: 2,
          serverSeq: 10,
        },
      ],
      10,
    );

    expect(SkillStoreAPI.isSkillEnabled("counting")).toBe(false);
  });
});
