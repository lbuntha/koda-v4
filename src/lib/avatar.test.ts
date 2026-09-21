import { describe, expect, it } from "vitest";

import { artAvatarId, artAvatarSeed, diceBearAvatar } from "./avatar";

describe("avatar references", () => {
  it("round-trips an Art asset through the existing avatar seed field", () => {
    const seed = artAvatarSeed("avatar-fox");
    expect(seed).toBe("art:avatar-fox");
    expect(artAvatarId(seed)).toBe("avatar-fox");
  });

  it("keeps legacy DiceBear seeds unchanged", () => {
    expect(artAvatarId("a_legacy_seed")).toBeUndefined();
    expect(diceBearAvatar("a_legacy_seed")).toContain("seed=a_legacy_seed");
  });
});
