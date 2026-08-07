/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * 17. Column Addition — single-file registration for this game.
 * Owned end-to-end here: canvas, settings panel, AI schema, picker label/icon.
 * Canvas + panel are lazy-loaded (each becomes its own bundle chunk, fetched
 * only when this game is opened). Schema/label/icon stay eager — they're small
 * data the picker and AI generator need up front without rendering the game.
 */

import React from "react";
import { Columns3 } from "lucide-react";
import { CountingTechnique } from "../types";
import { defineTechnique } from "./manifest";
import { columnAdditionSchema } from "../components/studio/ai-generator/schemas/columnAddition.schema";

export const columnAddition = defineTechnique({
  technique: CountingTechnique.ADDITION_COLUMN,
  label: "Column Addition",
  icon: <Columns3 size={14} className="text-indigo-600" />,
  defaultTargetCount: 31,
  component: React.lazy(() =>
    import("../components/canvases/ColumnAdditionCanvas").then((m) => ({ default: m.ColumnAdditionCanvas })),
  ),
  panel: React.lazy(() =>
    import("../components/studio/panels/ColumnAdditionPanel").then((m) => ({ default: m.ColumnAdditionPanel })),
  ),
  schema: columnAdditionSchema,
});
