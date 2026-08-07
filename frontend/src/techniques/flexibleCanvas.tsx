/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * 15. Flexible Canvas — single-file registration for this game.
 * Owned end-to-end here: canvas, settings panel, AI schema, picker label/icon.
 * Canvas + panel are lazy-loaded (each becomes its own bundle chunk, fetched
 * only when this game is opened). Schema/label/icon stay eager — they're small
 * data the picker and AI generator need up front without rendering the game.
 */

import React from "react";
import { Sliders } from "lucide-react";
import { CountingTechnique } from "../types";
import { defineTechnique } from "./manifest";
import { flexibleCanvasSchema } from "../components/studio/ai-generator/schemas/flexibleCanvas.schema";

export const flexibleCanvas = defineTechnique({
  technique: CountingTechnique.FLEXIBLE_CANVAS,
  label: "Flexible Canvas",
  icon: <Sliders size={14} className="text-indigo-500" />,
  defaultTargetCount: 5,
  component: React.lazy(() =>
    import("../components/canvases/FlexibleCanvas").then((m) => ({ default: m.FlexibleCanvas })),
  ),
  panel: React.lazy(() =>
    import("../components/studio/panels/FlexibleCanvasPanel").then((m) => ({ default: m.FlexibleCanvasPanel })),
  ),
  schema: flexibleCanvasSchema,
});
