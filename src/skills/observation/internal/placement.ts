import { keyOf, type ObservationRegion, type ObservationScene, type SceneObject } from "./types";

/**
 * Where every hidden object ends up, for every question, in every scene.
 *
 * One function owns this because the rules interlock: a placement has to move
 * (or the round looks identical twice), stay inside its authored region (or a
 * sand object floats into the sky), stay clear of every other placement (or two
 * hit boxes overlap and a tap is ambiguous), and stay reproducible from a seed
 * (or StrictMode, tests, and saved rounds disagree about the answer). Splitting
 * those across call sites is what let the old version silently freeze.
 */

/**
 * Seeded 32-bit hash with a murmur3 finalizer.
 *
 * The finalizer is the point. Plain FNV-1a multiplies by an odd constant, so
 * its lowest bit is just the XOR-parity of the input bytes — `hash(s) % 2` was
 * not random at all, and two values drawn from near-identical seed strings
 * moved in lockstep. Avalanching before use makes every bit independent.
 */
export function seedHash(value: string): number {
  let out = 2166136261;
  for (let i = 0; i < value.length; i += 1) out = Math.imul(out ^ value.charCodeAt(i), 16777619);
  out ^= out >>> 16;
  out = Math.imul(out, 2246822507);
  out ^= out >>> 13;
  out = Math.imul(out, 3266489909);
  return (out ^ (out >>> 16)) >>> 0;
}

/** Deterministic float stream. Same seed, same sequence, forever. */
export function seededRandom(seed: string): () => number {
  let state = seedHash(seed) || 1;
  return () => {
    state ^= state << 13; state >>>= 0;
    state ^= state >>> 17;
    state ^= state << 5; state >>>= 0;
    return state / 4294967296;
  };
}

/** Order-stable seeded shuffle, used for decks and display order as well. */
export function seededShuffle<T>(items: readonly T[], seed: string): T[] {
  const out = [...items];
  const next = seededRandom(seed);
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(next() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * A permutation that keeps a group looking different question to question.
 *
 * With three or more slots the permutation is deranged: no object stays put,
 * because a fixed point is an object that visibly did not move. A pair has only
 * one derangement — the swap — so forcing it there would pin both objects to a
 * single alternate spot forever, which is the same freeze in miniature. Pairs
 * therefore alternate between swapping and holding, giving two arrangements
 * rather than one.
 */
function derange(count: number, seed: string): number[] {
  if (count < 2) return [0];
  if (count === 2) return seededRandom(seed)() < 0.5 ? [1, 0] : [0, 1];
  const order = seededShuffle(Array.from({ length: count }, (_, i) => i), seed);
  for (let i = 0; i < count; i += 1) {
    if (order[i] !== i) continue;
    const partner = i === count - 1 ? 0 : i + 1;
    [order[i], order[partner]] = [order[partner], order[i]];
  }
  return order;
}

/**
 * How far a slot may drift before its hit box could touch another slot's.
 *
 * Two boxes only collide when they overlap on *both* axes, so a pair stays
 * apart as long as its roomier axis stays apart. Budgeting half of that axis's
 * gap means even two neighbours drifting straight at each other keep a sliver
 * of separation — and that holds for diagonal neighbours, which an axis-by-axis
 * budget wrongly treated as free to move in both directions at once.
 */
/**
 * The vertical band every placement stays inside.
 *
 * Spot the Difference crops each pane to this band so two pictures fit a phone
 * without scrolling. Honouring it here — rather than only in that activity —
 * means jitter can never nudge an object out of a cropped view, and costs the
 * hidden-object rounds nothing, since no authored slot sits outside it anyway.
 */
export const BAND_TOP = 11;
export const BAND_BOTTOM = 89;

function jitterBudget(slot: SceneObject, all: readonly SceneObject[]): number {
  const MAX = 3;
  const left = slot.x - slot.hitPadding;
  const top = slot.y - slot.hitPadding;
  const right = slot.x + slot.width + slot.hitPadding;
  const bottom = slot.y + slot.height + slot.hitPadding;
  let budget = Math.min(MAX, left, 100 - right, top - BAND_TOP, BAND_BOTTOM - bottom);
  all.forEach((other) => {
    if (keyOf(other) === keyOf(slot)) return;
    const oLeft = other.x - other.hitPadding;
    const oTop = other.y - other.hitPadding;
    const oRight = other.x + other.width + other.hitPadding;
    const oBottom = other.y + other.height + other.hitPadding;
    const gapX = Math.max(oLeft - right, left - oRight);
    const gapY = Math.max(oTop - bottom, top - oBottom);
    budget = Math.min(budget, Math.max(gapX, gapY) / 2);
  });
  return Math.max(0, budget);
}

/**
 * Which horizontal band of the scene a slot sits in.
 *
 * Regions are quadrants, and a quadrant can span sky and sand at once — which
 * is how a sunscreen bottle ended up airborne the moment placements actually
 * started moving. Banding by the slot's own vertical centre keeps a ground
 * object on the ground without needing per-object surface metadata that the
 * generated scenes do not carry.
 */
function bandOf(slot: SceneObject): number {
  const centre = slot.y + slot.height / 2;
  if (centre < 30) return 0;
  if (centre < 55) return 1;
  return 2;
}

/**
 * Places the objects a question shows, one distinct authored slot each.
 *
 * Slots come from the whole scene, not just the shown objects, so a round that
 * shows six of ten objects can still use all ten hiding places. Assignment is
 * per region, so an object stays somewhere plausible for what it is; within the
 * region it is deranged, so it never sits out a question on its old spot; and
 * each landing is nudged inside its own proven-safe budget, so repeat visits to
 * one slot do not look pixel-identical.
 */
export function placeObjects(
  scene: ObservationScene,
  objects: readonly SceneObject[],
  seed: string,
): SceneObject[] {
  const slotsByRegion = new Map<ObservationRegion, SceneObject[]>();
  scene.objects.forEach((slot) => {
    slotsByRegion.set(slot.region, [...(slotsByRegion.get(slot.region) ?? []), slot]);
  });

  const placed = new Map<string, SceneObject>();
  const byRegion = new Map<ObservationRegion, SceneObject[]>();
  objects.forEach((object) => {
    byRegion.set(object.region, [...(byRegion.get(object.region) ?? []), object]);
  });

  byRegion.forEach((shown, region) => {
    const regionSlots = slotsByRegion.get(region) ?? [];
    // Group by band inside the region, so swaps stay plausible. A band holding
    // only one slot cannot swap; that object keeps its spot and relies on
    // jitter, which is still re-drawn every question.
    const bands = new Map<number, SceneObject[]>();
    regionSlots.forEach((slot) => bands.set(bandOf(slot), [...(bands.get(bandOf(slot)) ?? []), slot]));
    const taken = new Set<string>();

    shown.forEach((object) => {
      const slots = bands.get(bandOf(object)) ?? regionSlots;
      const budgetOf = (slot: SceneObject) => jitterBudget(slot, scene.objects);
      let slot = object;
      if (slots.length >= 2) {
        const order = derange(slots.length, `${seed}:${region}:${bandOf(object)}:order`);
        const home = slots.findIndex((candidate) => keyOf(candidate) === keyOf(object));
        let index = order[home >= 0 ? home : taken.size % slots.length];
        // A shown object whose deranged slot is already claimed walks the ring
        // until it finds a free one, which keeps assignment injective.
        for (let step = 0; taken.has(keyOf(slots[index])) && step < slots.length; step += 1) {
          index = (index + 1) % slots.length;
        }
        slot = slots[index];
      }
      taken.add(keyOf(slot));
      const budget = budgetOf(slot);
      const next = seededRandom(`${seed}:${keyOf(object)}:jitter`);
      const drift = () => Math.round((next() * 2 - 1) * budget * 100) / 100;
      placed.set(keyOf(object), {
        ...object,
        x: slot.x + drift(),
        y: slot.y + drift(),
        width: slot.width,
        height: slot.height,
        rotation: slot.rotation,
        z: slot.z,
        hitPadding: slot.hitPadding,
        region: slot.region,
        instanceId: object.instanceId,
      });
    });
  });

  // Preserve the caller's display order; only the geometry changed.
  return objects.map((object) => placed.get(keyOf(object)) ?? { ...object });
}
