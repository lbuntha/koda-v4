/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * The complete game catalog. This is the ONE list the app reads; every
 * registry (canvas, panel, AI schema, picker) is derived from it.
 *
 * To add a game: create ./yourGame.tsx (like the others) and add it to the
 * array below in the order it should appear in the Studio picker. That's the
 * only shared line to touch — everything else is your own new file.
 */

import { TechniqueManifest, assertComplete } from "./manifest";
import { oneToOne } from "./oneToOne";
import { moveAndCount } from "./moveAndCount";
import { lineUp } from "./lineUp";
import { groupTens } from "./groupTens";
import { countOn } from "./countOn";
import { countBack } from "./countBack";
import { arrangements } from "./arrangements";
import { magnets } from "./magnets";
import { subitize } from "./subitize";
import { addition } from "./addition";
import { subtraction } from "./subtraction";
import { multiplication } from "./multiplication";
import { kodaSudoku } from "./kodaSudoku";
import { kodaPattern } from "./kodaPattern";
import { flexibleCanvas } from "./flexibleCanvas";
import { additionTutor } from "./additionTutor";

/** Ordered exactly as the Studio picker lists them (1..16). */
export const ALL_TECHNIQUES: TechniqueManifest[] = [
  oneToOne,
  moveAndCount,
  lineUp,
  groupTens,
  countOn,
  countBack,
  arrangements,
  magnets,
  subitize,
  addition,
  subtraction,
  multiplication,
  kodaSudoku,
  kodaPattern,
  flexibleCanvas,
  additionTutor,
];

// Loud in dev / logged in prod if a game is missing or double-registered.
assertComplete(ALL_TECHNIQUES);

export { byTechnique } from "./manifest";
export type { TechniqueManifest } from "./manifest";
