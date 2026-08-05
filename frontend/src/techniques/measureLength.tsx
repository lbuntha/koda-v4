/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Measure Length — single-file registration for this game.
 * Owned end-to-end here: canvas, settings panel, AI schema, picker label/icon.
 */

import React from "react";
import { Ruler } from "lucide-react";
import { CountingTechnique } from "../types";
import { defineTechnique } from "./manifest";
import { measureLengthSchema } from "../components/studio/ai-generator/schemas/measureLength.schema";

export const measureLength = defineTechnique({
  technique: CountingTechnique.MEASURE_LENGTH,
  defaultThumbnailUrl: "/assets/components/flexible-canvas.svg",
  label: "Measure Length",
  icon: <Ruler size={14} className="text-teal-600" />,
  defaultTargetCount: 5,
  component: React.lazy(() =>
    import("../components/canvases/MeasureLengthCanvas").then(module => ({ default: module.MeasureLengthCanvas })),
  ),
  panel: React.lazy(() =>
    import("../components/studio/panels/MeasureLengthPanel").then(module => ({ default: module.MeasureLengthPanel })),
  ),
  schema: measureLengthSchema,
});
