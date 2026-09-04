import { describe, expect, it } from "vitest";
import { buildQuestion } from "./activities/ObjectHunt";
import { placeObjects, seedHash, seededShuffle } from "./internal/placement";
import { SCENES, SCENE_BY_ID } from "./internal/scenes";
import { validateScene } from "./internal/validation";
import { keyOf } from "./internal/types";
import lessons from "./lessons.json";

const layoutOf = (objects: { x: number; y: number }[], keys: string[]) =>
  objects.map((object, i) => `${keys[i]}@${object.x.toFixed(2)},${object.y.toFixed(2)}`).sort().join(" ");

describe("hidden object placement", () => {
  it("draws independent low bits from near-identical seeds", () => {
    // The original bug: FNV-1a alone has a parity low bit, so `% 2` on two
    // seeds differing by one character moved in lockstep and the shift cancelled.
    const bits = Array.from({ length: 200 }, (_, i) => seedHash(`seed:${i}:direction`) % 2);
    const ones = bits.filter(Boolean).length;
    expect(ones).toBeGreaterThan(70);
    expect(ones).toBeLessThan(130);

    const pairs = Array.from({ length: 200 }, (_, i) =>
      (seedHash(`seed:${i}:direction`) % 2) === (seedHash(`seed:${i}:distance`) % 2));
    const agree = pairs.filter(Boolean).length;
    expect(agree).toBeGreaterThan(70);
    expect(agree).toBeLessThan(130);
  });

  it("reshuffles the whole layout between consecutive questions", () => {
    SCENES.forEach((scene) => {
      const setup = { seed: `layout-${scene.id}`, sceneIds: [scene.id], objectCount: Math.min(8, scene.objects.length), targetCount: 2 };
      const layouts = Array.from({ length: 6 }, (_, i) => {
        const question = buildQuestion(setup, i + 1);
        return layoutOf(question.objects, question.objects.map(keyOf));
      });
      // Every question is its own arrangement; the old rotation produced one
      // layout forever and still passed a "moved from authored" assertion.
      expect(new Set(layouts).size, scene.id).toBe(layouts.length);
    });
  });

  it("gives every object several distinct spots across a round", () => {
    SCENES.forEach((scene) => {
      const spots = new Map<string, string[]>();
      for (let index = 1; index <= 10; index += 1) {
        const question = buildQuestion({ seed: `spread-${scene.id}`, sceneIds: [scene.id], objectCount: Math.min(8, scene.objects.length), targetCount: 2 }, index);
        question.objects.forEach((object) => {
          const key = keyOf(object);
          spots.set(key, [...(spots.get(key) ?? []), `${object.x.toFixed(2)},${object.y.toFixed(2)}`]);
        });
      }
      // An object the round actually reuses has to land somewhere new. Before
      // the placement rewrite every one of these was pinned to a single spot.
      const reused = [...spots].filter(([, seen]) => seen.length >= 3);
      expect(reused.length, scene.id).toBeGreaterThan(0);
      reused.forEach(([key, seen]) => expect(new Set(seen).size, `${scene.id} ${key}`).toBeGreaterThan(1));
    });
  });

  it("keeps every generated layout a legal scene", () => {
    SCENES.forEach((scene) => {
      for (let index = 1; index <= 12; index += 1) {
        const question = buildQuestion({ seed: `legal-${scene.id}`, sceneIds: [scene.id], objectCount: Math.min(10, scene.objects.length), targetCount: 2 }, index);
        // In bounds, no two hit boxes overlapping, nothing over-hidden.
        expect(validateScene({ ...question.scene, objects: question.objects }), `${scene.id} q${index}`).toEqual([]);
      }
    });
  });

  it("keeps most objects off the slot they came from, and never pins one", () => {
    const scene = SCENE_BY_ID.get("beach-sandcastle-shore")!;
    const spots = new Map<string, Set<string>>();
    let stayed = 0;
    let moves = 0;
    for (let index = 1; index <= 12; index += 1) {
      placeObjects(scene, scene.objects, `derange-${index}`).forEach((object, i) => {
        const home = scene.objects[i];
        moves += 1;
        if (object.x === home.x && object.y === home.y) stayed += 1;
        const key = home.id;
        if (!spots.has(key)) spots.set(key, new Set());
        spots.get(key)!.add(`${object.x},${object.y}`);
      });
    }
    // Slots grouped in threes or more are deranged outright; a pair alternates
    // between swapping and holding, so a few holds are expected — what must not
    // happen is any object being stuck on one spot for the whole round.
    expect(stayed / moves).toBeLessThan(0.25);
    spots.forEach((seen, id) => expect(seen.size, id).toBeGreaterThan(1));
  });

  it("keeps an object inside the region its scene authored for it", () => {
    SCENES.forEach((scene) => {
      const placed = placeObjects(scene, scene.objects, `region-${scene.id}`);
      placed.forEach((object, i) => expect(object.region).toBe(scene.objects[i].region));
    });
  });

  it("reproduces the same layout from the same seed", () => {
    const scene = SCENE_BY_ID.get("museum-planetarium")!;
    const once = placeObjects(scene, scene.objects, "stable");
    const twice = placeObjects(scene, scene.objects, "stable");
    expect(twice).toEqual(once);
  });

  it("shuffles without dropping or duplicating an item", () => {
    const items = Array.from({ length: 40 }, (_, i) => i);
    const shuffled = seededShuffle(items, "deck");
    expect([...shuffled].sort((a, b) => a - b)).toEqual(items);
    expect(shuffled).not.toEqual(items);
  });

  it("moves every frog in the swarm scene between questions", () => {
    const setup = { seed: "swarm-layout", mode: "swarm" as const, sceneIds: ["castle-frog-moat"], swarmCount: 12, objectCount: 18 };
    const layouts = Array.from({ length: 5 }, (_, i) => {
      const question = buildQuestion(setup, i + 1);
      return layoutOf(question.objects, question.objects.map(keyOf));
    });
    expect(new Set(layouts).size).toBe(layouts.length);
  });
});

describe("targets do not give themselves away", () => {
  it("transforms distractors the same way as targets in every taught mode", () => {
    const modes = [
      ["rotation", (o: { rotation?: number }) => (o.rotation ?? 0) !== 0],
      ["scale", (o: { visualScale?: number }) => o.visualScale !== undefined],
    ] as const;
    modes.forEach(([mode, transformed]) => {
      const question = buildQuestion({ seed: `tell-${mode}`, mode, sceneIds: ["museum-planetarium"], objectCount: 10, targetCount: 3 }, 1);
      const decoys = question.objects.filter((object) => !question.targets.includes(keyOf(object)));
      // If only the answers were turned or resized, "find the odd one out" wins
      // and no shape matching is needed.
      expect(decoys.length).toBeGreaterThan(0);
      expect(decoys.every(transformed), mode).toBe(true);
    });
  });

  it("hides some distractors too, so being clipped is not the clue", () => {
    const question = buildQuestion({ seed: "tell-occluded", mode: "occluded", sceneIds: ["harbor-harbor-docks"], objectCount: 10, targetCount: 4 }, 1);
    const decoys = question.objects.filter((object) => !question.targets.includes(keyOf(object)));
    const clipped = decoys.filter((object) => object.visibleFraction < 1);
    expect(question.objects.filter((o) => question.targets.includes(keyOf(o))).every((o) => o.visibleFraction === 0.72)).toBe(true);
    expect(clipped.length).toBeGreaterThan(0);
  });

  it("keeps every level's art large enough to recognise on a phone", () => {
    const SCENE_W = 316; const SCENE_H = 237; // 360px viewport, less padding and border
    lessons.lessons.forEach((lesson) => {
      const q = lesson.params.question as { targetScale?: number };
      const scale = q.targetScale ?? 0.66;
      // 8% x 10% of the scene box is the authored art size.
      const visible = { w: 0.08 * SCENE_W * scale, h: 0.10 * SCENE_H * scale };
      expect(visible.w, `${lesson.id} width`).toBeGreaterThanOrEqual(13);
      expect(visible.h, `${lesson.id} height`).toBeGreaterThanOrEqual(13);
    });
  });

  it("gives every placement a tap target at least 44 CSS px wide at 360px", () => {
    const SCENE_W = 316;
    SCENES.forEach((scene) => scene.objects.forEach((object) => {
      const px = (object.width + object.hitPadding * 2) / 100 * SCENE_W;
      expect(px, `${scene.id}/${keyOf(object)}`).toBeGreaterThanOrEqual(44);
    }));
  });
});
