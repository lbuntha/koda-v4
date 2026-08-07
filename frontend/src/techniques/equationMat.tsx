/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Equation Mat — single-file registration for this game.
 * Owned end-to-end here: canvas, settings panel, AI schema, picker label/icon.
 */

import React from "react";
import { Equal } from "lucide-react";
import { CountingTechnique } from "../types";
import { defineTechnique } from "./manifest";
import { equationMatSchema } from "../components/studio/ai-generator/schemas/equationMat.schema";

export const equationMat = defineTechnique({
  technique: CountingTechnique.EQUATION_MAT,
  label: "Equation Mat",
  icon: <Equal size={14} className="text-indigo-600" />,
  defaultTargetCount: 3,
  component: React.lazy(() =>
    import("../components/canvases/EquationMatCanvas").then(module => ({ default: module.EquationMatCanvas })),
  ),
  panel: React.lazy(() =>
    import("../components/studio/panels/EquationMatPanel").then(module => ({ default: module.EquationMatPanel })),
  ),
  schema: equationMatSchema,
});
