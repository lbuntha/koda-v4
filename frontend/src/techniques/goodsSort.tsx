/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Goods Shelf Sort Puzzle — single-file registration for Interaction Studio.
 * Owned end-to-end here: canvas, settings panel, AI schema, picker label/icon.
 */

import React from "react";
import { PackageCheck } from "lucide-react";
import { CountingTechnique } from "../types";
import { defineTechnique } from "./manifest";
import { goodsSortSchema } from "../components/studio/ai-generator/schemas/goodsSort.schema";

export const goodsSort = defineTechnique({
  technique: CountingTechnique.GOODS_SORT,
  label: "Goods Shelf Sort",
  icon: <PackageCheck size={14} className="text-amber-400" />,
  defaultTargetCount: 3,
  component: React.lazy(() =>
    import("../components/canvases/GoodsSortCanvas").then((m) => ({ default: m.GoodsSortCanvas })),
  ),
  panel: React.lazy(() =>
    import("../components/studio/panels/GoodsSortPanel").then((m) => ({ default: m.GoodsSortPanel })),
  ),
  schema: goodsSortSchema,
});
