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
import { flexibleCanvas } from "./flexibleCanvas";
import { additionTutor } from "./additionTutor";
import { columnAddition } from "./columnAddition";
import { columnSubtraction } from "./columnSubtraction";
import { multiRowColumnAddition } from "./multiRowColumnAddition";
import { multiRowColumnSubtraction } from "./multiRowColumnSubtraction";
import { liquidSort } from "./liquidSort";
import { goodsSort } from "./goodsSort";
import { numberPath } from "./numberPath";
import { storyProblemMat } from "./storyProblemMat";
import { placeValueLab } from "./placeValueLab";
import { equationMat } from "./equationMat";
import { compareNumbers } from "./compareNumbers";
import { clockRead } from "./clockRead";
import { measureLength } from "./measureLength";
import { dataChart } from "./dataChart";
import { shapeLab } from "./shapeLab";
import { countCrates } from "./countCrates";
import { xtraMath } from "./xtraMath";

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
  flexibleCanvas,
  additionTutor,
  columnAddition,
  columnSubtraction,
  multiRowColumnAddition,
  multiRowColumnSubtraction,
  liquidSort,
  goodsSort,
  numberPath,
  storyProblemMat,
  placeValueLab,
  equationMat,
  compareNumbers,
  clockRead,
  measureLength,
  dataChart,
  shapeLab,
  countCrates,
  xtraMath,
];

// Loud in dev / logged in prod if a game is missing or double-registered.
assertComplete(ALL_TECHNIQUES);

/** Resolve component-owned learner artwork without mounting the game canvas. */
export function defaultThumbnailForTechnique(
  technique: string | null | undefined,
): string | null {
  if (!technique) return null;
  return ALL_TECHNIQUES.find(manifest => manifest.technique === technique)?.defaultThumbnailUrl ?? null;
}

export type TechniqueThumbnailSource = "curriculum" | "component" | "generic";

export interface ResolvedTechniqueThumbnail {
  url: string;
  source: TechniqueThumbnailSource;
  componentDefaultUrl: string | null;
}

/**
 * Resolve learner artwork in one consistent order:
 * curriculum override → component manifest default → generic app fallback.
 */
export function resolveTechniqueThumbnail(
  curriculumUrl: string | null | undefined,
  technique: string | null | undefined,
  genericUrl = "/assets/owl-mascot.svg",
): ResolvedTechniqueThumbnail {
  let authoredUrl = curriculumUrl?.trim();

  // If the stored URL is the generic owl mascot from old seed/cache, ignore it in favor of curriculum artwork
  if (authoredUrl && (authoredUrl.includes("owl-mascot") || authoredUrl.includes("owl_mascot"))) {
    authoredUrl = undefined;
  }

  const componentDefaultUrl = defaultThumbnailForTechnique(technique);

  if (authoredUrl) {
    return { url: authoredUrl, source: "curriculum", componentDefaultUrl };
  }
  if (componentDefaultUrl) {
    return { url: componentDefaultUrl, source: "component", componentDefaultUrl };
  }
  return { url: genericUrl, source: "generic", componentDefaultUrl: null };
}

export { byTechnique } from "./manifest";
export type { TechniqueManifest } from "./manifest";
