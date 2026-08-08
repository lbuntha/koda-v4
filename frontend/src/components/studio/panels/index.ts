/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Technique → Property Studio panel. Derived from the single game catalog in
 * src/techniques. To add a panel, add a manifest there — this file and
 * App.tsx never need editing.
 */

import React from "react";
import { CountingTechnique } from "../../../types";
import { PanelProps } from "../panelKit";
import { ALL_TECHNIQUES, byTechnique } from "../../../techniques";
import { ABSORBED_TECHNIQUES } from "../../../techniques/manifest";

const live = byTechnique(ALL_TECHNIQUES, (m) => m.panel);

/**
 * An absorbed technique has no manifest, so `byTechnique` cannot supply it — but a question
 * published on one of these ids can still be opened in the Property Studio, and it is edited
 * by the panel of the game it now renders as. Derived from the map rather than listed here,
 * so absorbing another technique stays a one-line change in `manifest.ts`.
 *
 * The canvas half of this fallback lives in `CanvasPreview` and `GameLauncher`, which fall
 * back to `CountCanvas` on a `CANVAS_BY_TECHNIQUE` miss.
 */
export const TECHNIQUE_PANELS: Record<CountingTechnique, React.ComponentType<PanelProps>> = {
  ...live,
  ...Object.fromEntries(
    [...ABSORBED_TECHNIQUES]
      .filter(([, owner]) => live[owner])
      .map(([absorbed, owner]) => [absorbed, live[owner]]),
  ),
};
