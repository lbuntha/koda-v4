/**
 * Export the curated Liquid Sort levels for the backend seed.
 *
 * The levels live here in TypeScript because the canvas renders them. The seed needs
 * the same data to author one skill per level and to store each level's colour counts
 * as the private grading key. Copying them into Python by hand would drift the first
 * time a level is edited, so the JSON is generated instead:
 *
 *     npm run export:liquid-sort-levels
 *
 * Commit the output; the seed reads it and never reaches into the frontend.
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { LIQUID_SORT_CURRICULUM_LEVELS, type BottleState } from "../src/components/canvases/liquidSortLevels";
import { solveLiquidSort } from "../src/components/canvases/LiquidSortCanvas";

const OUTPUT = resolve(import.meta.dirname, "../../backend/scripts/data/liquid_sort_levels.json");

/**
 * Play the level out with the hint solver. A level nobody can finish is worse than a
 * missing level: the child sorts what they can, the board never completes, and the
 * activity sits unfinished on their path forever. Two of the curated levels are in that
 * state (magenta appears 5 times in a 4-slot bottle), so this is checked, not assumed.
 */
const isSolvable = (level: { bottles: BottleState[] }): boolean => {
  const bottles = level.bottles.map(b => ({
    id: b.id, capacity: b.capacity, layers: b.layers.map(l => ({ ...l })),
  }));
  const finished = () =>
    bottles.every(b => !b.layers.length
      || (b.layers.length === b.capacity && b.layers.every(l => l.colorKey === b.layers[0].colorKey)));
  for (let move = 0; move < 500 && !finished(); move++) {
    const next = solveLiquidSort(bottles);
    if (!next) return false;
    const from = bottles.find(b => b.id === next.from)!;
    const to = bottles.find(b => b.id === next.to)!;
    const colour = from.layers[from.layers.length - 1].colorKey;
    while (from.layers.length
      && from.layers[from.layers.length - 1].colorKey === colour
      && to.layers.length < to.capacity) {
      from.layers.pop();
      to.layers.push({ colorKey: colour });
    }
  }
  return finished();
};

const levels = LIQUID_SORT_CURRICULUM_LEVELS.map(level => {
  const layers: Record<string, number> = {};
  for (const bottle of level.bottles) {
    for (const layer of bottle.layers) {
      layers[layer.colorKey] = (layers[layer.colorKey] ?? 0) + 1;
    }
  }
  // A hidden layer is only hidden to the player; it still occupies the bottle and must
  // be accounted for when the server checks the finished board.
  const hidden = level.bottles.reduce(
    (total, bottle) => total + bottle.layers.filter(layer => layer.hidden).length,
    0,
  );
  // Each colour has to fill exactly one bottle. Most boards use one capacity throughout;
  // tower challenges deliberately pair one eight-layer colour with an eight-slot bottle.
  const capacities = level.bottles.map(bottle => bottle.capacity).sort((a, b) => b - a);
  const unbalanced: string[] = [];
  for (const [colour, count] of Object.entries(layers).sort(([, a], [, b]) => b - a)) {
    const matchingBottle = capacities.indexOf(count);
    if (matchingBottle === -1) {
      unbalanced.push(`${colour}x${count}`);
    } else {
      capacities.splice(matchingBottle, 1);
    }
  }

  return {
    id: level.id,
    name: level.name,
    description: level.description,
    difficultyTier: level.difficultyTier,
    bottles: level.bottles.length,
    colours: Object.keys(layers).length,
    hiddenLayers: hidden,
    layers,
    solvable: isSolvable(level),
    unbalancedColours: unbalanced,
  };
});

mkdirSync(dirname(OUTPUT), { recursive: true });
writeFileSync(OUTPUT, JSON.stringify(levels, null, 2) + "\n", "utf-8");

const broken = levels.filter(level => !level.solvable);
console.log(`wrote ${levels.length} levels (${levels.length - broken.length} solvable) -> ${OUTPUT}`);
for (const level of broken) {
  console.warn(
    `  UNSOLVABLE ${level.id} (${level.name}) — colours not one-bottle-sized: `
    + (level.unbalancedColours.join(", ") || "unknown")
    + "\n             excluded from seeding until the level data is fixed.",
  );
}
