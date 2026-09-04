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

  it("renders silhouette target previews while keeping scene art in colour", () => {
    const params = { seed: "silhouette-test", mode: "silhouette" as const, sceneId: "market-fruit-market", objectCount: 10, targetCount: 1, questionsPerRound: 1 };
    const h = renderActivity(hunt, { params });
    const preview = h.screen.getByLabelText("Objects to find").querySelector("[data-preview-opacity] span") as HTMLElement;
    expect(preview.style.filter).toBe("brightness(0)");
    h.unmount();
  });

  it("partially clips Level 8 target art without shrinking its button", () => {
    const params = { seed: "occluded-render", mode: "occluded" as const, sceneId: "harbor-aquarium-gallery", objectCount: 10, targetCount: 1, questionsPerRound: 1 };
    const q = buildQuestion(params, 1);
    const h = renderActivity(hunt, { params });
    const button = document.querySelector(`[data-object-id="${q.targets[0]}"]`) as HTMLElement;
    const art = button.querySelector("[data-visual-scale]") as HTMLElement;
    expect(art.style.clipPath).toContain("28");
    expect(button.style.width).not.toBe("");
    h.unmount();
  });

  it("offers a labelled keyboard-accessible list view", () => {
    const params = { seed: "list-view", sceneId: "school-art-classroom", objectCount: 10, targetCount: 1, questionsPerRound: 1 };
    const q = buildQuestion(params, 1);
    const h = renderActivity(hunt, { params });
    fireEvent.click(h.screen.getByRole("button", { name: "List" }));
    expect(h.screen.getByText(/0 of 1 target objects found/i)).toBeTruthy();
    const name = q.targets[0].replace(/^school-/, "").replaceAll("-", " ");
    const candidate = h.screen.getByRole("button", { name: `Choose ${name}` });
    candidate.focus();
    expect(document.activeElement).toBe(candidate);
    candidate.click();
    expect(h.koda.only("sound.play").map((call) => call.args[0])).toEqual(["success"]);
    expect(h.koda.count("learning.answered")).toBe(1);
    h.unmount();
  });
});

describe("the frog swarm", () => {
  const params = { seed: "swarm-round", mode: "swarm" as const, sceneIds: ["castle-frog-moat"], swarmCount: 6, objectCount: 10, questionsPerRound: 1 };

  it("hides one character many times and scores every copy separately", () => {
    const q = buildQuestion(params, 1);
    expect(q.mode).toBe("swarm");
    expect(q.swarmObjectId).toBe("castle-frog");
    expect(q.targets).toHaveLength(6);
    // Six separate finds, not one object counted six times.
    expect(new Set(q.targets).size).toBe(6);
    expect(q.targets.every((key) => key.startsWith("castle-frog-"))).toBe(true);
    expect(q.prompt).toBe("Find all 6 frogs.");
  });

  it("shows one counter card that fills as frogs are found", async () => {
    const q = buildQuestion(params, 1);
    const h = renderActivity(hunt, { params, settings: { praiseMs: 0 } });
    const card = () => document.querySelector('[data-target-id="castle-frog"]');
    expect(card()?.getAttribute("data-swarm-progress")).toBe("0/6");
    // One tray card for the whole swarm, not six identical frog previews.
    expect(document.querySelectorAll("[data-target-id]")).toHaveLength(1);

    q.targets.forEach((key, index) => {
      const position = q.objects.findIndex((object) => (object.instanceId ?? object.id) === key);
      fireEvent.click(h.screen.getByRole("button", { name: `Search item ${position + 1}` }));
      expect(card()?.getAttribute("data-swarm-progress")).toBe(`${index + 1}/6`);
    });

    expect(h.koda.only("sound.play").map((call) => call.args[0])).toEqual(["pop", "pop", "pop", "pop", "pop", "success"]);
    expect(h.koda.count("learning.answered")).toBe(1);
    h.unmount();
  });

  it("keeps a wrong tap and a re-tapped frog off the score", () => {
    const q = buildQuestion(params, 1);
    const h = renderActivity(hunt, { params });
    const frog = q.objects.findIndex((object) => object.id === "castle-frog");
    fireEvent.click(h.screen.getByRole("button", { name: `Search item ${frog + 1}` }));
    fireEvent.click(h.screen.getByRole("button", { name: `Search item ${frog + 1}` }));
    expect(h.text()).toMatch(/already found the frog/i);
    expect(document.querySelector('[data-target-id="castle-frog"]')?.getAttribute("data-swarm-progress")).toBe("1/6");

    const other = q.objects.findIndex((object) => object.id !== "castle-frog");
    fireEvent.click(h.screen.getByRole("button", { name: `Search item ${other + 1}` }));
    expect(h.text()).toMatch(/Not a match/i);
    expect(h.koda.count("learning.answered")).toBe(1);
    h.unmount();
  });

  it("names each copy in the list view so they stay distinguishable", () => {
    const h = renderActivity(hunt, { params });
    fireEvent.click(h.screen.getByRole("button", { name: "List" }));
    const frogCards = h.buttons().filter((name) => /^Choose frog \d+$/.test(name));
    expect(frogCards.length).toBeGreaterThanOrEqual(6);
    expect(new Set(frogCards).size).toBe(frogCards.length);
    h.unmount();
  });
});
