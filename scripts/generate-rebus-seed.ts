/**
 * Writes the pre-built puzzles the server seeds its database with.
 *
 * The puzzles are written in `src/rebus/content/`. On first boot the server
 * copies them into its own collection (create-if-absent, so an admin's edits
 * are never overwritten), and from then on the Studio manages them. A test
 * compares this file to the bundled bank, so a puzzle added in code without
 * running this fails the build.
 *
 *   npx tsx scripts/generate-rebus-seed.ts
 */

import { writeFileSync } from "node:fs";
import { OFFICIAL_PUZZLES } from "../src/rebus/content";

writeFileSync(new URL("../server/app/rebus_seed.json", import.meta.url), JSON.stringify(OFFICIAL_PUZZLES, null, 1) + "\n");
console.log(`${OFFICIAL_PUZZLES.length} puzzles`);
