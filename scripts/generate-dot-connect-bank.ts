/**
 * Writes the boards Dot Connect deals: `src/skills/dot-connect/internal/bank.json`.
 *
 * Every spec gets BOARDS boards from seeds 0..BOARDS-1. Generation is
 * deterministic, so running this twice writes the same file; a test compares a
 * board of each spec with the generator, so a generator change without a
 * rebuild fails. Run after changing a spec or the generator:
 *
 *   npx tsx scripts/generate-dot-connect-bank.ts
 */
import { writeFileSync } from "node:fs";
import { generateBoard } from "../src/skills/dot-connect/internal/generate";
import { BOARD_SPECS } from "../src/skills/dot-connect/internal/specs";

const BOARDS = 12;
const bank: Record<string, unknown[]> = {};

for (const spec of BOARD_SPECS) {
  const started = Date.now();
  bank[spec.id] = Array.from({ length: BOARDS }, (_, seed) => {
    const board = generateBoard(spec, seed);
    if (board.fallback) throw new Error(`${spec.id} seed ${seed} fell back — widen its band or retries`);
    const { specId: _specId, fallback: _fallback, ...entry } = board;
    return entry;
  });
  console.log(`${spec.id}: ${BOARDS} boards in ${Date.now() - started} ms`);
}

// One board per line: diffs stay readable, and the file stays small.
const body = Object.entries(bank)
  .map(([id, boards]) => `  ${JSON.stringify(id)}: [\n${boards.map((b) => `    ${JSON.stringify(b)}`).join(",\n")}\n  ]`)
  .join(",\n");
writeFileSync(new URL("../src/skills/dot-connect/internal/bank.json", import.meta.url), `{\n${body}\n}\n`);
