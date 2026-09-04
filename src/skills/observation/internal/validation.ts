import { OBJECT_BY_ID, OBJECT_CATALOG } from "./data";
import { keyOf, type ObservationScene, type SceneObject } from "./types";

const overlap = (a: SceneObject, b: SceneObject) => {
  const ax = a.x - a.hitPadding; const ay = a.y - a.hitPadding;
  const bx = b.x - b.hitPadding; const by = b.y - b.hitPadding;
  return ax < bx + b.width + b.hitPadding * 2 && ax + a.width + a.hitPadding * 2 > bx
    && ay < by + b.height + b.hitPadding * 2 && ay + a.height + a.hitPadding * 2 > by;
};

export function validateCatalog(): string[] {
  const ids = OBJECT_CATALOG.map((object) => object.id);
  const errors: string[] = [];
  if (ids.length !== 110) errors.push(`Expected 110 objects; got ${ids.length}.`);
  if (new Set(ids).size !== ids.length) errors.push("Object IDs must be unique.");
  return errors;
}

export function validateScene(scene: ObservationScene): string[] {
  const errors: string[] = [];
  // Uniqueness is per placement, not per catalog entry: a swarm scene hides
  // one character many times, and each copy is separately findable.
  const keys = new Set<string>();
  scene.objects.forEach((object) => {
    const key = keyOf(object);
    if (!OBJECT_BY_ID.has(object.id)) errors.push(`${object.id} is not in the catalog.`);
    if (keys.has(key)) errors.push(`${key} appears twice.`);
    keys.add(key);
    if (object.x < 0 || object.y < 0 || object.x + object.width > 100 || object.y + object.height > 100) errors.push(`${key} leaves the scene.`);
    if (object.visibleFraction < (OBJECT_BY_ID.get(object.id)?.minimumVisibleFraction ?? 1)) errors.push(`${key} is too hidden.`);
  });
  for (let a = 0; a < scene.objects.length; a += 1) for (let b = a + 1; b < scene.objects.length; b += 1) {
    if (overlap(scene.objects[a], scene.objects[b])) errors.push(`${keyOf(scene.objects[a])} overlaps ${keyOf(scene.objects[b])}.`);
  }
  return errors;
}
