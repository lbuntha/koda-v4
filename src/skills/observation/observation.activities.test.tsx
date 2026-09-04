import { describe, expect, it } from "vitest";
import { fireEvent } from "@testing-library/react";
import { renderActivity } from "../kit/testing";
import { skill } from ".";
import { buildQuestion } from "./activities/ObjectHunt";

const hunt = skill.activities["object-hunt"];

describe("the hidden-object game", () => {
  it("keeps matches marked, accepts any target order, and celebrates the last", async () => {
    const params = { seed: "order-test", objectCount: 8, targetCount: 2, questionsPerRound: 1 };
    const q = buildQuestion(params, 1);
    const h = renderActivity(hunt, { params, settings: { praiseMs: 0 } });
    for (const id of [...q.targets].reverse()) {
      expect(document.querySelector(`[data-target-id="${id}"] [data-preview-opacity]`)?.getAttribute("data-preview-opacity")).toBe("searching");
      const index = q.objects.findIndex((object) => object.id === id);
      fireEvent.click(h.screen.getByRole("button", { name: `Search item ${index + 1}` }));
      expect(document.querySelector(`[data-object-id="${id}"]`)?.getAttribute("data-match-state")).toBe("celebrating");
      expect(document.querySelector(`[data-target-id="${id}"]`)?.getAttribute("data-match-state")).toBe("celebrating");
      expect(document.querySelector(`[data-target-id="${id}"] [data-preview-opacity]`)?.getAttribute("data-preview-opacity")).toBe("found");
    }
    expect(h.koda.only("sound.play").map((call) => call.args[0])).toEqual(["pop", "success"]);
    expect(h.koda.count("speech.stop")).toBe(2);
    expect(h.koda.count("learning.answered")).toBe(1);
    expect(h.text()).toMatch(/Perfect round/i);
    expect(h.results).toHaveLength(1);
    h.unmount();
  });

  it("says not a match and preserves an already-found target", async () => {
    const params = { seed: "wrong-test", objectCount: 8, targetCount: 2, questionsPerRound: 1 };
    const q = buildQuestion(params, 1);
    const h = renderActivity(hunt, { params });
    const foundIndex = q.objects.findIndex((object) => object.id === q.targets[0]);
    fireEvent.click(h.screen.getByRole("button", { name: `Search item ${foundIndex + 1}` }));
    const wrongIndex = q.objects.findIndex((object) => !q.targets.includes(object.id));
    fireEvent.click(h.screen.getByRole("button", { name: `Search item ${wrongIndex + 1}` }));
    expect(h.text()).toMatch(/Not a match/i);
    expect(h.screen.getByLabelText("Objects to find").querySelectorAll("svg").length).toBeGreaterThan(0);
    expect(h.koda.only("sound.play").map((call) => call.args[0])).toEqual(["pop", "error"]);
    expect(h.koda.count("speech.stop")).toBe(2);
    h.unmount();
  });

  it("honours the sound-chimes switch", () => {
    const params = { seed: "silent-test", objectCount: 6, targetCount: 2, questionsPerRound: 1 };
    const q = buildQuestion(params, 1);
    const h = renderActivity(hunt, { params, features: { sound_chimes: false } });
    const index = q.objects.findIndex((object) => object.id === q.targets[0]);
    fireEvent.click(h.screen.getByRole("button", { name: `Search item ${index + 1}` }));
    expect(h.koda.count("sound.play")).toBe(0);
    h.unmount();
  });

  it("plays the final chime before the delayed recorded-reaction path", () => {
    const params = { seed: "clean-audio", objectCount: 6, targetCount: 1, questionsPerRound: 1 };
    const q = buildQuestion(params, 1);
    const h = renderActivity(hunt, { params });
    const index = q.objects.findIndex((object) => object.id === q.targets[0]);
    fireEvent.click(h.screen.getByRole("button", { name: `Search item ${index + 1}` }));
    expect(h.koda.count("speech.stop")).toBe(1);
    expect(h.koda.only("sound.play")[0]?.args[0]).toBe("success");
    expect(h.koda.count("learning.answered")).toBe(1);
    h.unmount();
  });

  it("draws hidden targets smaller without shrinking their tap areas", () => {
    const params = { seed: "target-scale", objectCount: 6, targetCount: 1, questionsPerRound: 1 };
    const q = buildQuestion(params, 1);
    const h = renderActivity(hunt, { params });
    const target = document.querySelector(`[data-object-id="${q.targets[0]}"]`)!;
    const distractorId = q.objects.find((object) => !q.targets.includes(object.id))!.id;
    const distractor = document.querySelector(`[data-object-id="${distractorId}"]`)!;
    expect(target.querySelector("[data-visual-scale]")?.getAttribute("data-visual-scale")).toBe("target");
    expect(distractor.querySelector("[data-visual-scale]")?.getAttribute("data-visual-scale")).toBe("ordinary");
    expect((target as HTMLElement).style.width).not.toBe("");
    h.unmount();
  });
});
