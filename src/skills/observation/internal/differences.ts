import { OBJECT_BY_ID } from "./data";
import { placeObjects, seedHash, seededShuffle } from "./placement";
import { keyOf, type ObservationScene, type SceneObject } from "./types";

/**
 * Builds the two pictures a Spot the Difference round compares.
 *
 * The differences live in the object layer, not in the art. Drawing each scene
 * twice would cost a second backdrop per scene, hand-place every difference,
 * and hand a child the same differences on every replay. Here pane B is pane A
 * with a few mutations, so the pair is generated fresh each question and every
 * mutation reuses an engine the ladder already taught.
 */

export type DifferenceKind = "missing" | "moved" | "turned" | "resized" | "swapped" | "mirrored";

export interface SceneDifference {
  /** The object key that differs. Identity is the object, not a position, so a
   *  `missing` difference still has something to name and to tap. */
  key: string;
  kind: DifferenceKind;
}

export interface DifferencePair {
  left: SceneObject[];
  right: SceneObject[];
  differences: SceneDifference[];
}

const ROTATIONS = [28, -34, 45, -52, 62, -70];
const SCALES = [0.66, 0.74, 1.3, 1.42];

/** Can this object carry this kind of difference in this layout? */
function supports(kind: DifferenceKind, object: SceneObject, freeSlots: SceneObject[]): boolean {
  const entry = OBJECT_BY_ID.get(object.id);
  if (kind === "mirrored") return !!entry?.mirrorSafe;
  if (kind === "swapped") return !!entry?.decoyGroup;
  if (kind === "moved") return freeSlots.length > 0;
  if (kind === "turned") return entry?.orientationSafe !== false;
  return true;
}

/** The replacement a `swapped` difference uses: a meaningful near-miss. */
function decoyFor(object: SceneObject, scene: ObservationScene, used: Set<string>): SceneObject | undefined {
  const group = OBJECT_BY_ID.get(object.id)?.decoyGroup;
  if (!group) return undefined;
  const partner = [...OBJECT_BY_ID.values()].find((candidate) =>
    candidate.id !== object.id && candidate.decoyGroup === group && !used.has(candidate.id));
  if (!partner) return undefined;
  return { ...object, id: partner.id, asset: `observation-${partner.id}` };
}

export function buildDifferencePair(
  scene: ObservationScene,
  objects: readonly SceneObject[],
  wanted: number,
  kinds: readonly DifferenceKind[],
  seed: string,
): DifferencePair {
  const left = placeObjects(scene, objects, `${seed}:left`);
  const shownKeys = new Set(left.map(keyOf));
  // Slots the left picture does not use are where a `moved` object can go
  // without landing on anything.
  const freeSlots = scene.objects.filter((slot) => !shownKeys.has(keyOf(slot)));
  const usedIds = new Set(left.map((object) => object.id));

  /** Would this placement collide with anything else the right pane shows? */
  const clashes = (candidate: SceneObject, exclude: string) => left.some((other) => {
    if (keyOf(other) === exclude) return false;
    const a = { l: candidate.x - candidate.hitPadding, t: candidate.y - candidate.hitPadding,
                r: candidate.x + candidate.width + candidate.hitPadding, b: candidate.y + candidate.height + candidate.hitPadding };
    const o = { l: other.x - other.hitPadding, t: other.y - other.hitPadding,
                r: other.x + other.width + other.hitPadding, b: other.y + other.height + other.hitPadding };
    return a.l < o.r && a.r > o.l && a.t < o.b && a.b > o.t;
  });

  /**
   * Applies one kind, or reports that this object cannot carry it.
   *
   * Asking `supports` first is not enough: a `swapped` object may have a decoy
   * group whose only partner is already on screen, and a free slot may still
   * clash with a neighbour that jitter moved. Both are only knowable here, so
   * the caller tries the next kind rather than losing the difference.
   */
  const apply = (kind: DifferenceKind, object: SceneObject): SceneObject | null | undefined => {
    const key = keyOf(object);
    if (kind === "missing") return null;
    if (kind === "moved") {
      const slot = freeSlots.find((candidate) => !takenSlots.has(keyOf(candidate))
        && !clashes({ ...object, x: candidate.x, y: candidate.y, width: candidate.width, height: candidate.height }, key));
      if (!slot) return undefined;
      takenSlots.add(keyOf(slot));
      return { ...object, x: slot.x, y: slot.y, width: slot.width, height: slot.height, region: slot.region };
    }
    if (kind === "turned") return { ...object, rotation: (object.rotation ?? 0) + ROTATIONS[seedHash(`${seed}:${key}:turn`) % ROTATIONS.length] };
    if (kind === "resized") return { ...object, visualScale: (object.visualScale ?? 1) * SCALES[seedHash(`${seed}:${key}:size`) % SCALES.length] };
    if (kind === "mirrored") return { ...object, mirrored: !object.mirrored };
    const swap = decoyFor(object, scene, usedIds);
    if (!swap) return undefined;
    usedIds.add(swap.id);
    return swap;
  };

  const order = seededShuffle(left, `${seed}:pick`);
  const differences: SceneDifference[] = [];
  const mutated = new Map<string, SceneObject | null>();
  const takenSlots = new Set<string>();

  for (const object of order) {
    if (differences.length >= wanted) break;
    const key = keyOf(object);
    // Try every allowed kind in a seeded order and take the first that lands.
    for (const kind of seededShuffle(kinds, `${seed}:${key}:kind`)) {
      if (!supports(kind, object, freeSlots.filter((slot) => !takenSlots.has(keyOf(slot))))) continue;
      const result = apply(kind, object);
      if (result === undefined) continue;
      mutated.set(key, result);
      differences.push({ key, kind });
      break;
    }
  }

  // `missing` needs nothing from an object, so it always closes a shortfall —
  // the count the child is told to find has to be the count that exists.
  for (const object of order) {
    if (differences.length >= wanted) break;
    const key = keyOf(object);
    if (mutated.has(key)) continue;
    mutated.set(key, null);
    differences.push({ key, kind: "missing" });
  }

  const right = left
    .map((object) => (mutated.has(keyOf(object)) ? mutated.get(keyOf(object)) : object))
    .filter((object): object is SceneObject => object !== null);

  return { left, right, differences };
}
