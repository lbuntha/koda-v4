/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Harvest Crop Sort Game — single-file registration for Interaction Studio.
 * Owned end-to-end here: canvas, settings panel, AI schema, picker label/icon.
 */

import React from "react";
import { Sprout } from "lucide-react";
import { CountingTechnique } from "../types";
import { defineTechnique } from "./manifest";
import { harvestSortSchema } from "../components/studio/ai-generator/schemas/harvestSort.schema";

export const harvestSort = defineTechnique({
  technique: CountingTechnique.HARVEST_SORT,
  defaultThumbnailUrl: "/assets/components/goods-sort.svg",
  label: "Harvest Crop Sort",
  icon: <Sprout size={14} className="text-emerald-400" />,
  defaultTargetCount: 15,
  component: React.lazy(() =>
    import("../components/canvases/HarvestSortCanvas").then((m) => ({ default: m.HarvestSortCanvas || m.default })),
  ),
  panel: React.lazy(() =>
    import("../components/studio/panels/HarvestSortPanel").then((m) => ({ default: m.HarvestSortPanel || m.default })),
  ),
  schema: harvestSortSchema,
});

export default harvestSort;
