/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * 7. Arrangements — single-file registration for this game.
 * Owned end-to-end here: canvas, settings panel, AI schema, picker label/icon.
 * Canvas + panel are lazy-loaded (each becomes its own bundle chunk, fetched
 * only when this game is opened). Schema/label/icon stay eager — they're small
 * data the picker and AI generator need up front without rendering the game.
 */

import React from "react";
import { LayoutGrid } from "lucide-react";
import { CountingTechnique } from "../types";
import { defineTechnique } from "./manifest";
import { arrangementsSchema } from "../components/studio/ai-generator/schemas/arrangements.schema";

export const arrangements = defineTechnique({
  technique: CountingTechnique.DIFFERENT_ARRANGEMENTS,
  label: "7. Arrangements",
  icon: <LayoutGrid size={14} className="text-teal-500" />,
  defaultTargetCount: 5,
  component: React.lazy(() =>
    import("../components/canvases/ArrangementsCanvas").then((m) => ({ default: m.ArrangementsCanvas })),
  ),
  panel: React.lazy(() =>
    import("../components/studio/panels/DifferentArrangementsPanel").then((m) => ({ default: m.DifferentArrangementsPanel })),
  ),
  schema: arrangementsSchema,
});
