/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * 9. Subitize Flash — single-file registration for this game.
 * Owned end-to-end here: canvas, settings panel, AI schema, picker label/icon.
 * Canvas + panel are lazy-loaded (each becomes its own bundle chunk, fetched
 * only when this game is opened). Schema/label/icon stay eager — they're small
 * data the picker and AI generator need up front without rendering the game.
 */

import React from "react";
import { Eye } from "lucide-react";
import { CountingTechnique } from "../types";
import { defineTechnique } from "./manifest";
import { subitizeSchema } from "../components/studio/ai-generator/schemas/subitize.schema";

export const subitize = defineTechnique({
  technique: CountingTechnique.SUBITIZE,
  label: "Subitize Flash",
  icon: <Eye size={14} className="text-violet-500" />,
  defaultTargetCount: 5,
  component: React.lazy(() =>
    import("../components/canvases/SubitizeCanvas").then((m) => ({ default: m.SubitizeCanvas })),
  ),
  panel: React.lazy(() =>
    import("../components/studio/panels/SubitizePanel").then((m) => ({ default: m.SubitizePanel })),
  ),
  schema: subitizeSchema,
});
