/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Clock — single-file registration for this game.
 * Owned end-to-end here: canvas, settings panel, AI schema, picker label/icon.
 */

import React from "react";
import { Clock } from "lucide-react";
import { CountingTechnique } from "../types";
import { defineTechnique } from "./manifest";
import { clockSchema } from "../components/studio/ai-generator/schemas/clock.schema";

export const clockRead = defineTechnique({
  technique: CountingTechnique.CLOCK_READ,
  label: "Clock",
  icon: <Clock size={14} className="text-violet-600" />,
  defaultTargetCount: 3,
  component: React.lazy(() =>
    import("../components/canvases/ClockCanvas").then(module => ({ default: module.ClockCanvas })),
  ),
  panel: React.lazy(() =>
    import("../components/studio/panels/ClockPanel").then(module => ({ default: module.ClockPanel })),
  ),
  schema: clockSchema,
});
