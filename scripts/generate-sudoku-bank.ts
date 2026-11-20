/**
 * Writes the stock of hard 9×9 puzzles Sudoku deals: `src/skills/sudoku/internal/bank.json`.
 *
 * Puzzles that need Claiming, a pair or an X-Wing are rare when digging at
 * random (an X-Wing is about one in a few hundred tries), far too slow to make
 * while a child waits. This digs puzzles with every technique allowed and files
 * each under the hardest technique it needs; the activity remixes them on the
 * way out, so each one looks new and is exactly as hard.
 *
 * Deterministic (seeded), so running it twice writes the same file:
 *
 *   npx tsx scripts/generate-sudoku-bank.ts
 */
import { writeFileSync } from "node:fs";
import { seededRandom, shuffle, solvedGrid } from "../src/skills/sudoku/internal/board";
import { drillFrom, encode, type Bank } from "../src/skills/sudoku/internal/generate";
import { TECHNIQUES, solveLogically, type Technique } from "../src/skills/sudoku/internal/techniques";

const WANT: Technique[] = ["pointing", "claiming", "naked-pair", "hidden-pair", "x-wing"];
const PER = 40;
const bank: Bank = Object.fromEntries(WANT.map((t) => [t, [] as string[]]));
const rand = seededRandom("koda-sudoku-bank");
const started = Date.now();

for (let attempt = 0; WANT.some((t) => bank[t]!.length < PER); attempt += 1) {
  const answer = solvedGrid(9, rand);
  const grid = answer.slice();
  for (const i of shuffle([...grid.keys()], rand)) {
    const keep = grid[i];
    grid[i] = 0;
    if (!solveLogically(grid, 9, TECHNIQUES).solved) grid[i] = keep;
  }
  const rating = solveLogically(grid, 9).hardest;
  if (!rating || !WANT.includes(rating) || bank[rating]!.length >= PER) continue;
  // Only puzzles a drill can be cut from, so both activities can use them.
  if (!drillFrom({ n: 9, givens: grid, answer, technique: rating }, rating)) continue;
  bank[rating]!.push(encode(grid));
  if (attempt % 50 === 0) {
    console.log(`${attempt} tries, ${Math.round((Date.now() - started) / 1000)}s:`, WANT.map((t) => `${t} ${bank[t]!.length}`).join(", "));
  }
}

const body = Object.entries(bank)
  .map(([t, list]) => `  ${JSON.stringify(t)}: [\n${list!.map((p) => `    ${JSON.stringify(p)}`).join(",\n")}\n  ]`)
  .join(",\n");
writeFileSync("src/skills/sudoku/internal/bank.json", `{\n${body}\n}\n`);
console.log(`done in ${Math.round((Date.now() - started) / 1000)}s`);
