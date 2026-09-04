import { describe, expect, it } from "vitest";
import { keyOf } from "./internal/types";
import { buildQuestion, visibilityProfile } from "./activities/ObjectHunt";
import { SCENE_BY_ID } from "./internal/scenes";
import { OBJECT_BY_ID } from "./internal/data";
import type { ObjectHuntSetup, ObservationMode } from "./internal/types";
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

  it("builds the planned number of varied questions for every lesson", () => {
    lessonsJson.lessons.forEach((lesson) => {
      const questionCount = lesson.params.question.practice ? 10 : 5;
      expect(lesson.params.question.questionsPerRound).toBe(questionCount);
      expect("seed" in lesson.params.question).toBe(false);
      const setup = { ...lesson.params.question, seed: `audit-${lesson.id}` } as ObjectHuntSetup;
      const questions = Array.from({ length: questionCount }, (_, index) => buildQuestion(setup, index + 1));
      // A swarm round asks for the same character every question, so the
      // no-repeat promise applies to its count, not to a rotating first target.
      if (lesson.params.question.mode === "swarm") {
        questions.forEach((question) => expect(question.targets).toHaveLength(lesson.params.question.swarmCount));
      } else {
        expect(new Set(questions.map((question) => question.targets[0])).size).toBe(questionCount);
      }
      questions.forEach((question) => expect(question.targets.every((id) => question.objects.some((object) => keyOf(object) === id))).toBe(true));
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

  it("prioritizes a related distractor in near-decoy mode", () => {
    const question = buildQuestion({ mode: "near_decoys", sceneId: "market-fruit-market", seed: "decoy-audit", objectCount: 4, targetCount: 1 }, 1);
    const targetGroup = OBJECT_BY_ID.get(question.targets[0])?.decoyGroup;
    expect(targetGroup).toBeTruthy();
    expect(question.objects.some((object) => !question.targets.includes(object.id) && OBJECT_BY_ID.get(object.id)?.decoyGroup === targetGroup)).toBe(true);
  });

  it("turns Level 6 targets through meaningful angles", () => {
    const question = buildQuestion({ mode: "rotation", sceneId: "forest-tent-clearing", seed: "rotation-audit", objectCount: 10, targetCount: 3 }, 1);
    const rotations = question.objects.filter((object) => question.targets.includes(object.id)).map((object) => Math.abs(object.rotation ?? 0));
    expect(rotations.every((rotation) => rotation >= 45 && rotation <= 180)).toBe(true);
  });

  it("varies Level 7 scene scale without changing authored hit boxes", () => {
    const scene = SCENE_BY_ID.get("school-art-classroom")!;
    const question = buildQuestion({ mode: "scale", sceneId: scene.id, seed: "scale-audit", objectCount: 10, targetCount: 4 }, 1);
    const targets = question.objects.filter((object) => question.targets.includes(object.id));
    expect(targets.every((object) => object.visualScale !== undefined && object.visualScale >= 0.72 && object.visualScale <= 1.2)).toBe(true);
    targets.forEach((object) => {
      const authored = scene.objects.find((candidate) => candidate.id === object.id)!;
      expect([object.width, object.height, object.hitPadding]).toEqual([authored.width, authored.height, authored.hitPadding]);
    });
  });

  it("shows enough of every partially hidden Level 8 target", () => {
    const question = buildQuestion({ mode: "occluded", sceneId: "harbor-aquarium-gallery", seed: "occlusion-audit", objectCount: 10, targetCount: 4 }, 1);
    const targets = question.objects.filter((object) => question.targets.includes(object.id));
    expect(targets.every((object) => object.visibleFraction === 0.72)).toBe(true);
    expect(validateScene({ ...question.scene, objects: question.objects })).toEqual([]);
  });

  it("cycles five taught transformations in the final challenge", () => {
    const modes: ObservationMode[] = ["occluded", "clutter", "rotation", "scale", "near_decoys"];
    const setup = { modes, sceneIds: ["town-festival-square", "town-toy-parade"], seed: "challenge-audit", objectCount: 10, targetCount: 5 };
    const questions = Array.from({ length: 5 }, (_, index) => buildQuestion(setup, index + 1));
    expect(questions.map((question) => question.mode)).toEqual(modes);
  });
});
