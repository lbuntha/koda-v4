import { describe, expect, it } from "vitest";
import { isAgeRange } from "../lib/ages";
import { cleanTopics } from "../lib/topics";

/*
 * Every lesson and every skill says who it is for.
 *
 * Age is the first thing Learn recommends by, across lessons, books and trace
 * collections alike. Books and collections are refused at publish without one
 * (server/app/ages.py); lessons ship in the bundle, so this is their gate.
 */
const manifests = import.meta.glob<{ id?: string; audience?: { ages?: unknown }; topics?: string[] }>("./*/manifest.json", { eager: true, import: "default" });
const lessonFiles = import.meta.glob<unknown>("./*/lessons.json", { eager: true, import: "default" });

const lessonsIn = (file: unknown): { id?: string; ageBand?: unknown }[] => {
  const list = Array.isArray(file) ? file : (file as { lessons?: unknown })?.lessons ?? file;
  return (Array.isArray(list) ? list : Object.values(list as object)) as { id?: string; ageBand?: unknown }[];
};

describe("content ages", () => {
  it("finds the skills it is checking", () => {
    expect(Object.keys(manifests).length).toBeGreaterThan(0);
    expect(Object.keys(lessonFiles).length).toBeGreaterThan(0);
  });

  it.each(Object.entries(manifests))("%s says which ages the skill is for", (_, manifest) => {
    expect(isAgeRange(manifest.audience?.ages)).toBe(true);
  });

  it.each(Object.entries(manifests))("%s says what the skill is about, from the shared topics", (_, manifest) => {
    expect(manifest.topics?.length).toBeGreaterThan(0);
    expect(cleanTopics(manifest.topics)).toHaveLength(manifest.topics!.length);
  });

  it.each(Object.entries(lessonFiles))("every lesson in %s has an age band", (_, file) => {
    const missing = lessonsIn(file)
      .filter((lesson) => !isAgeRange(lesson.ageBand))
      .map((lesson) => lesson.id);
    expect(missing).toEqual([]);
  });
});
