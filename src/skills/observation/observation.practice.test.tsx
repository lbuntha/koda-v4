import { cleanup, fireEvent } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderActivity } from "../kit/testing";
import { skill } from ".";
import { buildQuestion } from "./activities/ObjectHunt";
import type { ObjectHuntSetup, ObservationMode } from "./internal/types";

const practice = skill.lessons.find((lesson) => lesson.id === "practice-object-hunt")!;
const setup = (practice.params as unknown as { question: ObjectHuntSetup }).question;
const hunt = skill.activities["object-hunt"];

describe("observation mixed practice", () => {
  it("asks ten one-target questions and covers every taught mode", () => {
    const questions = Array.from({ length: 10 }, (_, index) => buildQuestion({ ...setup, seed: "practice-audit" }, index + 1));
    expect(questions).toHaveLength(10);
    expect(questions.every((question) => question.targets.length === 1)).toBe(true);
    expect(new Set(questions.map((question) => question.scene.id)).size).toBe(10);
    expect(new Set(questions.map((question) => question.mode))).toEqual(new Set<ObservationMode>([
      "exact", "silhouette", "near_decoys", "rotation", "scale", "occluded", "clutter",
    ]));
  });

  it("removes hints, read-aloud, and spoken opening", () => {
    const h = renderActivity(hunt, {
      params: { ...setup, seed: "quiet-practice" } as unknown as Record<string, unknown>,
      level: 11,
      lesson: { id: practice.id, title: practice.title, levelNumber: 11 },
    });
    expect(h.buttons()).not.toContain("Hint");
    expect(h.buttons().filter((name) => /read|aloud|speak|listen/i.test(name))).toHaveLength(0);
    expect(h.koda.count("speech.say")).toBe(0);
    h.unmount();
    cleanup();
  });

  it("plays a success chime when the practice target is found", () => {
    const params = { ...setup, seed: "practice-chime", questionsPerRound: 1 };
    const question = buildQuestion(params, 1);
    const h = renderActivity(hunt, { params: params as unknown as Record<string, unknown> });
    const index = question.objects.findIndex((object) => object.id === question.targets[0]);
    fireEvent.click(h.screen.getByRole("button", { name: `Search item ${index + 1}` }));
    expect(h.koda.only("sound.play").map((call) => call.args[0])).toEqual(["success"]);
    expect(h.koda.count("learning.answered")).toBe(1);
    h.unmount();
    cleanup();
  });
});
