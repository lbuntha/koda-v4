import { describe, expect, it } from "vitest";
import { skill } from ".";
import type { Lesson } from "../types";
import { lessonIconTones } from "../../components/ui/lessonIcons";

/**
 * The manifest is read by the Skill Manager, the catalog, the server seed and
 * the recommender. None of it is visible while a round is being played, which
 * is why it drifts: Phase 3 added six concepts and the `teaches` list kept the
 * seven it had, so `recommend.ts` — which offers a skill only while it still
 * teaches something unmastered — would have stopped offering Bottle Sort the
 * moment the pouring concepts were done, with ten lessons left unplayed.
 */
const lessons = skill.lessons as unknown as Lesson[];
const manifest = skill.manifest;

describe("the Bottle Sort manifest tracks its lessons", () => {
  it("teaches exactly the concepts its lessons carry", () => {
    const taught = new Set(lessons.map((l) => l.conceptKey!));
    const declared = new Set(manifest.teaches ?? []);
    for (const key of taught) expect(declared.has(key), `${key} is taught but not declared`).toBe(true);
    for (const key of declared) expect(taught.has(key), `${key} is declared but no lesson teaches it`).toBe(true);
  });

  it("covers every lesson's age band with the audience it advertises", () => {
    const [low, high] = manifest.audience!.ages as [number, number];
    lessons.forEach((lesson) => {
      const [from, to] = lesson.ageBand as [number, number];
      expect(from, `${lesson.id} starts below the advertised audience`).toBeGreaterThanOrEqual(low);
      expect(to, `${lesson.id} runs past the advertised audience`).toBeLessThanOrEqual(high);
    });
  });

  it("names a tone the theme actually defines", () => {
    // `rose` is a real Tailwind colour and not a key here, so a lesson asking
    // for it silently rendered indigo.
    lessons.forEach((lesson) => {
      expect(Object.keys(lessonIconTones), `${lesson.id} tone ${lesson.iconTone}`)
        .toContain(lesson.iconTone);
    });
  });

  it("requires every concept a lesson depends on to be taught before it", () => {
    const taughtBy = new Map<string, number>();
    lessons.forEach((lesson, i) => {
      if (!taughtBy.has(lesson.conceptKey!)) taughtBy.set(lesson.conceptKey!, i);
    });
    lessons.forEach((lesson, i) => {
      (lesson.requires ?? []).forEach((key) => {
        const at = taughtBy.get(key);
        expect(at, `${lesson.id} requires ${key}, which no lesson teaches`).toBeDefined();
        expect(at!, `${lesson.id} requires ${key} before it is taught`).toBeLessThan(i);
      });
    });
  });

  it("declares a feature for every switch the engine reads", () => {
    const declared = new Set((skill.features ?? []).map((f) => f.id));
    // Each of these is checked by name in activities/BottleSort.tsx; a switch
    // the engine reads but the manifest does not declare cannot be turned off.
    ["audio_speech", "sound_chimes", "haptic_feedback", "pour_animation", "move_hints"]
      .forEach((id) => expect(declared.has(id), `${id} is read but not declared`).toBe(true));
  });
});
