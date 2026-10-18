/**
 * Writes the list of icon ids the server checks puzzles against.
 *
 * The drawings live in `src/rebus/icons/`; the server never draws, but it must
 * refuse a puzzle that names an icon which does not exist. A test compares this
 * file to the library, so a drawing added without running this fails the build.
 *
 *   npx tsx scripts/generate-rebus-icons.ts
 */

import { writeFileSync } from "node:fs";
import { ICON_IDS } from "../src/rebus/icons/library";

writeFileSync(new URL("../server/app/rebus_icons.json", import.meta.url), JSON.stringify([...ICON_IDS].sort(), null, 1) + "\n");
console.log(`${ICON_IDS.size} icons`);
