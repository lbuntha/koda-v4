/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * 12. Koda Multiplication — single-file registration for this game.
 * Owned end-to-end here: canvas, settings panel, AI schema, picker label/icon.
 * Canvas + panel are lazy-loaded (each becomes its own bundle chunk, fetched
 * only when this game is opened). Schema/label/icon stay eager — they're small
 * data the picker and AI generator need up front without rendering the game.
 */

import React from "react";
import { Grid } from "lucide-react";
import { CountingTechnique } from "../types";
import { defineTechnique } from "./manifest";
import { multiplicationSchema } from "../components/studio/ai-generator/schemas/multiplication.schema";

export const multiplication = defineTechnique({
  technique: CountingTechnique.MULTIPLICATION_ARRAY,
  label: "12. Koda Multiplication",
  icon: <Grid size={14} className="text-blue-600" />,
  defaultTargetCount: 5,
  component: React.lazy(() =>
    import("../components/canvases/MultiplicationCanvas").then((m) => ({ default: m.MultiplicationCanvas })),
  ),
  panel: React.lazy(() =>
    import("../components/studio/panels/MultiplicationArrayPanel").then((m) => ({ default: m.MultiplicationArrayPanel })),
  ),
  schema: multiplicationSchema,
});
