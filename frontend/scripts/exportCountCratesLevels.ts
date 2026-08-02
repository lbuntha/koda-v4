/**
 * Export the Counting Crates ladder for the backend seed.
 *
 * The levels live in TypeScript because the canvas plays them. The seed needs the same
 * numbers to author one skill per level and to put the order, the shelf and the constraint
 * into each question's config — which is also what grades it, since Counting Crates is a
 * derived-answer technique with no secret key. Copying them into Python by hand would
 * drift the first time a level is edited, so the JSON is generated:
 *
 *     npm run export:count-crates-levels
 *
 * Commit the output; the seed reads it and never reaches into the frontend.
 *
 * Every level is re-solved here before it is written. The model's search is exhaustive, so
 * "unsolvable" is a fact rather than a timeout — a level that cannot be filled is marked
 * and the seed skips it rather than handing a child a board that never completes.
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  COUNT_CRATES_LEVELS,
  fewestCrates,
  solveCountCrates,
  startingBoard,
  stockValue,
} from "../src/components/canvases/countCratesModel";

const OUTPUT = resolve(import.meta.dirname, "../../backend/scripts/data/count_crates_levels.json");

const levels = COUNT_CRATES_LEVELS.map((level) => {
  const plan = solveCountCrates(startingBoard(level), level);
  const fewest = fewestCrates(level);
  const opens = plan
    ? Object.values(plan.opens).reduce((sum, count) => sum + (count ?? 0), 0)
    : 0;

  return {
    id: level.id,
    name: level.name,
    description: level.description,
    teaches: level.teaches,
    difficultyTier: level.difficultyTier,
    orderTotal: level.orderTotal,
    // Stock keys are stringified on the way through JSON; the seed and the grader both
    // read them back as numbers.
    stock: level.stock,
    shelfValue: stockValue(level.stock),
    constraint: level.constraint,
    exactCrates: level.exactCrates ?? null,
    opensAllowed: level.opensAllowed,
    goodsEmoji: level.goodsEmoji,
    goodsLabel: level.goodsLabel,
    /** The fewest crates that can fill it — what `estimatedMinutes` is sized from. */
    fewestCrates: fewest,
    /** The crates a solution needs, and how many openings it takes to get there. */
    solutionCrates: plan ? plan.crates.length : null,
    opensNeeded: opens,
    solvable: plan !== null,
  };
});

mkdirSync(dirname(OUTPUT), { recursive: true });
writeFileSync(OUTPUT, JSON.stringify(levels, null, 2) + "\n", "utf-8");

const broken = levels.filter((level) => !level.solvable);
console.log(`wrote ${levels.length} levels (${levels.length - broken.length} solvable) -> ${OUTPUT}`);
for (const level of broken) {
  console.warn(
    `  UNSOLVABLE ${level.id} (${level.name}) — order ${level.orderTotal} cannot be made from `
    + `a shelf worth ${level.shelfValue} with ${level.opensAllowed} opening(s).`
    + "\n             excluded from seeding until the level data is fixed.",
  );
}
