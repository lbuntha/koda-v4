import { afterEach, describe, expect, it, vi } from "vitest";
import { CHILD_SETTINGS_DEFAULTS, ChildSettingsAPI } from "../lib/childSettings";
import { skillCanRace } from "./raceable";

const on = { signedIn: true, allowed: true };

describe("who sees Play together", () => {
  afterEach(() => vi.restoreAllMocks());

  it("a skill that declares group_play, for a signed-in child, with everything left on", () => {
    expect(skillCanRace("number-merge", on)).toBe(true);
  });

  it("not a skill that does not declare it", () => {
    expect(skillCanRace("addition", on)).toBe(false);
  });

  it("not when the owner switched it off, or nobody is signed in", () => {
    expect(skillCanRace("number-merge", { ...on, allowed: false })).toBe(false);
    expect(skillCanRace("number-merge", { ...on, signedIn: false })).toBe(false);
  });

  it("not when the child's grown-up switched off playing with others", () => {
    vi.spyOn(ChildSettingsAPI, "current").mockReturnValue({ ...CHILD_SETTINGS_DEFAULTS, groupPlayEnabled: false });
    expect(skillCanRace("number-merge", on)).toBe(false);
  });
});
