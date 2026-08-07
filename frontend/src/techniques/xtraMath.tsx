/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { defineTechnique } from "./manifest";
import { CountingTechnique } from "../types";
import { Zap } from "lucide-react";
import { xtraMathSchema } from "../components/studio/ai-generator/schemas/xtraMath.schema";

export const xtraMath = defineTechnique({
  technique: CountingTechnique.XTRA_MATH,
  label: "XtraMath Speed Fluency",
  icon: <Zap className="text-amber-500" />,
  defaultTargetCount: 10,
  component: React.lazy(() =>
    import("../components/canvases/XtraMathCanvas").then((module) => ({ default: module.XtraMathCanvas }))),
  panel: React.lazy(() =>
    import("../components/studio/panels/XtraMathPanel").then((module) => ({ default: module.XtraMathPanel }))),
  schema: xtraMathSchema,
});
