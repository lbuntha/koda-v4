/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Counting Crates — single-file registration for Interaction Studio.
 * Owned end-to-end here: canvas, settings panel, AI schema, picker label/icon.
 */

import React from "react";
import { PackageCheck } from "lucide-react";
import { CountingTechnique } from "../types";
import { defineTechnique } from "./manifest";
import { countCratesSchema } from "../components/studio/ai-generator/schemas/countCrates.schema";

export const countCrates = defineTechnique({
  technique: CountingTechnique.COUNT_CRATES,
  defaultThumbnailUrl: "/assets/components/count-crates.svg",
  label: "Counting Crates",
  icon: <PackageCheck size={14} className="text-emerald-500" />,
  defaultTargetCount: 10,
  component: React.lazy(() =>
    import("../components/canvases/CountCratesCanvas").then((m) => ({ default: m.CountCratesCanvas })),
  ),
  panel: React.lazy(() =>
    import("../components/studio/panels/CountCratesPanel").then((m) => ({ default: m.CountCratesPanel })),
  ),
  schema: countCratesSchema,
});
