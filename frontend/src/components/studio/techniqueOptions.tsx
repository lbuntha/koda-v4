/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * The technique picker options + per-technique default target count, derived
 * from the single game catalog in src/techniques so the Studio tab picker and
 * curriculum/AddQuestionDrawer render the same list from one source. To add an
 * option, add a manifest under src/techniques — never edit this file.
 */

import React from "react";
import { CountingTechnique } from "../../types";
import { ALL_TECHNIQUES } from "../../techniques";

export interface TechniqueOption {
  id: CountingTechnique;
  name: string;
  icon: React.ReactElement<{ className?: string }>;
  /** Static learner artwork owned by the component manifest. */
  defaultThumbnailUrl?: string;
}

export const TECHNIQUE_OPTIONS: TechniqueOption[] = ALL_TECHNIQUES.map((m) => ({
  id: m.technique,
  name: m.label,
  icon: m.icon,
  defaultThumbnailUrl: m.defaultThumbnailUrl,
}));

/** Per-technique default target count applied when a technique is first picked. */
export function defaultTargetCountForTechnique(technique: CountingTechnique): number {
  return ALL_TECHNIQUES.find((m) => m.technique === technique)?.defaultTargetCount ?? 5;
}
