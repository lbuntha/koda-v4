/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Compare Numbers — single-file registration for this game.
 * Owned end-to-end here: canvas, settings panel, AI schema, picker label/icon.
 */

import React from "react";
import { Scale } from "lucide-react";
import { CountingTechnique } from "../types";
import { defineTechnique } from "./manifest";
import { compareNumbersSchema } from "../components/studio/ai-generator/schemas/compareNumbers.schema";

export const compareNumbers = defineTechnique({
  technique: CountingTechnique.COMPARE_NUMBERS,
  label: "Compare Numbers",
  icon: <Scale size={14} className="text-sky-600" />,
  defaultTargetCount: 42,
  component: React.lazy(() =>
    import("../components/canvases/CompareNumbersCanvas").then(module => ({ default: module.CompareNumbersCanvas })),
  ),
  panel: React.lazy(() =>
    import("../components/studio/panels/CompareNumbersPanel").then(module => ({ default: module.CompareNumbersPanel })),
  ),
  schema: compareNumbersSchema,
});
