import { describe, expect, it } from "vitest";
import { fireEvent } from "@testing-library/react";
import { renderActivity } from "../kit/testing";
import { skill } from ".";
import { buildQuestion } from "./activities/SpotTheDifference";
import type { DifferenceKind } from "./internal/differences";
import { validateScene } from "./internal/validation";
import { SCENES } from "./internal/scenes";
import { keyOf } from "./internal/types";
import { OBJECT_BY_ID } from "./internal/data";
import lessons from "./lessons.json";

const spot = skill.activities["spot-the-difference"];
const lesson = (id: string) => {
  const found = lessons.lessons.find((l) => l.id === id)!;
  return { ...found.params.question, seed: `diff-${id}` } as never;
};
const params = { seed: "pair", sceneIds: ["market-fruit-market"], objectCount: 8, differenceCount: 3, kinds: ["missing", "moved"] as DifferenceKind[], questionsPerRound: 1 };

describe("spot the difference", () => {
  it("makes exactly the differences it promised, and no others", () => {
    lessons.lessons.filter((l) => l.activity === "observation/spot-the-difference").forEach((l) => {
      for (let i = 1; i <= 5; i += 1) {
        const q = buildQuestion(lesson(l.id), i);
        expect(q.differences.length, `${l.id} q${i}`).toBe(l.params.question.differenceCount);
        expect(q.targets.length).toBe(q.differences.length);

        // Anything not named as a difference must be byte-identical in both
        // pictures, or the round contains a difference it will not accept.
        const right = new Map(q.right.map((o) => [keyOf(o), o]));
        const named = new Set(q.targets);
        q.left.forEach((object) => {
          const key = keyOf(object);
          if (named.has(key)) return;
          expect(right.get(key), `${l.id} q${i} ${key}`).toEqual(object);
        });
      }
    });
  });

  it("keeps both pictures legal scenes", () => {
    lessons.lessons.filter((l) => l.activity === "observation/spot-the-difference").forEach((l) => {
      for (let i = 1; i <= 4; i += 1) {
        const q = buildQuestion(lesson(l.id), i);
        expect(validateScene({ ...q.scene, objects: q.left }), `${l.id} left`).toEqual([]);
        expect(validateScene({ ...q.scene, objects: q.right }), `${l.id} right`).toEqual([]);
      }
    });
  });

  it("only uses a difference kind the object can carry", () => {
    const q = buildQuestion(lesson("spot-seven-differences"), 1);
    q.differences.forEach((difference) => {
      const object = q.left.find((o) => keyOf(o) === difference.key)!;
      const entry = OBJECT_BY_ID.get(object.id);
      if (difference.kind === "mirrored") expect(entry?.mirrorSafe, object.id).toBe(true);
      if (difference.kind === "swapped") expect(entry?.decoyGroup, object.id).toBeTruthy();
      if (difference.kind === "turned") expect(entry?.orientationSafe, object.id).not.toBe(false);
    });
  });

  it("keeps every scene inside the crop band both panes use", () => {
    // Panes show 11%-89% of the art, so anything outside is unfindable.
    SCENES.forEach((scene) => scene.objects.forEach((object) => {
      expect(object.y - object.hitPadding, `${scene.id}/${keyOf(object)}`).toBeGreaterThanOrEqual(11);
      expect(object.y + object.height + object.hitPadding, `${scene.id}/${keyOf(object)}`).toBeLessThanOrEqual(89);
    }));
  });

  it("scores a difference from either picture and advances only on the last", async () => {
    const q = buildQuestion(params, 1);
    const h = renderActivity(spot, { params, settings: { praiseMs: 0 } });
    expect(document.querySelector("[data-difference-progress]")?.getAttribute("data-difference-progress")).toBe("0/3");

    // Alternate panes to prove either one counts.
    q.targets.forEach((key, index) => {
      const pane = index % 2 === 0 ? "Top picture" : "Bottom picture";
      const button = document.querySelector(`[data-pane="${pane}"][data-difference-key="${key}"]`)!;
      fireEvent.click(button);
      expect(document.querySelector("[data-difference-progress]")?.getAttribute("data-difference-progress")).toBe(`${index + 1}/3`);
    });

    expect(h.koda.only("sound.play").map((c) => c.args[0])).toEqual(["pop", "pop", "success"]);
    expect(h.koda.count("learning.answered")).toBe(1);
    h.unmount();
  });

  it("marks a found difference in both pictures", () => {
    const q = buildQuestion(params, 1);
    const h = renderActivity(spot, { params });
    const key = q.targets[0];
    fireEvent.click(document.querySelector(`[data-pane="Top picture"][data-difference-key="${key}"]`)!);
    document.querySelectorAll(`[data-difference-key="${key}"]`).forEach((node) =>
      expect(node.getAttribute("data-match-state")).toBe("found"));
    h.unmount();
  });

  it("counts a same-looking tap as an attempt and keeps the pair", () => {
    const q = buildQuestion(params, 1);
    const h = renderActivity(spot, { params });
    const same = q.left.find((o) => !q.targets.includes(keyOf(o)))!;
    fireEvent.click(document.querySelector(`[data-difference-key="${keyOf(same)}"]`)!);
    expect(h.text()).toMatch(/look the same/i);
    expect(h.koda.count("learning.answered")).toBe(1);
    expect(document.querySelector("[data-difference-progress]")?.getAttribute("data-difference-progress")).toBe("0/3");
    h.unmount();
  });

  it("gives both pictures the same tappable grid", () => {
    const h = renderActivity(spot, { params });
    const top = [...document.querySelectorAll('[data-pane="Top picture"]')].map((n) => n.getAttribute("data-difference-key"));
    const bottom = [...document.querySelectorAll('[data-pane="Bottom picture"]')].map((n) => n.getAttribute("data-difference-key"));
    // A grid that only covered the differences would give the answer away.
    expect(new Set(top)).toEqual(new Set(bottom));
    expect(top.length).toBeGreaterThan(3);
    h.unmount();
  });
});
