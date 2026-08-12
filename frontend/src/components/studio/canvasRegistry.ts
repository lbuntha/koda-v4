/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Technique -> Canvas component lookup. Derived from the single game catalog
 * in src/techniques so any consumer (Studio tab, CanvasPreview, GameLauncher)
 * renders the exact same component for a technique. To add a canvas, add a
 * manifest under src/techniques — never edit this file.
 */

import React from "react";
import { CountingTechnique } from "../../types";
import { CanvasProps } from "../canvases/types";
import { ALL_TECHNIQUES, byTechnique } from "../../techniques";
import { ABSORBED_TECHNIQUES } from "../../techniques/manifest";

const live = byTechnique(ALL_TECHNIQUES, (m) => m.component);

/**
 * Absorbed ids resolve to the canvas that absorbed them.
 *
 * This used to be `live` alone, and the hosts covered the gap by falling back to
 * `CountCanvas` on a miss — which was right only for as long as every absorbed
 * technique was a counting one. The moment Koda Subtraction was absorbed into
 * Koda Add & Subtract, that fallback would have opened every saved subtraction
 * slide as a counting board: no minuend, no crossing out, the wrong answer
 * expected, and nothing anywhere reporting an error.
 *
 * Derived from the map rather than listed, so absorbing the next one stays a
 * one-line change in `manifest.ts` — same as `TECHNIQUE_PANELS` does for panels.
 */
export const CANVAS_BY_TECHNIQUE: Record<CountingTechnique, React.ComponentType<CanvasProps>> = {
  ...live,
  ...Object.fromEntries(
    [...ABSORBED_TECHNIQUES]
      .filter(([, owner]) => live[owner])
      .map(([absorbed, owner]) => [absorbed, live[owner]]),
  ),
};
