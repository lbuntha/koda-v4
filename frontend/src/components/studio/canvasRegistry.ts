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

export const CANVAS_BY_TECHNIQUE: Record<CountingTechnique, React.ComponentType<CanvasProps>> =
  byTechnique(ALL_TECHNIQUES, (m) => m.component);
