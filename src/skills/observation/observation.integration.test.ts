import { describe, expect, it } from "vitest";
import course from "../../curriculum/course.json";
import { skill } from ".";
import audioManifest from "./audio/manifest.json";

const observationLessons = course.units.flatMap((unit) => unit.lessons).filter((id) => id.startsWith("observation/"));
const audioFiles = import.meta.glob("./audio/**/*.{wav,mp3,ogg,m4a}", { query: "?url", import: "default", eager: true });

describe("observation integration", () => {
  it("registers all twenty-one lessons exactly once and keeps practice separate", () => {
    expect(observationLessons).toHaveLength(21);
    expect(new Set(observationLessons).size).toBe(21);
    expect(observationLessons).toEqual(skill.lessons.map((lesson) => `observation/${lesson.id}`));
    const practiceUnit = course.units.find((unit) => unit.lessons.includes("observation/practice-object-hunt"));
    expect(practiceUnit?.lessons).toEqual(["observation/practice-object-hunt"]);
  });

  it("bundles every scene and object locally for offline rounds", () => {
    expect(skill.assets).toHaveLength(158);
    expect(skill.assets).toContain(skill.manifest.thumbnail);
  });

  it("keeps every mapped recording backed by a bundled local file", () => {
    const bundled = new Set(Object.keys(audioFiles).map((path) => path.replace(/^\.\/audio\//, "")));
    Object.values(audioManifest).forEach((path) => expect(bundled.has(path), path).toBe(true));
  });
});
