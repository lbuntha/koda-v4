import { describe, expect, it } from "vitest";
import { starterSkills } from "./starterSkills";
import type { SkillCatalogEntry } from "./skillCatalog";

const skill = (id: string, ages: [number, number], subjectId: string, extra: Partial<SkillCatalogEntry> = {}) =>
  ({ id, name: id, ages, subjectId, category: subjectId, status: "published", completedLessons: 0, ...extra }) as SkillCatalogEntry;

const shelf = [
  skill("multiplication", [6, 10], "math"),
  skill("counting", [5, 7], "math"),
  skill("color-sweeper", [6, 14], "thinking"),
  skill("bottle-sort", [7, 12], "thinking"),
  skill("fractions", [8, 12], "math"),
];
const all = () => true;

describe("starterSkills", () => {
  it("leads with the most foundational skill for the age, one per subject first", () => {
    expect(starterSkills(shelf, { age: 6, canStart: all }).map((s) => s.id)).toEqual([
      "counting",
      "color-sweeper",
      "multiplication",
    ]);
  });

  it("never offers a skill whose first lesson cannot be opened", () => {
    const ids = starterSkills(shelf, { age: 6, canStart: (s) => s.id !== "counting" }).map((s) => s.id);
    expect(ids).not.toContain("counting");
    expect(ids[0]).toBe("multiplication");
  });

  it("prefers skills made for the age over ones it is only stretched into", () => {
    const ids = starterSkills(shelf, { age: 11, canStart: all }).map((s) => s.id);
    // Counting (5–7) and Multiplication (6–10) only stretch to 11, so they come last.
    expect(ids).toEqual(["bottle-sort", "fractions", "color-sweeper"]);
  });

  it("skips drafts and skills already started", () => {
    const ids = starterSkills(
      [skill("a", [6, 7], "math", { status: "draft" }), skill("b", [6, 7], "math", { completedLessons: 2 }), skill("c", [6, 8], "math")],
      { age: 6, canStart: all },
    ).map((s) => s.id);
    expect(ids).toEqual(["c"]);
  });

  it("returns nothing rather than a locked list", () => {
    expect(starterSkills(shelf, { age: 6, canStart: () => false })).toEqual([]);
  });
});
