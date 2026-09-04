import { describe, expect, it } from "vitest";
import { OBJECT_CATALOG } from "./internal/data";
import { SCENES } from "./internal/scenes";
import { validateCatalog, validateScene } from "./internal/validation";

describe("observation content data", () => {
  it("freezes exactly 110 unique objects", () => {
    expect(OBJECT_CATALOG).toHaveLength(110);
    expect(validateCatalog()).toEqual([]);
  });

  it("keeps all twenty-two scenes reachable and unambiguous", () => {
    expect(SCENES).toHaveLength(22);
    SCENES.forEach((scene) => expect(validateScene(scene)).toEqual([]));
    expect(new Set(SCENES.map((scene) => scene.place))).toEqual(new Set([
      "Beach Promenade", "City Park", "Family Home", "Market Street", "Farm Village", "Forest Camp", "School Campus",
      "Harbor & Aquarium", "Science Museum", "Town Square", "Castle Kingdom",
    ]));
  });

  it("hides one character many times in the swarm scene", () => {
    const moat = SCENES.find((scene) => scene.id === "castle-frog-moat")!;
    const frogs = moat.objects.filter((object) => object.id === moat.swarmObjectId);
    expect(moat.swarmObjectId).toBe("castle-frog");
    expect(frogs.length).toBeGreaterThanOrEqual(10);
    // Every copy needs its own key, or two frogs would score as one find.
    expect(new Set(frogs.map((frog) => frog.instanceId)).size).toBe(frogs.length);
    expect(validateScene(moat)).toEqual([]);
  });
});
