/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Data Chart — single-file registration for this game.
 * Owned end-to-end here: canvas, settings panel, AI schema, picker label/icon.
 */

import React from "react";
import { BarChart3 } from "lucide-react";
import { CountingTechnique } from "../types";
import { defineTechnique } from "./manifest";
import { dataChartSchema } from "../components/studio/ai-generator/schemas/dataChart.schema";

export const dataChart = defineTechnique({
  technique: CountingTechnique.DATA_CHART,
  label: "Data Chart",
  icon: <BarChart3 size={14} className="text-rose-600" />,
  defaultTargetCount: 6,
  component: React.lazy(() =>
    import("../components/canvases/DataChartCanvas").then(module => ({ default: module.DataChartCanvas })),
  ),
  panel: React.lazy(() =>
    import("../components/studio/panels/DataChartPanel").then(module => ({ default: module.DataChartPanel })),
  ),
  schema: dataChartSchema,
});
