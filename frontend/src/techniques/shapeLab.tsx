/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Shape Lab — single-file registration for this game.
 * Owned end-to-end here: canvas, settings panel, AI schema, picker label/icon.
 */

import React from "react";
import { Shapes } from "lucide-react";
import { CountingTechnique } from "../types";
import { defineTechnique } from "./manifest";
import { shapeLabSchema } from "../components/studio/ai-generator/schemas/shapeLab.schema";

export const shapeLab = defineTechnique({
  technique: CountingTechnique.SHAPE_LAB,
  defaultThumbnailUrl: "/assets/components/flexible-canvas.svg",
  label: "Shape Lab",
  icon: <Shapes size={14} className="text-fuchsia-600" />,
  defaultTargetCount: 3,
  component: React.lazy(() =>
    import("../components/canvases/ShapeLabCanvas").then(module => ({ default: module.ShapeLabCanvas })),
  ),
  panel: React.lazy(() =>
    import("../components/studio/panels/ShapeLabPanel").then(module => ({ default: module.ShapeLabPanel })),
  ),
  schema: shapeLabSchema,
});
