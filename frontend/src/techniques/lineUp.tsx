/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * 3. Line Up — single-file registration for this game.
 * Owned end-to-end here: canvas, settings panel, AI schema, picker label/icon.
 * Canvas + panel are lazy-loaded (each becomes its own bundle chunk, fetched
 * only when this game is opened). Schema/label/icon stay eager — they're small
 * data the picker and AI generator need up front without rendering the game.
 */

import React from "react";
import { ListOrdered } from "lucide-react";
import { CountingTechnique } from "../types";
import { defineTechnique } from "./manifest";
import { lineUpSchema } from "../components/studio/ai-generator/schemas/lineUp.schema";

export const lineUp = defineTechnique({
  technique: CountingTechnique.LINE_UP_AND_COUNT,
  label: "3. Line Up",
  icon: <ListOrdered size={14} className="text-cyan-500" />,
  defaultTargetCount: 5,
  component: React.lazy(() =>
    import("../components/canvases/LineUpCanvas").then((m) => ({ default: m.LineUpCanvas })),
  ),
  panel: React.lazy(() =>
    import("../components/studio/panels/LineUpAndCountPanel").then((m) => ({ default: m.LineUpAndCountPanel })),
  ),
  schema: lineUpSchema,
});
