/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * 14. Pattern Completion — single-file registration for this game.
 * Owned end-to-end here: canvas, settings panel, AI schema, picker label/icon.
 * Canvas + panel are lazy-loaded (each becomes its own bundle chunk, fetched
 * only when this game is opened). Schema/label/icon stay eager — they're small
 * data the picker and AI generator need up front without rendering the game.
 */

import React from "react";
import { Workflow } from "lucide-react";
import { CountingTechnique } from "../types";
import { defineTechnique } from "./manifest";
import { kodaPatternSchema } from "../components/studio/ai-generator/schemas/kodaPattern.schema";

export const kodaPattern = defineTechnique({
  technique: CountingTechnique.KODA_PATTERN,
  label: "14. Pattern Completion",
  icon: <Workflow size={14} className="text-purple-600" />,
  defaultTargetCount: 5,
  component: React.lazy(() =>
    import("../components/canvases/KodaPatternCanvas").then((m) => ({ default: m.KodaPatternCanvas })),
  ),
  panel: React.lazy(() =>
    import("../components/studio/panels/KodaPatternPanel").then((m) => ({ default: m.KodaPatternPanel })),
  ),
  schema: kodaPatternSchema,
});
