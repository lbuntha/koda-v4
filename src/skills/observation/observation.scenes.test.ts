import { describe, expect, it } from "vitest";
import { OBJECT_CATALOG } from "./internal/data";
import { SCENES } from "./internal/scenes";
import { validateCatalog, validateScene } from "./internal/validation";

describe("observation content data", () => {
  it("freezes exactly 130 unique objects", () => {
    expect(OBJECT_CATALOG).toHaveLength(130);
    expect(validateCatalog()).toEqual([]);
  });

  it("keeps all twenty-eight scenes reachable and unambiguous", () => {
    expect(SCENES).toHaveLength(28);
    SCENES.forEach((scene) => expect(validateScene(scene)).toEqual([]));
    expect(new Set(SCENES.map((scene) => scene.place))).toEqual(new Set([
      "Beach Promenade", "City Park", "Family Home", "Market Street", "Farm Village", "Forest Camp", "School Campus",
      "Harbor & Aquarium", "Science Museum", "Town Square", "Castle Kingdom", "Inventor's Workshop", "Coral Reef",
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
