import { describe, expect, it } from "vitest";
import {
  buildSkillCatalog,
  filterSkillCatalog,
  newestSkills,
  recommendedSkills,
  totalRecommendationScore,
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
  it("calculates the documented weighted recommendation total", () => {
    expect(totalRecommendationScore({
      ageRelevance: 100,
      meaningfulPlays: 80,
      completionRate: 70,
      recentPopularity: 60,
      freshness: 40,
    })).toBe(77);
  });

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

  it("uses progress as a deterministic offline recommendation fallback", () => {
    const entries = buildSkillCatalog(
      [source("counting"), source("shapes", "geometry")],
      { 1: 3 },
    );
    expect(recommendedSkills(entries)[0].id).toBe("counting");
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
