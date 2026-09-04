import { describe, expect, it } from "vitest";
import { buildQuestion, visibilityProfile } from "./activities/ObjectHunt";
import { SCENE_BY_ID } from "./internal/scenes";
import { validateScene } from "./internal/validation";
import lessonsJson from "./lessons.json";

describe("observation question generator", () => {
  it("passes 200 deterministic Level 1–3 draws", () => {
    for (let draw = 1; draw <= 200; draw += 1) {
      const level = (draw % 3) + 1;
      const objectCount = [6, 8, 10][level - 1];
      const targetCount = level;
      const setup = { mode: "exact" as const, objectCount, targetCount, seed: `property-${draw}` };
      const first = buildQuestion(setup, draw);
      const again = buildQuestion(setup, draw);
      expect(again).toEqual(first);
      expect(first.objects).toHaveLength(objectCount);
      expect(first.targets).toHaveLength(targetCount);
      expect(new Set(first.targets).size).toBe(targetCount);
      expect(first.targets.every((id) => first.objects.some((object) => object.id === id))).toBe(true);
    }
  });

  it("implements every planned presentation mode through one engine", () => {
    const modes = ["exact", "silhouette", "near_decoys", "rotation", "scale", "occluded", "clutter", "mixed"] as const;
    modes.forEach((mode, index) => expect(buildQuestion({ mode }, index + 1).taskKind).toMatch(/^find_/));
  });

  it("makes targets progressively less visible from Levels 1 to 3", () => {
    const levels = [1, 2, 3].map((level) => visibilityProfile(level));
    expect(levels[1].targetScale).toBeLessThan(levels[0].targetScale);
    expect(levels[2].targetScale).toBeLessThan(levels[1].targetScale);
    expect(levels[1].camouflageStrength).toBeGreaterThan(levels[0].camouflageStrength);
    expect(levels[2].camouflageStrength).toBeGreaterThan(levels[1].camouflageStrength);
  });

  it("builds five varied questions for every lesson", () => {
    lessonsJson.lessons.forEach((lesson) => {
      expect(lesson.params.question.questionsPerRound).toBe(5);
      expect("seed" in lesson.params.question).toBe(false);
      const setup = { ...lesson.params.question, mode: lesson.params.question.mode as "exact", seed: `audit-${lesson.id}` };
      const questions = Array.from({ length: 5 }, (_, index) => buildQuestion(setup, index + 1));
      expect(new Set(questions.map((question) => question.targets[0])).size).toBe(5);
      questions.forEach((question) => expect(question.targets.every((id) => question.objects.some((object) => object.id === id))).toBe(true));
    });
  });

  it("uses every available object before repeating a target within a round", () => {
    const setup = { seed: "round-deck", objectCount: 10, targetCount: 2, questionsPerRound: 5 };
    const dealtTargets = Array.from({ length: 5 }, (_, index) => buildQuestion(setup, index + 1).targets).flat();
    expect(dealtTargets).toHaveLength(10);
    expect(new Set(dealtTargets).size).toBe(10);
  });

  it("moves targets between safe authored locations on every question", () => {
    const scene = SCENE_BY_ID.get("beach-sandcastle-shore")!;
    for (let index = 1; index <= 5; index += 1) {
      const question = buildQuestion({ seed: "location-deck", objectCount: 10, targetCount: 2 }, index);
      question.targets.forEach((id) => {
        const authored = scene.objects.find((object) => object.id === id)!;
        const placed = question.objects.find((object) => object.id === id)!;
        expect([placed.x, placed.y]).not.toEqual([authored.x, authored.y]);
        expect(placed.region).toBe(authored.region);
      });
      expect(validateScene({ ...scene, objects: question.objects })).toEqual([]);
    }
  });
});
