import { describe, expect, it } from "vitest";
import voice from "./voice.json";
import lessons from "./lessons.json";
import { OBJECT_BY_ID } from "./internal/data";
import { SCENES } from "./internal/scenes";

const expanded = new Set([
  ...voice.prompts,
  ...voice.phrases,
  ...voice.templates.flatMap((template) => voice.subjects.map((subject) => template.replaceAll("{value}", subject))),
  ...Object.values(voice.groups).flatMap((group) => group.phrases),
  ...lessons.lessons.map((lesson) => lesson.params.play.audioPrompt),
]);

describe("observation recorded voice plan", () => {
  it("covers every phrase the playable scenes can request", () => {
    for (const scene of SCENES) {
      for (const object of scene.objects) {
        const name = OBJECT_BY_ID.get(object.id)?.name ?? object.id;
        const region = object.region.replace("-", " ");
        expect(expanded.has(`Find the ${name}.`)).toBe(true);
        expect(expanded.has(`Look near the ${region} part of the scene.`)).toBe(true);
        expect(expanded.has(`Focus on the ${region} area. Check around objects that could partly hide it.`)).toBe(true);
      }
    }
    expect(expanded.has("Find 2 hidden objects.")).toBe(true);
    expect(expanded.has("Find 3 hidden objects.")).toBe(true);
    expect(expanded.has("Find 4 hidden objects.")).toBe(true);
    expect(expanded.has("Find 5 hidden objects.")).toBe(true);
    expect(expanded.has("Scan one small part at a time. Move your eyes from left to right.")).toBe(true);
  });

  it("provides enough varied answer reactions", () => {
    expect(voice.groups.correct.phrases.length).toBeGreaterThanOrEqual(5);
    expect(voice.groups.incorrect.phrases.length).toBeGreaterThanOrEqual(4);
  });
});
