/**
 * Export the curated Goods Sort ladder for the backend seed.
 *
 * The levels live in TypeScript because the canvas builds and renders them. The seed
 * needs the same data to author one skill per level and to store each level's goods
 * counts as the private grading key. Copying them into Python by hand would drift the
 * first time a level is edited, so the JSON is generated instead:
 *
 *     npm run export:goods-sort-levels
 *
 * Commit the output; the seed reads it and never reaches into the frontend.
 *
 * Mirrors `exportLiquidSortLevels.ts`, including the solvability check — boards here are
 * built backwards from the finished shelf and so are solvable by construction, but the
 * seed authors what this file certifies, and "solvable by construction" is a claim worth
 * re-testing against the solver a child will actually be using.
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  GOODS_SORT_CURRICULUM_LEVELS,
  goodsCounts,
  isGoodsBoardSolved,
  spareShelves,
  type ShelfCompartment,
} from "../src/components/canvases/goodsSortLevels";
import { solveGoodsSort } from "../src/components/canvases/GoodsSortCanvas";

const OUTPUT = resolve(import.meta.dirname, "../../backend/scripts/data/goods_sort_levels.json");

/**
 * Play the board out with the hint solver. A level nobody can finish is worse than a
 * missing level: the child sorts what they can, the board never completes, and the
 * activity sits unfinished on their path forever.
 */
const isSolvable = (shelves: ShelfCompartment[]): boolean => {
  const board = shelves.map((shelf) => ({
    id: shelf.id,
    capacity: shelf.capacity,
    items: shelf.items.map((item) => ({ ...item })),
  }));
  for (let move = 0; move < 600 && !isGoodsBoardSolved(board); move++) {
    const next = solveGoodsSort(board);
    if (!next) return false;
    const from = board.find((shelf) => shelf.id === next.from)!;
    const to = board.find((shelf) => shelf.id === next.to)!;
    if (!from.items.length || to.items.length >= to.capacity) return false;
    to.items.push(from.items.pop()!);
  }
  return isGoodsBoardSolved(board);
};

/**
 * The fewest moves that could possibly finish the board: every item that is not already
 * with the biggest pile of its kind has to move at least once.
 *
 * A floor rather than the true optimum, and deliberately so — it needs no search, it never
 * overstates the work, and it is what the seed sizes `estimatedMinutes` from. The hint
 * solver's play-out is the wrong measure for that: on a few boards it wanders (46 and 83
 * moves where the floor is 16 and 18), which says the solver is inefficient there, not
 * that the puzzle is long.
 */
const moveFloor = (shelves: ShelfCompartment[]): number => {
  const gathered = new Map<string, number>();
  const total = new Map<string, number>();
  for (const shelf of shelves) {
    for (const item of shelf.items) {
      total.set(item.typeKey, (total.get(item.typeKey) ?? 0) + 1);
      const held = shelf.items.filter((other) => other.typeKey === item.typeKey).length;
      gathered.set(item.typeKey, Math.max(gathered.get(item.typeKey) ?? 0, held));
    }
  }
  let floor = 0;
  for (const [typeKey, count] of total) floor += count - (gathered.get(typeKey) ?? 0);
  return floor;
};

const levels = GOODS_SORT_CURRICULUM_LEVELS.map((level) => {
  const counts = goodsCounts(level.shelves);
  // Each kind has to fill exactly one compartment, so its count must equal a
  // compartment's capacity. Anything else cannot be sorted however well it is played.
  const unbalanced = Object.entries(counts)
    .filter(([, count]) => count !== level.compartmentCapacity)
    .map(([typeKey, count]) => `${typeKey}x${count}`);

  return {
    id: level.id,
    name: level.name,
    description: level.description,
    teaches: level.teaches,
    difficultyTier: level.difficultyTier,
    rows: level.rows,
    cols: level.cols,
    shelves: level.rows * level.cols,
    compartmentCapacity: level.compartmentCapacity,
    goodsTypes: level.goodsTypes,
    kinds: level.goodsTypes.length,
    spareShelves: spareShelves(level),
    items: level.goodsTypes.length * level.compartmentCapacity,
    moveFloor: moveFloor(level.shelves),
    counts,
    solvable: isSolvable(level.shelves),
    unbalancedGoods: unbalanced,
  };
});

mkdirSync(dirname(OUTPUT), { recursive: true });
writeFileSync(OUTPUT, JSON.stringify(levels, null, 2) + "\n", "utf-8");

const broken = levels.filter((level) => !level.solvable);
console.log(`wrote ${levels.length} levels (${levels.length - broken.length} solvable) -> ${OUTPUT}`);
for (const level of broken) {
  console.warn(
    `  UNSOLVABLE ${level.id} (${level.name}) — `
    + (level.unbalancedGoods.join(", ") || "the solver could not finish the board")
    + "\n             excluded from seeding until the level data is fixed.",
  );
}
