/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Liquid Sort Bottle Puzzle — single-file registration for Interaction Studio.
 * Owned end-to-end here: canvas, settings panel, AI schema, picker label/icon.
 */

import React from "react";
import { FlaskConical } from "lucide-react";
import { CountingTechnique } from "../types";
import { defineTechnique } from "./manifest";
import { liquidSortSchema } from "../components/studio/ai-generator/schemas/liquidSort.schema";

export const liquidSort = defineTechnique({
  technique: CountingTechnique.LIQUID_SORT,
  label: "Liquid Color Sort",
  icon: <FlaskConical size={14} className="text-cyan-400" />,
  defaultTargetCount: 4,
  component: React.lazy(() =>
    import("../components/canvases/LiquidSortCanvas").then((m) => ({ default: m.LiquidSortCanvas })),
  ),
  panel: React.lazy(() =>
    import("../components/studio/panels/LiquidSortPanel").then((m) => ({ default: m.LiquidSortPanel })),
  ),
  schema: liquidSortSchema,
});
