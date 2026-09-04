import { describe, expect, it } from "vitest";
import { buildQuestion } from "./activities/ObjectHunt";
import { placeObjects, seedHash, seededShuffle } from "./internal/placement";
import { SCENES, SCENE_BY_ID } from "./internal/scenes";
import { validateScene } from "./internal/validation";
import { keyOf } from "./internal/types";

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

  it("never leaves an object on the slot it came from", () => {
    const scene = SCENE_BY_ID.get("beach-sandcastle-shore")!;
    for (let index = 1; index <= 12; index += 1) {
      const placed = placeObjects(scene, scene.objects, `derange-${index}`);
      placed.forEach((object, i) => {
        const home = scene.objects[i];
        expect(`${object.x},${object.y}`, `${home.id} q${index}`).not.toBe(`${home.x},${home.y}`);
      });
    }
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
