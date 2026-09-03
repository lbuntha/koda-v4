import { describe, expect, it } from "vitest";
import {
  buildSkillCatalog,
  filterSkillCatalog,
  learnOrder,
  newestSkills,
  type SkillCatalogSource,
} from "./skillCatalog";

const lesson = (levelNumber: number, skillId = "counting") => ({
  id: `lesson-${levelNumber}`,
  ref: `${skillId}/lesson-${levelNumber}`,
  skillId,
  levelNumber,
  title: `Lesson ${levelNumber}`,
  concept: "Counting",
  activity: `${skillId}/quest`,
});

const source = (id: string, category = "number-sense"): SkillCatalogSource => ({
  id,
  name: id === "counting" ? "Counting Quest" : "Shape Explorer",
  description: "A useful skill",
  tagline: "Learn through play",
  author: "Koda",
  category,
  ages: [5, 8],
  status: "published",
  lessons: [lesson(1, id), lesson(2, id)] as never,
});

describe("skill catalog", () => {
  it("builds compact progress and resume metadata for each skill", () => {
    const [entry] = buildSkillCatalog([source("counting")], { 1: 3 });
    expect(entry.completedLessons).toBe(1);
    expect(entry.progressPercent).toBe(50);
    expect(entry.nextLesson.levelNumber).toBe(2);
  });

  it("searches listing fields and filters categories", () => {
    const entries = buildSkillCatalog(
      [source("counting"), source("shapes", "geometry")],
      {},
    );
    expect(filterSkillCatalog(entries, "counting", "all").map((item) => item.id)).toEqual([
      "counting",
    ]);
    expect(filterSkillCatalog(entries, "", "geometry").map((item) => item.id)).toEqual([
      "shapes",
    ]);
  });

  /*
   * Distinct level numbers per skill.
   *
   * `source` files every skill's lessons at levels 1 and 2, and progress is
   * keyed by level across the whole course — so one `{ 1: 3 }` marks every
   * skill half-finished, and an ordering test written on it passes whatever
   * the rule does.
   */
  const at = (id: string, from: number, category?: string): SkillCatalogSource => ({
    ...source(id, category),
    lessons: [lesson(from, id), lesson(from + 1, id)] as never,
  });

  it("puts what is on the go first, then whatever changed most recently", () => {
    const entries = buildSkillCatalog(
      [
        /* Started and unfinished, and the oldest of the three. */
        { ...at("counting", 1), publishedAt: 100 },
        /* Untouched, updated most recently. */
        { ...at("shapes", 3, "geometry"), publishedAt: 300 },
        /* Untouched and older. */
        { ...at("patterns", 5, "patterns"), publishedAt: 200 },
      ],
      { 1: 3 },
    );

    expect(learnOrder(entries).map((item) => item.id)).toEqual([
      "counting",
      "shapes",
      "patterns",
    ]);
  });

  it("drops a finished skill to the bottom, however recently it was updated", () => {
    /* A skill with nothing left to do is a record, not something to do next —
       and being the newest thing in the library is exactly what would
       otherwise float it to the top of a list of things to do. */
    const entries = buildSkillCatalog(
      [
        { ...at("counting", 1), publishedAt: 900 },
        { ...at("shapes", 3, "geometry"), publishedAt: 100 },
      ],
      { 1: 3, 2: 3 },
    );

    expect(entries.find((e) => e.id === "counting")!.progressPercent).toBe(100);
    expect(learnOrder(entries).map((item) => item.id)).toEqual(["shapes", "counting"]);
  });

  it("orders by name when a deployment carries no timestamps at all", () => {
    /* Offline, or a library never published from the server: an unstable sort
       key would reshuffle the shelf on every render. */
    const entries = buildSkillCatalog([at("shapes", 3, "geometry"), at("counting", 1)], {});
    expect(learnOrder(entries).map((item) => item.name)).toEqual([
      "Counting Quest",
      "Shape Explorer",
    ]);
  });

  it("limits newest skills in server timestamp order with an offline LIFO fallback", () => {
    const entries = buildSkillCatalog(
      [
        { ...source("counting"), publishedAt: 100 },
        { ...source("shapes", "geometry"), publishedAt: 300 },
        { ...source("patterns", "patterns"), publishedAt: 200 },
      ],
      {},
    );
    expect(newestSkills(entries, 2).map((item) => item.id)).toEqual(["shapes", "patterns"]);

    const offline = buildSkillCatalog(
      [source("counting"), source("shapes", "geometry")],
      {},
    );
    expect(newestSkills(offline, 2).map((item) => item.id)).toEqual(["shapes", "counting"]);
  });
});
