/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * 16. Addition Tutor — single-file registration for this game.
 * Owned end-to-end here: canvas, settings panel, AI schema, picker label/icon.
 * Canvas + panel are lazy-loaded (each becomes its own bundle chunk, fetched
 * only when this game is opened). Schema/label/icon stay eager — they're small
 * data the picker and AI generator need up front without rendering the game.
 */

import React from "react";
import { Layers } from "lucide-react";
import { CountingTechnique } from "../types";
import { defineTechnique } from "./manifest";
import { additionTutorSchema } from "../components/studio/ai-generator/schemas/additionTutor.schema";

export const additionTutor = defineTechnique({
  technique: CountingTechnique.ADDITION_TUTOR,
  label: "16. Addition Tutor",
  icon: <Layers size={14} className="text-violet-650" />,
  defaultTargetCount: 5,
  component: React.lazy(() =>
    import("../components/canvases/AdditionTutorCanvas").then((m) => ({ default: m.AdditionTutorCanvas })),
  ),
  panel: React.lazy(() =>
    import("../components/studio/panels/AdditionTutorPanel").then((m) => ({ default: m.AdditionTutorPanel })),
  ),
  schema: additionTutorSchema,
});
