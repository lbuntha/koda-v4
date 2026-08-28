import { describe, expect, it } from "vitest";

import { splitTabs, withCounts } from "./navRecord";

/**
 * The sidebar draws the menu record, not its own opinion of it.
 *
 * Three entries used to be rewritten on the way past — System's label forced,
 * Learn's and Art's badges replaced with counts — so anything saved for them on
 * the Menu screen was thrown away before it reached the rail. Live counts are
 * still worth having, so the record asks for one with a placeholder instead.
 */
describe("badges and labels coming from the menu record", () => {
  const counts = { lessons: 15, art: 11 };

  it("fills a placeholder with the live count", () => {
    expect(withCounts("{lessons} Levels", counts)).toBe("15 Levels");
    expect(withCounts("{art} SVG", counts)).toBe("11 SVG");
  });

  it("leaves wording the record chose exactly as it is", () => {
    expect(withCounts("All skills", counts)).toBe("All skills");
    expect(withCounts("Pathway", counts)).toBe("Pathway");
  });

  it("keeps an absent badge absent rather than inventing one", () => {
    expect(withCounts(undefined, counts)).toBeUndefined();
    expect(withCounts(null, counts)).toBeNull();
  });

  it("replaces every occurrence, so a badge may name a count twice", () => {
    expect(withCounts("{lessons} of {lessons}", counts)).toBe("15 of 15");
  });
});

/**
 * Which destinations the phone's tab bar carries.
 *
 * The four are named rather than taken off the top of the menu record —
 * otherwise an operator adding Users, Roles and Devices to the menu quietly
 * pushes Learn off the bar on every phone in the family. What the four leave
 * out is not lost: Settings lists it.
 */
describe("splitting a menu into tabs and everywhere else", () => {
  const item = (id: string) => ({ id, label: id, icon: id });

  it("gives a parent Home, Learn, Children and Settings, in that order", () => {
    const { primary, overflow } = splitTabs([
      item("settings"),
      item("children"),
      item("users"),
      item("game"),
      item("home"),
      item("profile"),
    ]);

    expect(primary.map((i) => i.id)).toEqual(["home", "game", "children", "settings"]);
    expect(overflow.map((i) => i.id)).toEqual(["users", "profile"]);
  });

  it("keeps Profile off the bar and reachable from Settings", () => {
    const { primary, overflow } = splitTabs([item("home"), item("game"), item("profile"), item("settings")]);

    expect(primary.map((i) => i.id)).not.toContain("profile");
    expect(overflow.map((i) => i.id)).toEqual(["profile"]);
  });

  it("draws three tabs on a child's tablet rather than padding the bar out", () => {
    // No Children entry: a learner does not hold `learner:create`.
    const { primary, overflow } = splitTabs([
      item("home"),
      item("game"),
      item("profile"),
      item("settings"),
    ]);

    expect(primary.map((i) => i.id)).toEqual(["home", "game", "settings"]);
    // Never filled from the record — an admin page must not land under a
    // learner's thumb because a slot happened to be free.
    expect(primary).toHaveLength(3);
    expect(overflow.map((i) => i.id)).toEqual(["profile"]);
  });

  it("keeps an admin's extra destinations off the bar, in record order", () => {
    const { primary, overflow } = splitTabs([
      item("home"),
      item("game"),
      item("profile"),
      item("skills"),
      item("assets"),
      item("users"),
      item("children"),
      item("settings"),
    ]);

    expect(primary.map((i) => i.id)).toEqual(["home", "game", "children", "settings"]);
    expect(overflow.map((i) => i.id)).toEqual(["profile", "skills", "assets", "users"]);
  });

  it("never invents a tab the record does not carry", () => {
    const { primary, overflow } = splitTabs([item("home"), item("game")]);

    expect(primary.map((i) => i.id)).toEqual(["home", "game"]);
    expect(overflow).toEqual([]);
  });
});
